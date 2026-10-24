import React, { useState, useEffect } from 'react';
import {
  Play,
  RotateCcw,
  Heart,
  Star,
  Clock,
  Subtitles,
  Volume2,
  Film,
  X,
  Loader2,
} from 'lucide-react';
import type { MovieItem, SeriesEpisode, SeriesItem, SeriesSeason } from '../../types/iptv';
import { useAppStore } from '../../store/useAppStore';
import { XtreamClient } from '../../services/xtream/xtreamClient';

interface MediaDetailModalProps {
  movie?: MovieItem | null;
  series?: SeriesItem | null;
  onClose: () => void;
}

export const MediaDetailModal: React.FC<MediaDetailModalProps> = ({
  movie,
  series,
  onClose,
}) => {
  const {
    profiles,
    activeProfileId,
    watchHistory,
    setActiveMedia,
    toggleFavorite,
    isFavorite,
  } = useAppStore();

  const [selectedSeasonNum, setSelectedSeasonNum] = useState<number>(1);
  const [loadedSeasons, setLoadedSeasons] = useState<SeriesSeason[]>(
    series?.seasons || []
  );
  const [loadingDetails, setLoadingDetails] = useState(false);

  const activeProfile = profiles.find((p) => p.id === activeProfileId);

  // Fetch dynamic seasons/episodes if this is an Xtream Codes series with empty seasons
  useEffect(() => {
    if (!series) return;
    if (series.seasons && series.seasons.length > 0) {
      setLoadedSeasons(series.seasons);
      setSelectedSeasonNum(series.seasons[0].seasonNumber);
      return;
    }

    if (
      activeProfile?.type === 'xtream' &&
      activeProfile.serverUrl &&
      activeProfile.username &&
      activeProfile.password
    ) {
      setLoadingDetails(true);
      const client = new XtreamClient(
        activeProfile.serverUrl,
        activeProfile.username,
        activeProfile.password
      );
      client
        .getSeriesInfo(series.seriesId)
        .then((seasons) => {
          setLoadedSeasons(seasons);
          if (seasons.length > 0) {
            setSelectedSeasonNum(seasons[0].seasonNumber);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingDetails(false));
    }
  }, [series, activeProfile]);

  if (!movie && !series) return null;

  const targetId = movie ? movie.id : series!.id;
  const savedProgress = movie ? watchHistory[movie.id] : undefined;

  const handlePlayMovie = (resume: boolean) => {
    if (!movie) return;
    setActiveMedia({
      id: movie.id,
      type: 'movie',
      title: movie.name,
      subtitle: `${movie.year || ''} • ${movie.genre || movie.categoryName}`,
      poster: movie.poster,
      streamUrl: movie.streamUrl,
      containerExtension: movie.containerExtension,
      imdbId: movie.imdbId,
      tmdbId: movie.tmdbId,
      year: movie.year,
      startPositionSec: resume && savedProgress ? savedProgress.positionSec : 0,
      audioTracksHint: movie.audioTracksHint,
      videoResolutionHint: movie.videoResolutionHint,
    });
    onClose();
  };

  const handlePlayEpisode = (ep: SeriesEpisode) => {
    if (!series) return;
    const epProgress = watchHistory[ep.id];
    setActiveMedia({
      id: ep.id,
      type: 'series',
      title: `${series.name} — ${ep.title}`,
      subtitle: `Season ${ep.seasonNum}, Episode ${ep.episodeNum}`,
      poster: ep.poster || series.poster,
      streamUrl: ep.streamUrl,
      containerExtension: ep.containerExtension,
      imdbId: ep.imdbId || series.imdbId,
      tmdbId: series.tmdbId,
      seasonNumber: ep.seasonNum,
      episodeNumber: ep.episodeNum,
      seriesId: series.id,
      startPositionSec: epProgress ? epProgress.positionSec : 0,
    });
    onClose();
  };

  const currentSeason = loadedSeasons.find(
    (s) => s.seasonNumber === selectedSeasonNum
  );

  return (
    <div
      className="fixed inset-0 z-40 bg-black/85 backdrop-blur-md flex items-center justify-center p-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#0F1626] border border-slate-700/80 rounded-3xl w-full max-w-5xl max-h-[88vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Hero Banner */}
        <div className="relative p-8 flex flex-col md:flex-row gap-7 bg-gradient-to-br from-[#16213A] to-[#0B101D] border-b border-slate-800">
          <button
            onClick={onClose}
            className="absolute top-6 right-6 px-4 py-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-slate-700 flex items-center space-x-1.5 focus:ring-2 focus:ring-sky-400"
          >
            <X className="w-4 h-4" />
            <span className="text-sm font-semibold">Close</span>
          </button>

          {/* Poster */}
          <div className="w-44 h-64 rounded-2xl overflow-hidden bg-slate-900 border border-slate-700 shrink-0 shadow-xl">
            {(movie?.poster || series?.poster) ? (
              <img
                src={movie?.poster || series?.poster}
                alt={movie?.name || series?.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <Film className="w-12 h-12 text-slate-600" />
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="flex-1 flex flex-col justify-between space-y-4 pr-16">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                <span className="px-2.5 py-0.5 rounded bg-sky-500 text-slate-950 uppercase">
                  {movie ? 'Movie VOD' : 'TV Series'}
                </span>
                {(movie?.rating || series?.rating) && (
                  <span className="px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center space-x-1">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <span>{(movie?.rating || series?.rating)?.toFixed(1)}</span>
                  </span>
                )}
                {(movie?.year || series?.releaseDate) && (
                  <span className="px-2.5 py-0.5 rounded bg-slate-800 text-slate-300">
                    {movie?.year || series?.releaseDate}
                  </span>
                )}
                {movie?.duration && (
                  <span className="px-2.5 py-0.5 rounded bg-slate-800 text-slate-300 flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{movie.duration}</span>
                  </span>
                )}
                <span className="px-2.5 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  {(movie?.containerExtension || 'HLS/MP4').toUpperCase()}
                </span>
              </div>

              <h2 className="text-3xl font-extrabold text-white">
                {movie?.name || series?.name}
              </h2>

              <p className="text-sm text-slate-300 leading-relaxed line-clamp-3">
                {movie?.plot ||
                  series?.plot ||
                  'Stream with multi-track audio selection, adaptive video bitrates, and downloadable OpenSubtitles & SubDL subtitles.'}
              </p>

              <div className="text-xs text-slate-400 space-y-0.5 pt-1">
                {(movie?.genre || series?.genre) && (
                  <div>
                    <strong className="text-slate-300">Genre:</strong>{' '}
                    {movie?.genre || series?.genre}
                  </div>
                )}
                {(movie?.cast || series?.cast) && (
                  <div>
                    <strong className="text-slate-300">Cast:</strong>{' '}
                    {movie?.cast || series?.cast}
                  </div>
                )}
              </div>
            </div>

            {/* Capability Badges */}
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-700 text-amber-300 flex items-center space-x-1.5">
                <Volume2 className="w-3.5 h-3.5" />
                <span>Multi-Audio Stream Selector</span>
              </span>
              <span className="px-3 py-1 rounded-lg bg-slate-900 border border-slate-700 text-sky-300 flex items-center space-x-1.5">
                <Subtitles className="w-3.5 h-3.5" />
                <span>OpenSubtitles & SubDL Ready</span>
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {movie && (
                <>
                  <button
                    onClick={() => handlePlayMovie(false)}
                    autoFocus
                    className="px-6 py-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-sm flex items-center space-x-2 focus:ring-4 focus:ring-white"
                  >
                    <Play className="w-5 h-5 fill-slate-950" />
                    <span>
                      {savedProgress && savedProgress.positionSec > 15
                        ? 'Play from Beginning'
                        : 'Play Movie Now'}
                    </span>
                  </button>

                  {savedProgress && savedProgress.positionSec > 15 && (
                    <button
                      onClick={() => handlePlayMovie(true)}
                      className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-sm flex items-center space-x-2 focus:ring-4 focus:ring-white"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>
                        Resume ({Math.floor(savedProgress.positionSec / 60)}m{' '}
                        {Math.floor(savedProgress.positionSec % 60)}s)
                      </span>
                    </button>
                  )}
                </>
              )}

              <button
                onClick={() => toggleFavorite(targetId)}
                className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold text-sm flex items-center space-x-2 focus:ring-2 focus:ring-sky-400"
              >
                <Heart
                  className={`w-4 h-4 ${
                    isFavorite(targetId)
                      ? 'text-rose-500 fill-rose-500'
                      : 'text-slate-300'
                  }`}
                />
                <span>
                  {isFavorite(targetId) ? 'In Favorites' : 'Add to Favorites'}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Series Seasons & Episodes Selector */}
        {series && (
          <div className="p-6 flex-1 overflow-y-auto space-y-4">
            {loadingDetails ? (
              <div className="flex items-center justify-center py-12 space-x-3 text-slate-300">
                <Loader2 className="w-6 h-6 animate-spin text-sky-400" />
                <span>Loading Seasons & Episodes from Xtream Server...</span>
              </div>
            ) : (
              <>
                {/* Season Tabs */}
                <div className="flex flex-wrap gap-2">
                  {loadedSeasons.map((season) => (
                    <button
                      key={season.seasonNumber}
                      onClick={() => setSelectedSeasonNum(season.seasonNumber)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all focus:ring-2 focus:ring-sky-400 ${
                        selectedSeasonNum === season.seasonNumber
                          ? 'bg-sky-500 text-slate-950'
                          : 'bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      {season.name} ({season.episodes.length} Episodes)
                    </button>
                  ))}
                </div>

                {/* Episodes List */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {currentSeason?.episodes.map((ep) => {
                    const epProg = watchHistory[ep.id];
                    return (
                      <button
                        key={ep.id}
                        onClick={() => handlePlayEpisode(ep)}
                        className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-800 hover:border-sky-400/60 text-left transition-all focus:outline-none focus:ring-2 focus:ring-sky-400"
                      >
                        <div className="space-y-1 pr-4">
                          <div className="flex items-center space-x-2">
                            <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 text-xs font-bold">
                              E{String(ep.episodeNum).padStart(2, '0')}
                            </span>
                            <span className="font-bold text-white text-sm">
                              {ep.title}
                            </span>
                          </div>
                          {ep.plot && (
                            <p className="text-xs text-slate-400 line-clamp-2">
                              {ep.plot}
                            </p>
                          )}
                          <div className="text-[11px] text-slate-500 flex items-center space-x-3">
                            {ep.duration && <span>Duration: {ep.duration}</span>}
                            {epProg && (
                              <span className="text-emerald-400 font-semibold">
                                • Resume at {Math.floor(epProg.positionSec / 60)}m
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="p-3 rounded-xl bg-sky-500 text-slate-950 shrink-0">
                          <Play className="w-4 h-4 fill-slate-950" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
