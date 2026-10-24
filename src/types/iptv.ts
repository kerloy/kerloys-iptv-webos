export type MediaType = 'live' | 'movie' | 'series';

export type PlaylistSourceType = 'xtream' | 'm3u' | 'demo';

export interface PlaylistProfile {
  id: string;
  name: string;
  type: PlaylistSourceType;
  isDefault?: boolean;
  createdAt: number;
  lastSyncedAt?: number;
  // Xtream Codes credentials
  serverUrl?: string;
  username?: string;
  password?: string;
  preferredLiveFormat?: 'm3u8' | 'ts';
  // M3U credentials
  m3uUrl?: string;
  m3uContent?: string;
  epgUrl?: string;
  // Account status (Xtream)
  accountInfo?: {
    status: string;
    expDate: string | null;
    isTrial: boolean;
    activeConnections: number;
    maxConnections: number;
    serverTimezone?: string;
  };
}

export interface Category {
  id: string;
  name: string;
  type: MediaType;
  isAdult?: boolean;
  itemCount?: number;
}

export interface EpgProgram {
  id: string;
  channelId: string;
  title: string;
  description: string;
  start: number; // Unix timestamp (ms)
  end: number;   // Unix timestamp (ms)
  lang?: string;
}

export interface LiveChannel {
  id: string;
  name: string;
  streamId: number | string;
  categoryId: string;
  categoryName: string;
  logo: string;
  epgChannelId?: string;
  streamUrl: string;
  fallbackStreamUrl?: string;
  containerExtension?: 'm3u8' | 'ts';
  tvArchive?: boolean;
  tvArchiveDuration?: number;
  isAdult?: boolean;
  currentProgram?: EpgProgram;
  nextProgram?: EpgProgram;
}

export interface MovieItem {
  id: string;
  streamId: number | string;
  name: string;
  categoryId: string;
  categoryName: string;
  poster: string;
  backdrop?: string;
  rating?: number;
  year?: string;
  duration?: string;
  plot?: string;
  cast?: string;
  director?: string;
  genre?: string;
  imdbId?: string;
  tmdbId?: string;
  containerExtension: string;
  streamUrl: string;
  addedAt?: number;
  isAdult?: boolean;
  audioTracksHint?: string[];
  subtitleTracksHint?: string[];
  videoResolutionHint?: string;
}

export interface SeriesEpisode {
  id: string;
  episodeNum: number;
  seasonNum: number;
  title: string;
  plot?: string;
  duration?: string;
  rating?: number;
  poster?: string;
  containerExtension: string;
  streamUrl: string;
  imdbId?: string;
  subtitles?: ExternalSubtitleTrack[];
}

export interface SeriesSeason {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  poster?: string;
  episodes: SeriesEpisode[];
}

export interface SeriesItem {
  id: string;
  seriesId: number | string;
  name: string;
  categoryId: string;
  categoryName: string;
  poster: string;
  backdrop?: string;
  plot?: string;
  cast?: string;
  director?: string;
  genre?: string;
  releaseDate?: string;
  rating?: number;
  imdbId?: string;
  tmdbId?: string;
  seasons: SeriesSeason[];
  isAdult?: boolean;
}

export interface AudioTrackOption {
  id: string | number;
  index: number;
  label: string;
  language: string;
  codec?: string;
  channels?: string;
  active: boolean;
}

export interface VideoTrackOption {
  id: string | number;
  index: number;
  label: string;
  width?: number;
  height?: number;
  bitrate?: number;
  codec?: string;
  active: boolean;
}

export interface SubtitleTrackOption {
  id: string;
  label: string;
  language: string;
  source: 'embedded' | 'opensubtitles' | 'subdl' | 'external';
  vttUrl?: string;
  rawContent?: string;
  format?: 'srt' | 'vtt';
  active: boolean;
}

export interface ExternalSubtitleTrack {
  id: string;
  provider: 'opensubtitles' | 'subdl' | 'custom';
  title: string;
  releaseName: string;
  language: string;
  languageName: string;
  downloadCount?: number;
  rating?: number;
  hearingImpaired?: boolean;
  fps?: number;
  fileId?: string | number;
  downloadUrl?: string;
}

export interface WatchProgress {
  itemId: string;
  type: MediaType;
  title: string;
  subtitle?: string;
  poster: string;
  streamUrl: string;
  positionSec: number;
  durationSec: number;
  updatedAt: number;
  seriesId?: string;
  seasonNum?: number;
  episodeNum?: number;
}

export interface AppSettings {
  openSubtitlesApiKey: string;
  subdlApiKey: string;
  preferredSubtitleLanguages: string[];
  preferredAudioLanguage: string;
  subtitleFontSize: 'small' | 'medium' | 'large' | 'xlarge';
  subtitleColor: '#FFFFFF' | '#FACC15' | '#38BDF8' | '#4ADE80';
  subtitleBgOpacity: number; // 0 to 100
  playerEngine: 'auto' | 'hlsjs' | 'native';
  liveStreamFormat: 'm3u8' | 'ts';
  aspectRatio: 'fit' | 'fill' | '16:9' | '4:3';
  parentalPin: string;
  parentalEnabled: boolean;
  unlockedSession: boolean;
  showAdultInMainMenus: boolean;
  customAdultCategoryIds: string[];
}

export interface PlayableMedia {
  id: string;
  type: MediaType;
  title: string;
  subtitle?: string;
  poster?: string;
  streamUrl: string;
  fallbackStreamUrl?: string;
  containerExtension?: string;
  imdbId?: string;
  tmdbId?: string;
  year?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  seriesId?: string;
  channelId?: string;
  startPositionSec?: number;
  audioTracksHint?: string[];
  videoResolutionHint?: string;
}
