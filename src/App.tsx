import React, { useState, useEffect, useMemo } from 'react';
import {
  Home,
  Tv,
  Film,
  Clapperboard,
  Search,
  Heart,
  ListVideo,
  Settings,
  Play,
  Star,
  Lock,
  Sparkles,
  Subtitles,
  Volume2,
  Clock,
  Radio,
} from 'lucide-react';
import { useAppStore, type ActiveNavTab } from './store/useAppStore';
import type { LiveChannel, MovieItem, SeriesItem } from './types/iptv';
import { VideoPlayer } from './components/player/VideoPlayer';
import { GlobalSearchView } from './components/search/GlobalSearchView';
import { MediaDetailModal } from './components/modals/MediaDetailModal';
import { ParentalPinModal } from './components/modals/ParentalPinModal';
import { PlaylistsView } from './components/playlists/PlaylistsView';
import { SettingsView } from './components/settings/SettingsView';
import { TV_KEYS, isBackKey } from './utils/tvRemote';

export const App: React.FC = () => {
  const {
    activeTab,
    setActiveTab,
    profiles,
    activeProfileId,
    categories,
    liveChannels,
    movies,
    series,
    favoriteIds,
    watchHistory,
    settings,
    activeMedia,
    selectedMovie,
    selectedSeries,
    setActiveMedia,
    setSelectedMovie,
    setSelectedSeries,
    requestAdultAccess,
  } = useAppStore();

  const [selectedLiveCat, setSelectedLiveCat] = useState<string>('all');
  const [selectedMovieCat, setSelectedMovieCat] = useState<string>('all');
  const [selectedSeriesCat, setSelectedSeriesCat] = useState<string>('all');
  const [previewChannel, setPreviewChannel] = useState<LiveChannel | null>(
    liveChannels[0] || null
  );
  const [clockText, setClockText] = useState<string>('');

  const activeProfile = profiles.find((p) => p.id === activeProfileId);

  // Live TV clock
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setClockText(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
    };
    updateClock();
    const timer = window.setInterval(updateClock, 15000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (liveChannels.length > 0 && !previewChannel) {
      setPreviewChannel(liveChannels[0]);
    }
  }, [liveChannels, previewChannel]);

  // Global LG Remote color key shortcuts when player is closed
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (activeMedia) return;

      if (isBackKey(e)) {
        if (selectedMovie || selectedSeries) {
          e.preventDefault();
          setSelectedMovie(null);
          setSelectedSeries(null);
          return;
        }
        if (activeTab !== 'home') {
          e.preventDefault();
          setActiveTab('home');
        }
        return;
      }

      if (e.keyCode === TV_KEYS.GREEN) {
        setActiveTab('search');
      } else if (e.keyCode === TV_KEYS.RED) {
        setActiveTab('favorites');
      }
    };

    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [
    activeMedia,
    activeTab,
    selectedMovie,
    selectedSeries,
    setActiveTab,
    setSelectedMovie,
    setSelectedSeries,
  ]);

  const handleLaunchChannel = (ch: LiveChannel) => {
    const start = () =>
      setActiveMedia({
        id: ch.id,
        type: 'live',
        title: ch.name,
        subtitle: ch.currentProgram?.title || ch.categoryName,
        poster: ch.logo,
        streamUrl: ch.streamUrl,
        fallbackStreamUrl: ch.fallbackStreamUrl,
        containerExtension: ch.containerExtension,
      });

    if (ch.isAdult) {
      requestAdultAccess(start);
    } else {
      start();
    }
  };

  const handleOpenMovie = (mv: MovieItem) => {
    if (mv.isAdult) {
      requestAdultAccess(() => setSelectedMovie(mv));
    } else {
      setSelectedMovie(mv);
    }
  };

  const handleOpenSeries = (sr: SeriesItem) => {
    if (sr.isAdult) {
      requestAdultAccess(() => setSelectedSeries(sr));
    } else {
      setSelectedSeries(sr);
    }
  };

  const liveCategories = useMemo(
    () => categories.filter((c) => c.type === 'live'),
    [categories]
  );
  const movieCategories = useMemo(
    () => categories.filter((c) => c.type === 'movie'),
    [categories]
  );
  const seriesCategories = useMemo(
    () => categories.filter((c) => c.type === 'series'),
    [categories]
  );

  const filteredLive = useMemo(
    () =>
      liveChannels.filter((c) =>
        selectedLiveCat === 'all' ? true : c.categoryId === selectedLiveCat
      ),
    [liveChannels, selectedLiveCat]
  );

  const filteredMovies = useMemo(
    () =>
      movies.filter((m) =>
        selectedMovieCat === 'all' ? true : m.categoryId === selectedMovieCat
      ),
    [movies, selectedMovieCat]
  );

  const filteredSeries = useMemo(
    () =>
      series.filter((s) =>
        selectedSeriesCat === 'all' ? true : s.categoryId === selectedSeriesCat
      ),
    [series, selectedSeriesCat]
  );

  const continueWatchingList = useMemo(
    () =>
      Object.values(watchHistory)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 6),
    [watchHistory]
  );

  const navItems: Array<{
    id: ActiveNavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'live', label: 'Live TV', icon: Tv, badge: liveChannels.length },
    { id: 'movies', label: 'Movies', icon: Film, badge: movies.length },
    { id: 'series', label: 'TV Series', icon: Clapperboard, badge: series.length },
    { id: 'search', label: 'Search', icon: Search },
    { id: 'favorites', label: 'Favorites', icon: Heart, badge: favoriteIds.length },
    { id: 'playlists', label: 'Playlists', icon: ListVideo },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="w-screen h-screen bg-[#070B14] text-slate-100 flex overflow-hidden">
      {/* Left 10-Foot TV Navigation Rail */}
      <aside className="w-64 bg-[#0B101E] border-r border-slate-800/80 flex flex-col justify-between p-5 shrink-0">
        <div className="space-y-6">
          {/* App Brand Logo */}
          <div className="flex items-center space-x-3 px-2">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Tv className="w-6 h-6 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="font-extrabold text-lg tracking-tight text-white leading-none">
                KERLOY IPTV
              </div>
              <div className="text-[11px] font-semibold text-sky-400 mt-1">
                LG webOS 5.x+ Edition
              </div>
            </div>
          </div>

          {/* Navigation Buttons */}
          <nav className="space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-sky-400 ${
                    isActive
                      ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-slate-950 shadow-md shadow-sky-500/20'
                      : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold ${
                        isActive
                          ? 'bg-slate-950/25 text-slate-950'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Active Profile Pill */}
        <div className="p-3.5 rounded-2xl bg-[#11192E] border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] text-slate-400">
            <span className="uppercase font-bold text-sky-400">
              {activeProfile?.type || 'DEMO'} SOURCE
            </span>
            <span className="font-mono">{clockText}</span>
          </div>
          <div className="text-xs font-bold text-white truncate">
            {activeProfile?.name}
          </div>
          <button
            onClick={() => setActiveTab('playlists')}
            className="w-full mt-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-sky-300"
          >
            Switch Xtream / M3U
          </button>
        </div>
      </aside>

      {/* Main Content Stage */}
      <main className="flex-1 flex flex-col p-7 overflow-hidden">
        {/* HOME TAB */}
        {activeTab === 'home' && (
          <div className="h-full overflow-y-auto pr-2 space-y-7">
            {/* Hero Spotlight Banner */}
            {movies[0] && (
              <div className="relative rounded-3xl overflow-hidden border border-slate-800 bg-gradient-to-r from-[#0F172A] via-[#131D38] to-[#0F172A] p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
                <div className="space-y-4 max-w-2xl z-10">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                    <span className="px-3 py-1 rounded-full bg-sky-500 text-slate-950 flex items-center space-x-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>FEATURED 4K MULTI-TRACK</span>
                    </span>
                    <span className="px-3 py-1 rounded-full bg-slate-800 text-amber-300 flex items-center space-x-1">
                      <Volume2 className="w-3.5 h-3.5" />
                      <span>Multi-Audio & Video Streams</span>
                    </span>
                    <span className="px-3 py-1 rounded-full bg-slate-800 text-sky-300 flex items-center space-x-1">
                      <Subtitles className="w-3.5 h-3.5" />
                      <span>OpenSubtitles + SubDL</span>
                    </span>
                  </div>

                  <h1 className="text-3xl font-extrabold text-white tracking-tight">
                    {movies[0].name}
                  </h1>
                  <p className="text-sm text-slate-300 line-clamp-2">
                    {movies[0].plot}
                  </p>

                  <div className="flex flex-wrap gap-3 pt-1">
                    <button
                      onClick={() => handleOpenMovie(movies[0])}
                      autoFocus
                      className="px-6 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-sm flex items-center space-x-2 focus:ring-4 focus:ring-white"
                    >
                      <Play className="w-5 h-5 fill-slate-950" />
                      <span>Watch & Test Streams / Subtitles</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('playlists')}
                      className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold text-sm focus:ring-2 focus:ring-sky-400"
                    >
                      Connect Xtream Codes / M3U
                    </button>
                    <button
                      onClick={() => setActiveTab('search')}
                      className="px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-sky-300 font-bold text-sm flex items-center space-x-2 focus:ring-2 focus:ring-sky-400"
                    >
                      <Search className="w-4 h-4" />
                      <span>Global Search</span>
                    </button>
                  </div>
                </div>

                {movies[0].poster && (
                  <img
                    src={movies[0].poster}
                    alt={movies[0].name}
                    className="w-44 h-60 object-cover rounded-2xl border border-slate-700 shadow-2xl shrink-0"
                  />
                )}
              </div>
            )}

            {/* Continue Watching Row */}
            {continueWatchingList.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-400 flex items-center space-x-2">
                  <Clock className="w-4 h-4" />
                  <span>Continue Watching</span>
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {continueWatchingList.map((prog) => {
                    const pct = Math.min(
                      98,
                      Math.round((prog.positionSec / (prog.durationSec || 1)) * 100)
                    );
                    return (
                      <button
                        key={prog.itemId}
                        onClick={() =>
                          setActiveMedia({
                            id: prog.itemId,
                            type: prog.type,
                            title: prog.title,
                            subtitle: prog.subtitle,
                            poster: prog.poster,
                            streamUrl: prog.streamUrl,
                            startPositionSec: prog.positionSec,
                          })
                        }
                        className="p-4 rounded-2xl bg-[#0F1626] border border-slate-800 hover:border-emerald-400/70 text-left space-y-2.5 focus:ring-2 focus:ring-emerald-400"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-sm text-white truncate">
                            {prog.title}
                          </span>
                          <Play className="w-4 h-4 text-emerald-400 shrink-0" />
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-400"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Resume at {Math.floor(prog.positionSec / 60)}m{' '}
                          {Math.floor(prog.positionSec % 60)}s ({pct}%)
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Live TV Quick Row */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-sky-400 flex items-center space-x-2">
                  <Radio className="w-4 h-4" />
                  <span>Live TV Channels & EPG Now Playing</span>
                </h2>
                <button
                  onClick={() => setActiveTab('live')}
                  className="text-xs font-bold text-sky-400 hover:underline"
                >
                  Open Full EPG Guide →
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {liveChannels.slice(0, 4).map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => handleLaunchChannel(ch)}
                    className="p-4 rounded-2xl bg-[#0F1626] hover:bg-[#162038] border border-slate-800 hover:border-sky-400/70 text-left space-y-3 transition-all focus:outline-none focus:ring-2 focus:ring-sky-400"
                  >
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px] font-extrabold uppercase flex items-center space-x-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        <span>LIVE</span>
                      </span>
                      {ch.isAdult && <Lock className="w-3.5 h-3.5 text-amber-400" />}
                    </div>
                    <div className="font-bold text-white text-sm truncate">
                      {ch.name}
                    </div>
                    <div className="text-xs text-sky-300 truncate">
                      Now: {ch.currentProgram?.title || ch.categoryName}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Movies & Series Row */}
            <div className="space-y-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center space-x-2">
                <Film className="w-4 h-4" />
                <span>Featured Movies & Series</span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {movies.map((mv) => (
                  <button
                    key={mv.id}
                    onClick={() => handleOpenMovie(mv)}
                    className="group bg-[#0F1626] rounded-2xl overflow-hidden border border-slate-800 hover:border-amber-400 text-left transition-all focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <div className="aspect-[2/3] bg-slate-900 relative overflow-hidden">
                      {mv.poster && (
                        <img
                          src={mv.poster}
                          alt={mv.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      )}
                      {mv.rating && (
                        <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/80 text-amber-400 text-xs font-bold">
                          ★ {mv.rating.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="font-bold text-sm text-white truncate">
                        {mv.name}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {mv.year} • {mv.categoryName}
                      </div>
                    </div>
                  </button>
                ))}
                {series.map((sr) => (
                  <button
                    key={sr.id}
                    onClick={() => handleOpenSeries(sr)}
                    className="group bg-[#0F1626] rounded-2xl overflow-hidden border border-slate-800 hover:border-indigo-400 text-left transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    <div className="aspect-[2/3] bg-slate-900 relative overflow-hidden">
                      {sr.poster && (
                        <img
                          src={sr.poster}
                          alt={sr.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      )}
                      <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-bold uppercase">
                        Series • {sr.seasons.length} Seasons
                      </span>
                    </div>
                    <div className="p-3">
                      <div className="font-bold text-sm text-white truncate">
                        {sr.name}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {sr.categoryName}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* LIVE TV & EPG GUIDE TAB */}
        {activeTab === 'live' && (
          <div className="h-full grid grid-cols-12 gap-5 overflow-hidden">
            {/* Categories Column */}
            <div className="col-span-3 bg-[#0F1626] border border-slate-800 rounded-2xl p-4 overflow-y-auto space-y-1.5">
              <div className="text-xs font-bold uppercase text-slate-400 px-2 pb-2">
                Live Categories
              </div>
              <button
                onClick={() => setSelectedLiveCat('all')}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold ${
                  selectedLiveCat === 'all'
                    ? 'bg-sky-500 text-slate-950'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                All Channels ({liveChannels.length})
              </button>
              {liveCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    if (cat.isAdult && settings.parentalEnabled && !settings.unlockedSession) {
                      requestAdultAccess(() => setSelectedLiveCat(cat.id));
                    } else {
                      setSelectedLiveCat(cat.id);
                    }
                  }}
                  className={`w-full flex items-center justify-between text-left px-3.5 py-2.5 rounded-xl text-xs font-bold ${
                    selectedLiveCat === cat.id
                      ? 'bg-sky-500 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span className="truncate">{cat.name}</span>
                  {cat.isAdult && <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                </button>
              ))}
            </div>

            {/* Channel List Column */}
            <div className="col-span-5 bg-[#0F1626] border border-slate-800 rounded-2xl p-4 overflow-y-auto space-y-2">
              <div className="text-xs font-bold uppercase text-slate-400 px-2 pb-1">
                Channels ({filteredLive.length})
              </div>
              {filteredLive.map((ch, idx) => (
                <div
                  key={ch.id}
                  onFocus={() => setPreviewChannel(ch)}
                  onMouseEnter={() => setPreviewChannel(ch)}
                  onClick={() => handleLaunchChannel(ch)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleLaunchChannel(ch);
                  }}
                  className="cursor-pointer flex items-center justify-between p-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    <span className="text-xs font-mono text-slate-500 w-6">
                      {idx + 1}
                    </span>
                    {ch.logo ? (
                      <img
                        src={ch.logo}
                        alt={ch.name}
                        className="w-10 h-10 rounded-lg object-cover bg-slate-950 shrink-0"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                        <Tv className="w-5 h-5 text-sky-400" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-white truncate">
                        {ch.name}
                      </div>
                      <div className="text-xs text-sky-400 truncate">
                        {ch.currentProgram?.title || ch.categoryName}
                      </div>
                    </div>
                  </div>
                  <Play className="w-4 h-4 text-sky-400 shrink-0 ml-2" />
                </div>
              ))}
            </div>

            {/* EPG & Channel Details Column */}
            <div className="col-span-4 bg-[#0F1626] border border-slate-800 rounded-2xl p-5 flex flex-col justify-between">
              {previewChannel ? (
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    {previewChannel.logo && (
                      <img
                        src={previewChannel.logo}
                        alt={previewChannel.name}
                        className="w-14 h-14 rounded-xl object-cover"
                      />
                    )}
                    <div>
                      <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[10px] font-bold uppercase">
                        {previewChannel.categoryName}
                      </span>
                      <h3 className="text-lg font-extrabold text-white mt-0.5">
                        {previewChannel.name}
                      </h3>
                    </div>
                  </div>

                  {/* Now Playing EPG Card */}
                  <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                    <div className="text-xs font-bold uppercase text-emerald-400">
                      Now Broadcasting
                    </div>
                    <div className="font-bold text-white text-sm">
                      {previewChannel.currentProgram?.title || 'Live Broadcast Stream'}
                    </div>
                    <p className="text-xs text-slate-400">
                      {previewChannel.currentProgram?.description ||
                        'Multi-track HLS / MPEG-TS broadcast with selectable audio and subtitle tracks.'}
                    </p>
                  </div>

                  {/* Next Program EPG Card */}
                  {previewChannel.nextProgram && (
                    <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                      <div className="text-xs font-bold uppercase text-amber-400">
                        Up Next
                      </div>
                      <div className="font-bold text-slate-200 text-sm">
                        {previewChannel.nextProgram.title}
                      </div>
                      <p className="text-xs text-slate-400">
                        {previewChannel.nextProgram.description}
                      </p>
                    </div>
                  )}
                </div>
              ) : null}

              {previewChannel && (
                <button
                  onClick={() => handleLaunchChannel(previewChannel)}
                  className="w-full py-3.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-sm flex items-center justify-center space-x-2 focus:ring-4 focus:ring-white"
                >
                  <Play className="w-5 h-5 fill-slate-950" />
                  <span>Watch Fullscreen Live TV</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* MOVIES (VOD) TAB */}
        {activeTab === 'movies' && (
          <div className="h-full flex flex-col space-y-4 overflow-hidden">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedMovieCat('all')}
                className={`px-4 py-2 rounded-xl text-xs font-bold ${
                  selectedMovieCat === 'all'
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-[#0F1626] text-slate-300 border border-slate-800'
                }`}
              >
                All Movies ({movies.length})
              </button>
              {movieCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedMovieCat(cat.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold ${
                    selectedMovieCat === cat.id
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-[#0F1626] text-slate-300 border border-slate-800'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 pr-2">
              {filteredMovies.map((mv) => (
                <button
                  key={mv.id}
                  onClick={() => handleOpenMovie(mv)}
                  className="group bg-[#0F1626] rounded-2xl overflow-hidden border border-slate-800 hover:border-amber-400 text-left flex flex-col focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <div className="aspect-[2/3] bg-slate-900 relative overflow-hidden">
                    {mv.poster ? (
                      <img
                        src={mv.poster}
                        alt={mv.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Film className="w-10 h-10 text-slate-700" />
                      </div>
                    )}
                    {mv.rating && (
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/80 text-amber-400 text-xs font-bold flex items-center space-x-1">
                        <Star className="w-3 h-3 fill-amber-400" />
                        <span>{mv.rating.toFixed(1)}</span>
                      </span>
                    )}
                  </div>
                  <div className="p-3.5">
                    <div className="font-bold text-sm text-white truncate">
                      {mv.name}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {mv.year || 'VOD'} • {mv.categoryName}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TV SERIES TAB */}
        {activeTab === 'series' && (
          <div className="h-full flex flex-col space-y-4 overflow-hidden">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedSeriesCat('all')}
                className={`px-4 py-2 rounded-xl text-xs font-bold ${
                  selectedSeriesCat === 'all'
                    ? 'bg-indigo-500 text-white'
                    : 'bg-[#0F1626] text-slate-300 border border-slate-800'
                }`}
              >
                All Series ({series.length})
              </button>
              {seriesCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedSeriesCat(cat.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold ${
                    selectedSeriesCat === cat.id
                      ? 'bg-indigo-500 text-white'
                      : 'bg-[#0F1626] text-slate-300 border border-slate-800'
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 pr-2">
              {filteredSeries.map((sr) => (
                <button
                  key={sr.id}
                  onClick={() => handleOpenSeries(sr)}
                  className="group bg-[#0F1626] rounded-2xl overflow-hidden border border-slate-800 hover:border-indigo-400 text-left flex flex-col focus:outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  <div className="aspect-[2/3] bg-slate-900 relative overflow-hidden">
                    {sr.poster ? (
                      <img
                        src={sr.poster}
                        alt={sr.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Clapperboard className="w-10 h-10 text-slate-700" />
                      </div>
                    )}
                    <span className="absolute bottom-2 left-2 px-2.5 py-0.5 rounded bg-indigo-600/90 text-white text-xs font-bold">
                      {sr.seasons.length} Seasons
                    </span>
                  </div>
                  <div className="p-3.5">
                    <div className="font-bold text-sm text-white truncate">
                      {sr.name}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {sr.categoryName}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* GLOBAL SEARCH TAB */}
        {activeTab === 'search' && <GlobalSearchView />}

        {/* FAVORITES TAB */}
        {activeTab === 'favorites' && (
          <div className="h-full overflow-y-auto space-y-6 pr-2">
            <h2 className="text-xl font-extrabold text-white flex items-center space-x-2">
              <Heart className="w-6 h-6 text-rose-500 fill-rose-500" />
              <span>Your Saved Favorites ({favoriteIds.length})</span>
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveChannels
                .filter((c) => favoriteIds.includes(c.id))
                .map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => handleLaunchChannel(ch)}
                    className="flex items-center justify-between p-4 rounded-2xl bg-[#0F1626] border border-slate-800 hover:border-sky-400 text-left"
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase text-sky-400">
                        Live Channel
                      </span>
                      <div className="font-bold text-white">{ch.name}</div>
                    </div>
                    <Play className="w-5 h-5 text-sky-400" />
                  </button>
                ))}

              {movies
                .filter((m) => favoriteIds.includes(m.id))
                .map((mv) => (
                  <button
                    key={mv.id}
                    onClick={() => handleOpenMovie(mv)}
                    className="flex items-center justify-between p-4 rounded-2xl bg-[#0F1626] border border-slate-800 hover:border-amber-400 text-left"
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase text-amber-400">
                        Movie VOD
                      </span>
                      <div className="font-bold text-white">{mv.name}</div>
                    </div>
                    <Play className="w-5 h-5 text-amber-400" />
                  </button>
                ))}

              {series
                .filter((s) => favoriteIds.includes(s.id))
                .map((sr) => (
                  <button
                    key={sr.id}
                    onClick={() => handleOpenSeries(sr)}
                    className="flex items-center justify-between p-4 rounded-2xl bg-[#0F1626] border border-slate-800 hover:border-indigo-400 text-left"
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase text-indigo-400">
                        TV Series
                      </span>
                      <div className="font-bold text-white">{sr.name}</div>
                    </div>
                    <Play className="w-5 h-5 text-indigo-400" />
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* PLAYLISTS TAB */}
        {activeTab === 'playlists' && <PlaylistsView />}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && <SettingsView />}
      </main>

      {/* Movie / Series Detail Modal */}
      {(selectedMovie || selectedSeries) && (
        <MediaDetailModal
          movie={selectedMovie}
          series={selectedSeries}
          onClose={() => {
            setSelectedMovie(null);
            setSelectedSeries(null);
          }}
        />
      )}

      {/* Parental Control PIN Modal */}
      <ParentalPinModal />

      {/* Fullscreen Hybrid Video Player */}
      {activeMedia && (
        <VideoPlayer
          media={activeMedia}
          onClose={() => setActiveMedia(null)}
        />
      )}
    </div>
  );
};
