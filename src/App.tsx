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
  Filter,
  ChevronDown,
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

const PAGE_SIZE = 60;

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
    loadProfileCatalog,
    isLoadingPlaylist,
  } = useAppStore();

  // Category selections
  const [selectedLiveCat, setSelectedLiveCat] = useState<string>('all');
  const [selectedMovieCat, setSelectedMovieCat] = useState<string>('all');
  const [selectedSeriesCat, setSelectedSeriesCat] = useState<string>('all');

  // Quick search/filter inputs inside Live / Movies / Series tabs
  const [liveCatQuery, setLiveCatQuery] = useState('');
  const [liveItemQuery, setLiveItemQuery] = useState('');
  const [movieCatQuery, setMovieCatQuery] = useState('');
  const [movieItemQuery, setMovieItemQuery] = useState('');
  const [movieSort, setMovieSort] = useState<'default' | 'rating' | 'year' | 'name'>('default');
  const [seriesCatQuery, setSeriesCatQuery] = useState('');
  const [seriesItemQuery, setSeriesItemQuery] = useState('');
  const [seriesSort, setSeriesSort] = useState<'default' | 'rating' | 'name'>('default');

  // Pagination limits so 50,000+ item playlists never lag the DOM
  const [livePageLimit, setLivePageLimit] = useState(100);
  const [moviePageLimit, setMoviePageLimit] = useState(PAGE_SIZE);
  const [seriesPageLimit, setSeriesPageLimit] = useState(PAGE_SIZE);

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

  // Automatically sync active Xtream/M3U profile on initial app startup
  useEffect(() => {
    if (activeProfileId && activeProfileId !== 'demo-profile') {
      loadProfileCatalog(activeProfileId);
    }
  }, []);

  useEffect(() => {
    if (liveChannels.length > 0) {
      setPreviewChannel(liveChannels[0]);
    }
    setSelectedLiveCat('all');
    setSelectedMovieCat('all');
    setSelectedSeriesCat('all');
    setLivePageLimit(100);
    setMoviePageLimit(PAGE_SIZE);
    setSeriesPageLimit(PAGE_SIZE);
  }, [activeProfileId, liveChannels.length]);

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

  // Compute item counts per category for fast sidebar badges
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of liveChannels) {
      counts.set(`live:${c.categoryId}`, (counts.get(`live:${c.categoryId}`) || 0) + 1);
    }
    for (const m of movies) {
      counts.set(`movie:${m.categoryId}`, (counts.get(`movie:${m.categoryId}`) || 0) + 1);
    }
    for (const s of series) {
      counts.set(`series:${s.categoryId}`, (counts.get(`series:${s.categoryId}`) || 0) + 1);
    }
    return counts;
  }, [liveChannels, movies, series]);

  const customAdultSet = useMemo(
    () => new Set(settings.customAdultCategoryIds || []),
    [settings.customAdultCategoryIds]
  );

  const isAdultCat = (type: string, catId: string, catIsAdult?: boolean) =>
    Boolean(catIsAdult) || customAdultSet.has(`${type}:${catId}`);

  const liveCategories = useMemo(
    () =>
      categories
        .filter((c) => c.type === 'live')
        .filter((c) =>
          settings.showAdultInMainMenus ? true : !isAdultCat('live', c.id, c.isAdult)
        )
        .filter((c) =>
          liveCatQuery.trim()
            ? c.name.toLowerCase().includes(liveCatQuery.trim().toLowerCase())
            : true
        ),
    [categories, liveCatQuery, settings.showAdultInMainMenus, customAdultSet]
  );

  const movieCategories = useMemo(
    () =>
      categories
        .filter((c) => c.type === 'movie')
        .filter((c) =>
          settings.showAdultInMainMenus ? true : !isAdultCat('movie', c.id, c.isAdult)
        )
        .filter((c) =>
          movieCatQuery.trim()
            ? c.name.toLowerCase().includes(movieCatQuery.trim().toLowerCase())
            : true
        ),
    [categories, movieCatQuery, settings.showAdultInMainMenus, customAdultSet]
  );

  const seriesCategories = useMemo(
    () =>
      categories
        .filter((c) => c.type === 'series')
        .filter((c) =>
          settings.showAdultInMainMenus ? true : !isAdultCat('series', c.id, c.isAdult)
        )
        .filter((c) =>
          seriesCatQuery.trim()
            ? c.name.toLowerCase().includes(seriesCatQuery.trim().toLowerCase())
            : true
        ),
    [categories, seriesCatQuery, settings.showAdultInMainMenus, customAdultSet]
  );

  const filteredLive = useMemo(() => {
    const q = liveItemQuery.trim().toLowerCase();
    return liveChannels.filter((c) => {
      const adultItem = Boolean(c.isAdult) || customAdultSet.has(`live:${c.categoryId}`);
      if (!settings.showAdultInMainMenus && adultItem) return false;
      if (selectedLiveCat !== 'all' && c.categoryId !== selectedLiveCat) return false;
      if (!settings.unlockedSession && settings.parentalEnabled && adultItem && selectedLiveCat === 'all') {
        return false;
      }
      if (q && !c.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [
    liveChannels,
    selectedLiveCat,
    liveItemQuery,
    settings.unlockedSession,
    settings.parentalEnabled,
    settings.showAdultInMainMenus,
    customAdultSet,
  ]);

  const filteredMovies = useMemo(() => {
    const q = movieItemQuery.trim().toLowerCase();
    const list = movies.filter((m) => {
      const adultItem = Boolean(m.isAdult) || customAdultSet.has(`movie:${m.categoryId}`);
      if (!settings.showAdultInMainMenus && adultItem) return false;
      if (selectedMovieCat === 'recent') return true;
      if (selectedMovieCat === 'top_rated') return (m.rating || 0) >= 7.5;
      if (selectedMovieCat !== 'all' && m.categoryId !== selectedMovieCat) return false;
      if (!settings.unlockedSession && settings.parentalEnabled && adultItem && selectedMovieCat === 'all') {
        return false;
      }
      if (q && !m.name.toLowerCase().includes(q)) return false;
      return true;
    });

    if (selectedMovieCat === 'recent') {
      return [...list].sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    }
    if (movieSort === 'rating' || selectedMovieCat === 'top_rated') {
      return [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    if (movieSort === 'year') {
      return [...list].sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
    }
    if (movieSort === 'name') {
      return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [
    movies,
    selectedMovieCat,
    movieItemQuery,
    movieSort,
    settings.unlockedSession,
    settings.parentalEnabled,
    settings.showAdultInMainMenus,
    customAdultSet,
  ]);

  const filteredSeries = useMemo(() => {
    const q = seriesItemQuery.trim().toLowerCase();
    const list = series.filter((s) => {
      const adultItem = Boolean(s.isAdult) || customAdultSet.has(`series:${s.categoryId}`);
      if (!settings.showAdultInMainMenus && adultItem) return false;
      if (selectedSeriesCat === 'top_rated') return (s.rating || 0) >= 7.5;
      if (selectedSeriesCat !== 'all' && s.categoryId !== selectedSeriesCat) return false;
      if (!settings.unlockedSession && settings.parentalEnabled && adultItem && selectedSeriesCat === 'all') {
        return false;
      }
      if (q && !s.name.toLowerCase().includes(q)) return false;
      return true;
    });

    if (seriesSort === 'rating' || selectedSeriesCat === 'top_rated') {
      return [...list].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    }
    if (seriesSort === 'name') {
      return [...list].sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [
    series,
    selectedSeriesCat,
    seriesItemQuery,
    seriesSort,
    settings.unlockedSession,
    settings.parentalEnabled,
    settings.showAdultInMainMenus,
    customAdultSet,
  ]);

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

  const activeMovieCategoryTitle =
    selectedMovieCat === 'all'
      ? 'All Movies'
      : selectedMovieCat === 'recent'
        ? 'Recently Added Movies'
        : selectedMovieCat === 'top_rated'
          ? 'Top Rated Movies (7.5+)'
          : categories.find((c) => c.id === selectedMovieCat && c.type === 'movie')?.name || 'Movies';

  const activeSeriesCategoryTitle =
    selectedSeriesCat === 'all'
      ? 'All TV Series'
      : selectedSeriesCat === 'top_rated'
        ? 'Top Rated TV Series (7.5+)'
        : categories.find((c) => c.id === selectedSeriesCat && c.type === 'series')?.name || 'TV Series';

  return (
    <div className="w-screen h-screen bg-[#070B14] text-slate-100 flex overflow-hidden">
      {/* Left 10-Foot TV Navigation Rail */}
      <aside className="w-60 bg-[#0B101E] border-r border-slate-800/80 flex flex-col justify-between p-4 shrink-0">
        <div className="space-y-5">
          {/* App Brand Logo */}
          <div className="flex items-center space-x-3 px-2">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-sky-400 to-indigo-600 flex items-center justify-center shadow-lg shadow-sky-500/20">
              <Tv className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="font-extrabold text-base tracking-tight text-white leading-none">
                KERLOY IPTV
              </div>
              <div className="text-[11px] font-semibold text-sky-400 mt-1">
                LG webOS 5.x+ Edition
              </div>
            </div>
          </div>

          {/* Navigation Buttons */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-bold text-sm transition-all focus:outline-none focus:ring-2 focus:ring-sky-400 ${
                    isActive
                      ? 'bg-gradient-to-r from-sky-500 to-indigo-500 text-slate-950 shadow-md shadow-sky-500/20'
                      : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </div>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                        isActive
                          ? 'bg-slate-950/25 text-slate-950'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {item.badge > 9999
                        ? `${(item.badge / 1000).toFixed(1)}k`
                        : item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Active Profile Pill */}
        <div className="p-3 rounded-2xl bg-[#11192E] border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-slate-400">
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
      <main className="flex-1 flex flex-col p-6 overflow-hidden relative">
        {isLoadingPlaylist && (
          <div className="mb-4 px-4 py-2.5 rounded-xl bg-sky-500/15 border border-sky-400/40 text-sky-300 text-xs font-bold flex items-center justify-between shrink-0">
            <span>Syncing Xtream Codes Live TV, Movies & TV Series catalog...</span>
            <span className="animate-pulse">Loading...</span>
          </div>
        )}
        {/* HOME TAB */}
        {activeTab === 'home' && (
          <div className="h-full overflow-y-auto pr-2 space-y-6">
            {/* Hero Spotlight Banner */}
            {movies[0] && (
              <div className="relative rounded-3xl overflow-hidden border border-slate-800 bg-gradient-to-r from-[#0F172A] via-[#131D38] to-[#0F172A] p-7 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl">
                <div className="space-y-3.5 max-w-2xl z-10">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                    <span className="px-3 py-1 rounded-full bg-sky-500 text-slate-950 flex items-center space-x-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>FEATURED SPOTLIGHT</span>
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

                  <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                    {movies[0].name}
                  </h1>
                  <p className="text-sm text-slate-300 line-clamp-2">
                    {movies[0].plot || `Category: ${movies[0].categoryName}`}
                  </p>

                  <div className="flex flex-wrap gap-3 pt-1">
                    <button
                      onClick={() => handleOpenMovie(movies[0])}
                      autoFocus
                      className="px-6 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-sm flex items-center space-x-2 focus:ring-4 focus:ring-white"
                    >
                      <Play className="w-5 h-5 fill-slate-950" />
                      <span>Open Movie Details & Play</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('movies')}
                      className="px-5 py-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-300 font-bold text-sm"
                    >
                      Browse All Movies ({movies.length.toLocaleString()})
                    </button>
                    <button
                      onClick={() => setActiveTab('series')}
                      className="px-5 py-3 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/50 text-indigo-300 font-bold text-sm"
                    >
                      Browse TV Series ({series.length.toLocaleString()})
                    </button>
                  </div>
                </div>

                {movies[0].poster && (
                  <img
                    src={movies[0].poster}
                    alt={movies[0].name}
                    className="w-40 h-56 object-cover rounded-2xl border border-slate-700 shadow-2xl shrink-0"
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
                  <span>Live TV Channels ({liveChannels.length.toLocaleString()})</span>
                </h2>
                <button
                  onClick={() => setActiveTab('live')}
                  className="text-xs font-bold text-sky-400 hover:underline"
                >
                  Open Full Live TV Guide →
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {liveChannels.slice(0, 8).map((ch) => (
                  <button
                    key={ch.id}
                    onClick={() => handleLaunchChannel(ch)}
                    className="p-3.5 rounded-2xl bg-[#0F1626] hover:bg-[#162038] border border-slate-800 hover:border-sky-400/70 text-left flex items-center space-x-3 transition-all focus:outline-none focus:ring-2 focus:ring-sky-400"
                  >
                    {ch.logo ? (
                      <img
                        src={ch.logo}
                        alt={ch.name}
                        loading="lazy"
                        className="w-11 h-11 rounded-xl object-cover bg-slate-950 shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-slate-800 flex items-center justify-center shrink-0">
                        <Tv className="w-5 h-5 text-sky-400" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-white text-sm truncate">
                        {ch.name}
                      </div>
                      <div className="text-xs text-sky-300 truncate">
                        {ch.currentProgram?.title || ch.categoryName}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Featured Movies Row (Capped at 10 items for instant rendering) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center space-x-2">
                  <Film className="w-4 h-4" />
                  <span>Featured Movies ({movies.length.toLocaleString()})</span>
                </h2>
                <button
                  onClick={() => setActiveTab('movies')}
                  className="text-xs font-bold text-amber-400 hover:underline"
                >
                  View All Movies & Categories →
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {movies.slice(0, 10).map((mv) => (
                  <button
                    key={mv.id}
                    onClick={() => handleOpenMovie(mv)}
                    className="group bg-[#0F1626] rounded-2xl overflow-hidden border border-slate-800 hover:border-amber-400 text-left transition-all focus:outline-none focus:ring-2 focus:ring-amber-400"
                  >
                    <div className="aspect-[2/3] bg-slate-900 relative overflow-hidden">
                      {mv.poster ? (
                        <img
                          src={mv.poster}
                          alt={mv.name}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Film className="w-10 h-10 text-slate-700" />
                        </div>
                      )}
                      {mv.rating ? (
                        <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/80 text-amber-400 text-xs font-bold">
                          ★ {mv.rating.toFixed(1)}
                        </span>
                      ) : null}
                    </div>
                    <div className="p-3">
                      <div className="font-bold text-sm text-white truncate">
                        {mv.name}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 truncate">
                        {mv.year ? `${mv.year} • ` : ''}
                        {mv.categoryName}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Featured TV Series Row (Capped at 10 items) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-400 flex items-center space-x-2">
                  <Clapperboard className="w-4 h-4" />
                  <span>Featured TV Series ({series.length.toLocaleString()})</span>
                </h2>
                <button
                  onClick={() => setActiveTab('series')}
                  className="text-xs font-bold text-indigo-400 hover:underline"
                >
                  View All Series & Categories →
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {series.slice(0, 10).map((sr) => (
                  <button
                    key={sr.id}
                    onClick={() => handleOpenSeries(sr)}
                    className="group bg-[#0F1626] rounded-2xl overflow-hidden border border-slate-800 hover:border-indigo-400 text-left transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    <div className="aspect-[2/3] bg-slate-900 relative overflow-hidden">
                      {sr.poster ? (
                        <img
                          src={sr.poster}
                          alt={sr.name}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Clapperboard className="w-10 h-10 text-slate-700" />
                        </div>
                      )}
                      <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-bold uppercase">
                        TV Series
                      </span>
                    </div>
                    <div className="p-3">
                      <div className="font-bold text-sm text-white truncate">
                        {sr.name}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 truncate">
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
            {/* Categories Sidebar */}
            <div className="col-span-3 bg-[#0F1626] border border-slate-800 rounded-2xl p-3.5 flex flex-col overflow-hidden">
              <div className="pb-2.5 space-y-2 border-b border-slate-800">
                <div className="text-xs font-bold uppercase text-sky-400 px-1">
                  Live Categories ({liveCategories.length})
                </div>
                <div className="relative">
                  <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={liveCatQuery}
                    onChange={(e) => setLiveCatQuery(e.target.value)}
                    placeholder="Filter categories..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-400"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pt-2 space-y-1 pr-1">
                <button
                  onClick={() => {
                    setSelectedLiveCat('all');
                    setLivePageLimit(100);
                  }}
                  className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-xl text-xs font-bold ${
                    selectedLiveCat === 'all'
                      ? 'bg-sky-500 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span>All Channels</span>
                  <span className="text-[10px] opacity-80">{liveChannels.length}</span>
                </button>
                {liveCategories.map((cat) => {
                  const count = categoryCounts.get(`live:${cat.id}`) || 0;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        const selectCat = () => {
                          setSelectedLiveCat(cat.id);
                          setLivePageLimit(100);
                        };
                        if (cat.isAdult && settings.parentalEnabled && !settings.unlockedSession) {
                          requestAdultAccess(selectCat);
                        } else {
                          selectCat();
                        }
                      }}
                      className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-xl text-xs font-bold ${
                        selectedLiveCat === cat.id
                          ? 'bg-sky-500 text-slate-950'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span className="truncate pr-2">{cat.name}</span>
                      <div className="flex items-center space-x-1 shrink-0">
                        {cat.isAdult && <Lock className="w-3 h-3 text-amber-400" />}
                        <span className="text-[10px] opacity-75">{count}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Channel List Column */}
            <div className="col-span-5 bg-[#0F1626] border border-slate-800 rounded-2xl p-3.5 flex flex-col overflow-hidden">
              <div className="pb-2.5 space-y-2 border-b border-slate-800">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold uppercase text-slate-300">
                    Channels ({filteredLive.length.toLocaleString()})
                  </span>
                </div>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={liveItemQuery}
                    onChange={(e) => {
                      setLiveItemQuery(e.target.value);
                      setLivePageLimit(100);
                    }}
                    placeholder="Search channel in category..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-sky-400"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pt-2 space-y-1.5 pr-1">
                {filteredLive.slice(0, livePageLimit).map((ch, idx) => (
                  <div
                    key={ch.id}
                    onFocus={() => setPreviewChannel(ch)}
                    onMouseEnter={() => setPreviewChannel(ch)}
                    onClick={() => handleLaunchChannel(ch)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleLaunchChannel(ch);
                    }}
                    className="cursor-pointer flex items-center justify-between p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400"
                  >
                    <div className="flex items-center space-x-3 min-w-0">
                      <span className="text-xs font-mono text-slate-500 w-7">
                        {idx + 1}
                      </span>
                      {ch.logo ? (
                        <img
                          src={ch.logo}
                          alt={ch.name}
                          loading="lazy"
                          className="w-9 h-9 rounded-lg object-cover bg-slate-950 shrink-0"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                          <Tv className="w-4 h-4 text-sky-400" />
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

                {filteredLive.length > livePageLimit && (
                  <button
                    onClick={() => setLivePageLimit((l) => l + 100)}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-sky-300 flex items-center justify-center space-x-1.5"
                  >
                    <ChevronDown className="w-4 h-4" />
                    <span>
                      Load More Channels ({filteredLive.length - livePageLimit} remaining)
                    </span>
                  </button>
                )}
              </div>
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
                        className="w-14 h-14 rounded-xl object-cover bg-slate-950"
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

        {/* MOVIES (VOD) TAB — 2-COLUMN SIDEBAR + PAGINATED POSTER GRID */}
        {activeTab === 'movies' && (
          <div className="h-full grid grid-cols-12 gap-5 overflow-hidden">
            {/* Left Movie Categories Sidebar */}
            <div className="col-span-3 bg-[#0F1626] border border-slate-800 rounded-2xl p-3.5 flex flex-col overflow-hidden">
              <div className="pb-2.5 space-y-2 border-b border-slate-800">
                <div className="text-xs font-bold uppercase text-amber-400 px-1">
                  Movie Categories ({movieCategories.length})
                </div>
                <div className="relative">
                  <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={movieCatQuery}
                    onChange={(e) => setMovieCatQuery(e.target.value)}
                    placeholder="Filter categories..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pt-2 space-y-1 pr-1">
                <button
                  onClick={() => {
                    setSelectedMovieCat('all');
                    setMoviePageLimit(PAGE_SIZE);
                  }}
                  className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-xl text-xs font-bold ${
                    selectedMovieCat === 'all'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span>All Movies</span>
                  <span className="text-[10px] opacity-80">{movies.length}</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedMovieCat('recent');
                    setMoviePageLimit(PAGE_SIZE);
                  }}
                  className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-xl text-xs font-bold ${
                    selectedMovieCat === 'recent'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span>Recently Added</span>
                  <Clock className="w-3.5 h-3.5 opacity-80" />
                </button>

                <button
                  onClick={() => {
                    setSelectedMovieCat('top_rated');
                    setMoviePageLimit(PAGE_SIZE);
                  }}
                  className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-xl text-xs font-bold ${
                    selectedMovieCat === 'top_rated'
                      ? 'bg-amber-500 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span>Top Rated (★ 7.5+)</span>
                  <Star className="w-3.5 h-3.5 opacity-80" />
                </button>

                <div className="pt-1 border-t border-slate-800/80" />

                {movieCategories.map((cat) => {
                  const count = categoryCounts.get(`movie:${cat.id}`) || 0;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        const selectCat = () => {
                          setSelectedMovieCat(cat.id);
                          setMoviePageLimit(PAGE_SIZE);
                        };
                        if (cat.isAdult && settings.parentalEnabled && !settings.unlockedSession) {
                          requestAdultAccess(selectCat);
                        } else {
                          selectCat();
                        }
                      }}
                      className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-xl text-xs font-bold ${
                        selectedMovieCat === cat.id
                          ? 'bg-amber-500 text-slate-950'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span className="truncate pr-2">{cat.name}</span>
                      <div className="flex items-center space-x-1 shrink-0">
                        {cat.isAdult && <Lock className="w-3 h-3 text-amber-300" />}
                        <span className="text-[10px] opacity-75">{count}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Movie Poster Grid */}
            <div className="col-span-9 flex flex-col overflow-hidden space-y-4">
              {/* Top Filter & Sort Bar */}
              <div className="bg-[#0F1626] border border-slate-800 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold text-white">
                    {activeMovieCategoryTitle}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Showing {Math.min(moviePageLimit, filteredMovies.length)} of{' '}
                    {filteredMovies.length.toLocaleString()} movies
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative w-60">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={movieItemQuery}
                      onChange={(e) => {
                        setMovieItemQuery(e.target.value);
                        setMoviePageLimit(PAGE_SIZE);
                      }}
                      placeholder="Filter movies by title..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div className="flex items-center space-x-1 bg-slate-950 border border-slate-800 rounded-xl p-1">
                    {(
                      [
                        { id: 'default', label: 'Default' },
                        { id: 'rating', label: '★ Rating' },
                        { id: 'year', label: 'Year' },
                        { id: 'name', label: 'A–Z' },
                      ] as const
                    ).map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setMovieSort(s.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                          movieSort === s.id
                            ? 'bg-amber-500 text-slate-950'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Scrollable Poster Grid */}
              <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                  {filteredMovies.slice(0, moviePageLimit).map((mv) => (
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
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Film className="w-10 h-10 text-slate-700" />
                          </div>
                        )}
                        {mv.rating ? (
                          <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/80 text-amber-400 text-xs font-bold flex items-center space-x-1">
                            <Star className="w-3 h-3 fill-amber-400" />
                            <span>{mv.rating.toFixed(1)}</span>
                          </span>
                        ) : null}
                        <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-slate-200 text-[10px] font-bold uppercase">
                          {mv.containerExtension}
                        </span>
                      </div>
                      <div className="p-3">
                        <div className="font-bold text-sm text-white truncate">
                          {mv.name}
                        </div>
                        <div className="text-xs text-slate-400 mt-1 truncate">
                          {mv.year ? `${mv.year} • ` : ''}
                          {mv.categoryName}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {filteredMovies.length > moviePageLimit && (
                  <button
                    onClick={() => setMoviePageLimit((l) => l + PAGE_SIZE)}
                    className="w-full py-3.5 rounded-2xl bg-[#0F1626] hover:bg-slate-800 border border-slate-700 text-amber-400 font-bold text-sm flex items-center justify-center space-x-2"
                  >
                    <ChevronDown className="w-5 h-5" />
                    <span>
                      Load More Movies (
                      {(filteredMovies.length - moviePageLimit).toLocaleString()}{' '}
                      remaining)
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TV SERIES TAB — 2-COLUMN SIDEBAR + PAGINATED POSTER GRID */}
        {activeTab === 'series' && (
          <div className="h-full grid grid-cols-12 gap-5 overflow-hidden">
            {/* Left Series Categories Sidebar */}
            <div className="col-span-3 bg-[#0F1626] border border-slate-800 rounded-2xl p-3.5 flex flex-col overflow-hidden">
              <div className="pb-2.5 space-y-2 border-b border-slate-800">
                <div className="text-xs font-bold uppercase text-indigo-400 px-1">
                  Series Categories ({seriesCategories.length})
                </div>
                <div className="relative">
                  <Filter className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={seriesCatQuery}
                    onChange={(e) => setSeriesCatQuery(e.target.value)}
                    placeholder="Filter categories..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-400"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto pt-2 space-y-1 pr-1">
                <button
                  onClick={() => {
                    setSelectedSeriesCat('all');
                    setSeriesPageLimit(PAGE_SIZE);
                  }}
                  className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-xl text-xs font-bold ${
                    selectedSeriesCat === 'all'
                      ? 'bg-indigo-500 text-white'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span>All TV Series</span>
                  <span className="text-[10px] opacity-80">{series.length}</span>
                </button>

                <button
                  onClick={() => {
                    setSelectedSeriesCat('top_rated');
                    setSeriesPageLimit(PAGE_SIZE);
                  }}
                  className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-xl text-xs font-bold ${
                    selectedSeriesCat === 'top_rated'
                      ? 'bg-indigo-500 text-white'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <span>Top Rated (★ 7.5+)</span>
                  <Star className="w-3.5 h-3.5 opacity-80" />
                </button>

                <div className="pt-1 border-t border-slate-800/80" />

                {seriesCategories.map((cat) => {
                  const count = categoryCounts.get(`series:${cat.id}`) || 0;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => {
                        const selectCat = () => {
                          setSelectedSeriesCat(cat.id);
                          setSeriesPageLimit(PAGE_SIZE);
                        };
                        if (cat.isAdult && settings.parentalEnabled && !settings.unlockedSession) {
                          requestAdultAccess(selectCat);
                        } else {
                          selectCat();
                        }
                      }}
                      className={`w-full flex items-center justify-between text-left px-3 py-2 rounded-xl text-xs font-bold ${
                        selectedSeriesCat === cat.id
                          ? 'bg-indigo-500 text-white'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span className="truncate pr-2">{cat.name}</span>
                      <div className="flex items-center space-x-1 shrink-0">
                        {cat.isAdult && <Lock className="w-3 h-3 text-amber-300" />}
                        <span className="text-[10px] opacity-75">{count}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Series Poster Grid */}
            <div className="col-span-9 flex flex-col overflow-hidden space-y-4">
              {/* Top Filter & Sort Bar */}
              <div className="bg-[#0F1626] border border-slate-800 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-extrabold text-white">
                    {activeSeriesCategoryTitle}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Showing {Math.min(seriesPageLimit, filteredSeries.length)} of{' '}
                    {filteredSeries.length.toLocaleString()} series
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="relative w-60">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={seriesItemQuery}
                      onChange={(e) => {
                        setSeriesItemQuery(e.target.value);
                        setSeriesPageLimit(PAGE_SIZE);
                      }}
                      placeholder="Filter series by title..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-400"
                    />
                  </div>

                  <div className="flex items-center space-x-1 bg-slate-950 border border-slate-800 rounded-xl p-1">
                    {(
                      [
                        { id: 'default', label: 'Default' },
                        { id: 'rating', label: '★ Rating' },
                        { id: 'name', label: 'A–Z' },
                      ] as const
                    ).map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSeriesSort(s.id)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                          seriesSort === s.id
                            ? 'bg-indigo-500 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Scrollable Series Grid */}
              <div className="flex-1 overflow-y-auto pr-2 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
                  {filteredSeries.slice(0, seriesPageLimit).map((sr) => (
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
                            loading="lazy"
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Clapperboard className="w-10 h-10 text-slate-700" />
                          </div>
                        )}
                        {sr.rating ? (
                          <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/80 text-amber-400 text-xs font-bold flex items-center space-x-1">
                            <Star className="w-3 h-3 fill-amber-400" />
                            <span>{sr.rating.toFixed(1)}</span>
                          </span>
                        ) : null}
                        <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-indigo-600/90 text-white text-[10px] font-bold uppercase">
                          Series
                        </span>
                      </div>
                      <div className="p-3">
                        <div className="font-bold text-sm text-white truncate">
                          {sr.name}
                        </div>
                        <div className="text-xs text-slate-400 mt-1 truncate">
                          {sr.categoryName}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>

                {filteredSeries.length > seriesPageLimit && (
                  <button
                    onClick={() => setSeriesPageLimit((l) => l + PAGE_SIZE)}
                    className="w-full py-3.5 rounded-2xl bg-[#0F1626] hover:bg-slate-800 border border-slate-700 text-indigo-400 font-bold text-sm flex items-center justify-center space-x-2"
                  >
                    <ChevronDown className="w-5 h-5" />
                    <span>
                      Load More Series (
                      {(filteredSeries.length - seriesPageLimit).toLocaleString()}{' '}
                      remaining)
                    </span>
                  </button>
                )}
              </div>
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
