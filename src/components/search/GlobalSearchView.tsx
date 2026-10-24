import React, { useState, useMemo } from 'react';
import {
  Search,
  Tv,
  Film,
  Clapperboard,
  Star,
  Delete,
  Sparkles,
  Play,
  Heart,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { executeGlobalSearch } from '../../services/search/searchEngine';
import type { LiveChannel, MediaType, MovieItem, SeriesItem } from '../../types/iptv';

const KEYBOARD_ROWS = [
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
  ['K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'],
  ['U', 'V', 'W', 'X', 'Y', 'Z', '0', '1', '2', '3'],
  ['4', '5', '6', '7', '8', '9', 'SPACE', 'BACK', 'CLEAR'],
];

export const GlobalSearchView: React.FC = () => {
  const {
    liveChannels,
    movies,
    series,
    favoriteIds,
    settings,
    setActiveMedia,
    setSelectedMovie,
    setSelectedSeries,
    requestAdultAccess,
  } = useAppStore();

  const [query, setQuery] = useState('');
  const [mediaType, setMediaType] = useState<'all' | MediaType>('all');
  const [minRating, setMinRating] = useState<number>(0);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [showVirtualKeyboard, setShowVirtualKeyboard] = useState(true);

  const favSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const results = useMemo(() => {
    return executeGlobalSearch(
      { liveChannels, movies, series },
      {
        query,
        mediaType,
        minRating: minRating > 0 ? minRating : undefined,
        favoritesOnly,
        favoriteIds: favSet,
        includeAdult: !settings.parentalEnabled || settings.unlockedSession,
        maxResults: 48,
      }
    );
  }, [
    liveChannels,
    movies,
    series,
    query,
    mediaType,
    minRating,
    favoritesOnly,
    favSet,
    settings.parentalEnabled,
    settings.unlockedSession,
  ]);

  const handleVirtualKey = (key: string) => {
    if (key === 'SPACE') {
      setQuery((q) => `${q} `);
    } else if (key === 'BACK') {
      setQuery((q) => q.slice(0, -1));
    } else if (key === 'CLEAR') {
      setQuery('');
    } else {
      setQuery((q) => `${q}${key.toLowerCase()}`);
    }
  };

  const handlePlayLive = (ch: LiveChannel) => {
    const launch = () =>
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
      requestAdultAccess(launch);
    } else {
      launch();
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

  return (
    <div className="h-full flex flex-col space-y-5 overflow-hidden">
      {/* Search Input & Filter Bar */}
      <div className="bg-[#0F1626] border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[280px]">
            <Search className="w-5 h-5 text-sky-400 absolute left-4 top-3.5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Live TV channels, Movies, TV Series, Cast, Genre, Year..."
              className="w-full pl-12 pr-10 py-3 rounded-xl bg-slate-950 border border-slate-700 text-white text-base focus:outline-none focus:border-sky-400"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-3 text-slate-400 hover:text-white"
              >
                <Delete className="w-5 h-5" />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowVirtualKeyboard((v) => !v)}
            className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 border border-slate-700 focus:ring-2 focus:ring-sky-400"
          >
            {showVirtualKeyboard ? 'Hide TV Keyboard' : 'Show TV Keyboard'}
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                { id: 'all', label: `All (${results.totalCount})` },
                { id: 'live', label: `Live TV (${results.live.length})` },
                { id: 'movie', label: `Movies (${results.movies.length})` },
                { id: 'series', label: `Series (${results.series.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setMediaType(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all focus:ring-2 focus:ring-sky-400 ${
                  mediaType === tab.id
                    ? 'bg-sky-500 text-slate-950'
                    : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}

            <button
              onClick={() => setFavoritesOnly((f) => !f)}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 border focus:ring-2 focus:ring-sky-400 ${
                favoritesOnly
                  ? 'bg-rose-500/20 border-rose-400 text-rose-300'
                  : 'bg-slate-900 border-slate-800 text-slate-300'
              }`}
            >
              <Heart className="w-3.5 h-3.5" />
              <span>Favorites Only</span>
            </button>

            <button
              onClick={() => setMinRating((r) => (r === 8 ? 0 : 8))}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 border focus:ring-2 focus:ring-sky-400 ${
                minRating >= 8
                  ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                  : 'bg-slate-900 border-slate-800 text-slate-300'
              }`}
            >
              <Star className="w-3.5 h-3.5" />
              <span>Top Rated (8.0+)</span>
            </button>
          </div>
        </div>

        {/* On-Screen D-Pad Virtual Keyboard */}
        {showVirtualKeyboard && (
          <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
            {KEYBOARD_ROWS.map((row, rIdx) => (
              <div key={rIdx} className="flex flex-wrap gap-1.5">
                {row.map((key) => {
                  const isWide = key.length > 1;
                  return (
                    <button
                      key={key}
                      onClick={() => handleVirtualKey(key)}
                      className={`${
                        isWide ? 'px-4 bg-slate-800 text-sky-300' : 'w-10 bg-slate-900 text-white'
                      } h-9 rounded-lg border border-slate-700/80 hover:bg-sky-500 hover:text-slate-950 font-bold text-xs transition-colors focus:outline-none focus:ring-2 focus:ring-sky-400`}
                    >
                      {key}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Results Area */}
      <div className="flex-1 overflow-y-auto space-y-6 pr-2">
        {results.totalCount === 0 && (
          <div className="bg-[#0F1626] border border-slate-800 rounded-2xl p-12 text-center space-y-2">
            <Sparkles className="w-10 h-10 text-slate-500 mx-auto" />
            <h3 className="text-lg font-bold text-white">No Matching Streams Found</h3>
            <p className="text-sm text-slate-400">
              Try clearing a filter or searching by partial title, genre, or actor name.
            </p>
          </div>
        )}

        {/* Live TV Results */}
        {results.live.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-sky-400 flex items-center space-x-2">
              <Tv className="w-4 h-4" />
              <span>Live TV Channels ({results.live.length})</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {results.live.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => handlePlayLive(ch)}
                  className="flex items-center justify-between p-3.5 rounded-xl bg-[#0F1626] hover:bg-[#162038] border border-slate-800 hover:border-sky-400/60 text-left transition-all focus:outline-none focus:ring-2 focus:ring-sky-400"
                >
                  <div className="flex items-center space-x-3 min-w-0">
                    {ch.logo ? (
                      <img
                        src={ch.logo}
                        alt={ch.name}
                        className="w-12 h-12 rounded-lg object-cover bg-slate-900 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-slate-800 flex items-center justify-center shrink-0">
                        <Tv className="w-6 h-6 text-sky-400" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-white truncate">
                        {ch.name}
                      </div>
                      <div className="text-xs text-slate-400 truncate">
                        {ch.currentProgram?.title || ch.categoryName}
                      </div>
                    </div>
                  </div>
                  <Play className="w-5 h-5 text-sky-400 shrink-0 ml-2" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Movies Results */}
        {results.movies.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center space-x-2">
              <Film className="w-4 h-4" />
              <span>Movies / VOD ({results.movies.length})</span>
            </h3>
            <div className="grid grid-cols-2 gap-5">
              {results.movies.map((mv) => (
                <button
                  key={mv.id}
                  onClick={() => handleOpenMovie(mv)}
                  title={`${mv.name} (${mv.categoryName})`}
                  className="group bg-[#0F1626] rounded-2xl overflow-hidden border border-slate-800 hover:border-amber-400 text-left transition-all focus:outline-none focus:ring-2 focus:ring-amber-400 flex flex-row items-stretch"
                >
                  <div className="w-36 sm:w-44 aspect-[2/3] bg-slate-900 relative overflow-hidden shrink-0">
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
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/85 text-amber-400 text-xs font-bold">
                        ★ {mv.rating.toFixed(1)}
                      </span>
                    )}
                  </div>
                  <div className="p-4 flex flex-col justify-between flex-1 min-w-0">
                    <div className="space-y-1.5">
                      <span className="inline-block px-2.5 py-0.5 rounded-lg bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold break-words">
                        {mv.categoryName}
                      </span>
                      <div className="font-extrabold text-base text-white line-clamp-2">
                        {mv.name}
                      </div>
                      {mv.year && (
                        <div className="text-xs text-slate-400 font-semibold">
                          Year: {mv.year}
                        </div>
                      )}
                    </div>
                    <div className="pt-2 flex items-center space-x-1.5 text-xs font-bold text-amber-400">
                      <Play className="w-4 h-4 fill-amber-400" />
                      <span>Open Movie & Play</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Series Results */}
        {results.series.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-indigo-400 flex items-center space-x-2">
              <Clapperboard className="w-4 h-4" />
              <span>TV Series ({results.series.length})</span>
            </h3>
            <div className="grid grid-cols-2 gap-5">
              {results.series.map((sr) => (
                <button
                  key={sr.id}
                  onClick={() => handleOpenSeries(sr)}
                  title={`${sr.name} (${sr.categoryName})`}
                  className="group bg-[#0F1626] rounded-2xl overflow-hidden border border-slate-800 hover:border-indigo-400 text-left transition-all focus:outline-none focus:ring-2 focus:ring-indigo-400 flex flex-row items-stretch"
                >
                  <div className="w-36 sm:w-44 aspect-[2/3] bg-slate-900 relative overflow-hidden shrink-0">
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
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-indigo-600/90 text-white text-[11px] font-bold">
                      {sr.seasons.length} Seasons
                    </span>
                  </div>
                  <div className="p-4 flex flex-col justify-between flex-1 min-w-0">
                    <div className="space-y-1.5">
                      <span className="inline-block px-2.5 py-0.5 rounded-lg bg-indigo-500/20 border border-indigo-400/40 text-indigo-300 text-xs font-bold break-words">
                        {sr.categoryName}
                      </span>
                      <div className="font-extrabold text-base text-white line-clamp-2">
                        {sr.name}
                      </div>
                    </div>
                    <div className="pt-2 flex items-center space-x-1.5 text-xs font-bold text-indigo-400">
                      <Play className="w-4 h-4 fill-indigo-400" />
                      <span>View Seasons & Episodes</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
