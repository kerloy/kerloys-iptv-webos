import { create } from 'zustand';
import type {
  AppSettings,
  Category,
  LiveChannel,
  MovieItem,
  PlayableMedia,
  PlaylistProfile,
  SeriesItem,
  WatchProgress,
} from '../types/iptv';
import {
  DEMO_CATEGORIES,
  DEMO_LIVE_CHANNELS,
  DEMO_MOVIES,
  DEMO_SERIES,
} from '../services/demo/demoCatalog';
import { XtreamClient } from '../services/xtream/xtreamClient';
import { parseM3UPlaylist } from '../services/m3u/m3uParser';
import { smartFetchText } from '../utils/network';
import { parseXmltvEpg } from '../services/epg/epgService';

const STORAGE_KEYS = {
  PROFILES: 'kerloy_iptv_profiles_v1',
  ACTIVE_PROFILE_ID: 'kerloy_iptv_active_profile_v1',
  FAVORITES: 'kerloy_iptv_favorites_v1',
  WATCH_HISTORY: 'kerloy_iptv_watch_history_v1',
  SETTINGS: 'kerloy_iptv_settings_v1',
};

const DEFAULT_DEMO_PROFILE: PlaylistProfile = {
  id: 'demo-profile',
  name: 'Kerloy Demo Showcase (4K Multi-Track)',
  type: 'demo',
  createdAt: Date.now(),
  lastSyncedAt: Date.now(),
  accountInfo: {
    status: 'Active',
    expDate: 'Unlimited',
    isTrial: false,
    activeConnections: 1,
    maxConnections: 5,
  },
};

const DEFAULT_SETTINGS: AppSettings = {
  openSubtitlesApiKey: '',
  subdlApiKey: '',
  preferredSubtitleLanguages: ['en', 'ar', 'es', 'fr'],
  preferredAudioLanguage: 'en',
  subtitleFontSize: 'large',
  subtitleColor: '#FFFFFF',
  subtitleBgOpacity: 75,
  playerEngine: 'auto',
  liveStreamFormat: 'm3u8',
  aspectRatio: 'fit',
  parentalPin: '0000',
  parentalEnabled: true,
  unlockedSession: false,
};

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota warnings on constrained devices
  }
}

export type ActiveNavTab =
  | 'home'
  | 'live'
  | 'movies'
  | 'series'
  | 'search'
  | 'favorites'
  | 'playlists'
  | 'settings';

interface AppState {
  activeTab: ActiveNavTab;
  profiles: PlaylistProfile[];
  activeProfileId: string;
  isLoadingPlaylist: boolean;
  playlistError: string | null;

  categories: Category[];
  liveChannels: LiveChannel[];
  movies: MovieItem[];
  series: SeriesItem[];

  favoriteIds: string[];
  watchHistory: Record<string, WatchProgress>;
  settings: AppSettings;

  // Active modals & detail selections
  activeMedia: PlayableMedia | null;
  selectedMovie: MovieItem | null;
  selectedSeries: SeriesItem | null;
  pinPromptCallback: (() => void) | null;

  // Actions
  setActiveTab: (tab: ActiveNavTab) => void;
  setActiveMedia: (media: PlayableMedia | null) => void;
  setSelectedMovie: (movie: MovieItem | null) => void;
  setSelectedSeries: (series: SeriesItem | null) => void;

  loadProfileCatalog: (profileId: string) => Promise<void>;
  addXtreamProfile: (input: {
    name: string;
    serverUrl: string;
    username: string;
    password: string;
    preferredLiveFormat: 'm3u8' | 'ts';
  }) => Promise<void>;
  addM3UProfile: (input: {
    name: string;
    m3uUrl?: string;
    m3uContent?: string;
    epgUrl?: string;
  }) => Promise<void>;
  removeProfile: (profileId: string) => void;

  toggleFavorite: (itemId: string) => void;
  isFavorite: (itemId: string) => boolean;
  updateWatchProgress: (progress: WatchProgress) => void;
  updateSettings: (partial: Partial<AppSettings>) => void;

  requestAdultAccess: (onSuccess: () => void) => void;
  verifyPinAndUnlock: (pin: string) => boolean;
  closePinPrompt: () => void;
}

const initialProfiles = loadFromStorage<PlaylistProfile[]>(
  STORAGE_KEYS.PROFILES,
  [DEFAULT_DEMO_PROFILE]
);
const initialActiveId = loadFromStorage<string>(
  STORAGE_KEYS.ACTIVE_PROFILE_ID,
  initialProfiles[0]?.id || DEFAULT_DEMO_PROFILE.id
);

export const useAppStore = create<AppState>((set, get) => ({
  activeTab: 'home',
  profiles: initialProfiles.length > 0 ? initialProfiles : [DEFAULT_DEMO_PROFILE],
  activeProfileId: initialActiveId,
  isLoadingPlaylist: false,
  playlistError: null,

  categories: DEMO_CATEGORIES,
  liveChannels: DEMO_LIVE_CHANNELS,
  movies: DEMO_MOVIES,
  series: DEMO_SERIES,

  favoriteIds: loadFromStorage<string[]>(STORAGE_KEYS.FAVORITES, [
    'demo-live-1',
    'demo-movie-sintel',
  ]),
  watchHistory: loadFromStorage<Record<string, WatchProgress>>(
    STORAGE_KEYS.WATCH_HISTORY,
    {}
  ),
  settings: {
    ...DEFAULT_SETTINGS,
    ...loadFromStorage<Partial<AppSettings>>(STORAGE_KEYS.SETTINGS, {}),
    unlockedSession: false,
  },

  activeMedia: null,
  selectedMovie: null,
  selectedSeries: null,
  pinPromptCallback: null,

  setActiveTab: (tab) => set({ activeTab: tab }),
  setActiveMedia: (media) => set({ activeMedia: media }),
  setSelectedMovie: (movie) => set({ selectedMovie: movie }),
  setSelectedSeries: (series) => set({ selectedSeries: series }),

  loadProfileCatalog: async (profileId: string) => {
    const profile = get().profiles.find((p) => p.id === profileId);
    if (!profile) return;

    set({
      activeProfileId: profileId,
      isLoadingPlaylist: true,
      playlistError: null,
    });
    saveToStorage(STORAGE_KEYS.ACTIVE_PROFILE_ID, profileId);

    try {
      if (profile.type === 'demo') {
        set({
          categories: DEMO_CATEGORIES,
          liveChannels: DEMO_LIVE_CHANNELS,
          movies: DEMO_MOVIES,
          series: DEMO_SERIES,
          isLoadingPlaylist: false,
        });
        return;
      }

      if (profile.type === 'xtream' && profile.serverUrl && profile.username && profile.password) {
        const client = new XtreamClient(
          profile.serverUrl,
          profile.username,
          profile.password,
          profile.preferredLiveFormat || get().settings.liveStreamFormat
        );

        const accountInfo = await client.authenticate();
        const [liveCats, vodCats, seriesCats] = await Promise.all([
          client.getCategories('live').catch(() => []),
          client.getCategories('movie').catch(() => []),
          client.getCategories('series').catch(() => []),
        ]);

        const liveCatMap = new Map(liveCats.map((c) => [c.id, c.name]));
        const vodCatMap = new Map(vodCats.map((c) => [c.id, c.name]));
        const seriesCatMap = new Map(seriesCats.map((c) => [c.id, c.name]));

        const [liveChannels, movies, series] = await Promise.all([
          client.getLiveStreams(liveCatMap).catch(() => []),
          client.getVodStreams(vodCatMap).catch(() => []),
          client.getSeriesList(seriesCatMap).catch(() => []),
        ]);

        const updatedProfiles = get().profiles.map((p) =>
          p.id === profile.id
            ? { ...p, accountInfo, lastSyncedAt: Date.now() }
            : p
        );
        saveToStorage(STORAGE_KEYS.PROFILES, updatedProfiles);

        set({
          profiles: updatedProfiles,
          categories: [...liveCats, ...vodCats, ...seriesCats],
          liveChannels,
          movies,
          series,
          isLoadingPlaylist: false,
        });
        return;
      }

      if (profile.type === 'm3u') {
        let rawM3U = profile.m3uContent || '';
        if (profile.m3uUrl && !rawM3U) {
          rawM3U = await smartFetchText(profile.m3uUrl);
        }
        const parsed = parseM3UPlaylist(rawM3U);

        // Optionally load XMLTV EPG if provided
        const epgUrlToLoad = profile.epgUrl || parsed.epgUrl;
        if (epgUrlToLoad) {
          try {
            const xmlText = await smartFetchText(epgUrlToLoad);
            const epgMap = parseXmltvEpg(xmlText);
            const nowTs = Date.now();
            parsed.liveChannels.forEach((ch) => {
              const key = ch.epgChannelId || ch.name;
              const progs = epgMap.get(key);
              if (progs && progs.length > 0) {
                ch.currentProgram = progs.find((p) => p.start <= nowTs && p.end >= nowTs) || progs[0];
                ch.nextProgram = progs.find((p) => p.start > nowTs);
              }
            });
          } catch {
            // EPG optional
          }
        }

        set({
          categories: parsed.categories,
          liveChannels: parsed.liveChannels,
          movies: parsed.movies,
          series: parsed.series,
          isLoadingPlaylist: false,
        });
      }
    } catch (err: unknown) {
      set({
        isLoadingPlaylist: false,
        playlistError:
          err instanceof Error
            ? err.message
            : 'Failed to load playlist. Verify URL/credentials.',
      });
    }
  },

  addXtreamProfile: async (input) => {
    set({ isLoadingPlaylist: true, playlistError: null });
    try {
      const client = new XtreamClient(
        input.serverUrl,
        input.username,
        input.password,
        input.preferredLiveFormat
      );
      const accountInfo = await client.authenticate();
      const newProfile: PlaylistProfile = {
        id: `xtream-${Date.now()}`,
        name: input.name.trim() || `Xtream (${input.username})`,
        type: 'xtream',
        createdAt: Date.now(),
        lastSyncedAt: Date.now(),
        serverUrl: input.serverUrl.trim(),
        username: input.username.trim(),
        password: input.password.trim(),
        preferredLiveFormat: input.preferredLiveFormat,
        accountInfo,
      };
      const updated = [...get().profiles, newProfile];
      saveToStorage(STORAGE_KEYS.PROFILES, updated);
      set({ profiles: updated });
      await get().loadProfileCatalog(newProfile.id);
    } catch (err: unknown) {
      set({
        isLoadingPlaylist: false,
        playlistError:
          err instanceof Error
            ? err.message
            : 'Xtream Codes authentication failed.',
      });
      throw err;
    }
  },

  addM3UProfile: async (input) => {
    set({ isLoadingPlaylist: true, playlistError: null });
    try {
      let content = input.m3uContent || '';
      if (input.m3uUrl && !content) {
        content = await smartFetchText(input.m3uUrl);
      }
      if (!content.includes('#EXTM3U') && !content.includes('#EXTINF')) {
        throw new Error('Invalid M3U playlist format (missing #EXTM3U / #EXTINF).');
      }

      const newProfile: PlaylistProfile = {
        id: `m3u-${Date.now()}`,
        name: input.name.trim() || 'M3U Playlist',
        type: 'm3u',
        createdAt: Date.now(),
        lastSyncedAt: Date.now(),
        m3uUrl: input.m3uUrl?.trim(),
        m3uContent: input.m3uUrl ? undefined : content,
        epgUrl: input.epgUrl?.trim(),
      };
      const updated = [...get().profiles, newProfile];
      saveToStorage(STORAGE_KEYS.PROFILES, updated);
      set({ profiles: updated });
      await get().loadProfileCatalog(newProfile.id);
    } catch (err: unknown) {
      set({
        isLoadingPlaylist: false,
        playlistError:
          err instanceof Error ? err.message : 'Failed to load M3U playlist.',
      });
      throw err;
    }
  },

  removeProfile: (profileId) => {
    if (profileId === 'demo-profile') return;
    const remaining = get().profiles.filter((p) => p.id !== profileId);
    const nextList = remaining.length > 0 ? remaining : [DEFAULT_DEMO_PROFILE];
    saveToStorage(STORAGE_KEYS.PROFILES, nextList);
    set({ profiles: nextList });
    if (get().activeProfileId === profileId) {
      get().loadProfileCatalog(nextList[0].id);
    }
  },

  toggleFavorite: (itemId) => {
    const current = get().favoriteIds;
    const exists = current.includes(itemId);
    const updated = exists
      ? current.filter((id) => id !== itemId)
      : [itemId, ...current];
    saveToStorage(STORAGE_KEYS.FAVORITES, updated);
    set({ favoriteIds: updated });
  },

  isFavorite: (itemId) => get().favoriteIds.includes(itemId),

  updateWatchProgress: (progress) => {
    const updated = {
      ...get().watchHistory,
      [progress.itemId]: progress,
    };
    saveToStorage(STORAGE_KEYS.WATCH_HISTORY, updated);
    set({ watchHistory: updated });
  },

  updateSettings: (partial) => {
    const updated = { ...get().settings, ...partial };
    saveToStorage(STORAGE_KEYS.SETTINGS, updated);
    set({ settings: updated });
  },

  requestAdultAccess: (onSuccess) => {
    const { settings } = get();
    if (!settings.parentalEnabled || settings.unlockedSession) {
      onSuccess();
      return;
    }
    set({ pinPromptCallback: onSuccess });
  },

  verifyPinAndUnlock: (pin) => {
    const { settings, pinPromptCallback } = get();
    if (pin === settings.parentalPin) {
      set({
        settings: { ...settings, unlockedSession: true },
        pinPromptCallback: null,
      });
      if (pinPromptCallback) pinPromptCallback();
      return true;
    }
    return false;
  },

  closePinPrompt: () => set({ pinPromptCallback: null }),
}));
