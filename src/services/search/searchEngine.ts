import type { LiveChannel, MediaType, MovieItem, SeriesItem } from '../../types/iptv';

export interface SearchFilterOptions {
  query: string;
  mediaType: 'all' | MediaType;
  categoryId?: string;
  year?: string;
  minRating?: number;
  favoritesOnly?: boolean;
  favoriteIds?: Set<string>;
  includeAdult?: boolean;
  maxResults?: number;
}

export interface SearchResultGroup {
  live: LiveChannel[];
  movies: MovieItem[];
  series: SeriesItem[];
  totalCount: number;
}

function scoreMatch(targetName: string, categoryName: string, extraText: string, tokens: string[]): number {
  if (tokens.length === 0) return 1;
  const lowerName = targetName.toLowerCase();
  const lowerCat = categoryName.toLowerCase();
  const lowerExtra = extraText.toLowerCase();

  let totalScore = 0;
  for (const token of tokens) {
    if (lowerName === token) {
      totalScore += 100;
    } else if (lowerName.startsWith(token)) {
      totalScore += 60;
    } else if (lowerName.includes(token)) {
      totalScore += 35;
    } else if (lowerCat.includes(token)) {
      totalScore += 15;
    } else if (lowerExtra.includes(token)) {
      totalScore += 10;
    } else {
      return 0; // All query tokens must match at least one field
    }
  }
  return totalScore;
}

/**
 * High-speed multi-facet search engine across Live TV channels, Movies (VOD), and TV Series.
 */
export function executeGlobalSearch(
  catalog: {
    liveChannels: LiveChannel[];
    movies: MovieItem[];
    series: SeriesItem[];
  },
  options: SearchFilterOptions
): SearchResultGroup {
  const tokens = options.query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  const maxPerGroup = options.maxResults || 60;
  const favSet = options.favoriteIds || new Set<string>();

  const matchedLive: Array<{ item: LiveChannel; score: number }> = [];
  const matchedMovies: Array<{ item: MovieItem; score: number }> = [];
  const matchedSeries: Array<{ item: SeriesItem; score: number }> = [];

  if (options.mediaType === 'all' || options.mediaType === 'live') {
    for (const ch of catalog.liveChannels) {
      if (!options.includeAdult && ch.isAdult) continue;
      if (options.favoritesOnly && !favSet.has(ch.id)) continue;
      if (options.categoryId && options.categoryId !== 'all' && ch.categoryId !== options.categoryId) continue;

      const extra = `${ch.currentProgram?.title || ''} ${ch.epgChannelId || ''}`;
      const score = scoreMatch(ch.name, ch.categoryName, extra, tokens);
      if (score > 0) {
        matchedLive.push({ item: ch, score });
      }
    }
  }

  if (options.mediaType === 'all' || options.mediaType === 'movie') {
    for (const mv of catalog.movies) {
      if (!options.includeAdult && mv.isAdult) continue;
      if (options.favoritesOnly && !favSet.has(mv.id)) continue;
      if (options.categoryId && options.categoryId !== 'all' && mv.categoryId !== options.categoryId) continue;
      if (options.year && options.year !== 'all' && mv.year !== options.year) continue;
      if (options.minRating && (mv.rating || 0) < options.minRating) continue;

      const extra = `${mv.genre || ''} ${mv.cast || ''} ${mv.director || ''} ${mv.year || ''} ${mv.plot || ''}`;
      const score = scoreMatch(mv.name, mv.categoryName, extra, tokens);
      if (score > 0) {
        matchedMovies.push({ item: mv, score });
      }
    }
  }

  if (options.mediaType === 'all' || options.mediaType === 'series') {
    for (const sr of catalog.series) {
      if (!options.includeAdult && sr.isAdult) continue;
      if (options.favoritesOnly && !favSet.has(sr.id)) continue;
      if (options.categoryId && options.categoryId !== 'all' && sr.categoryId !== options.categoryId) continue;
      if (options.year && options.year !== 'all' && !sr.releaseDate?.startsWith(options.year)) continue;
      if (options.minRating && (sr.rating || 0) < options.minRating) continue;

      const extra = `${sr.genre || ''} ${sr.cast || ''} ${sr.plot || ''} ${sr.releaseDate || ''}`;
      const score = scoreMatch(sr.name, sr.categoryName, extra, tokens);
      if (score > 0) {
        matchedSeries.push({ item: sr, score });
      }
    }
  }

  matchedLive.sort((a, b) => b.score - a.score);
  matchedMovies.sort((a, b) => b.score - a.score);
  matchedSeries.sort((a, b) => b.score - a.score);

  const live = matchedLive.slice(0, maxPerGroup).map((x) => x.item);
  const movies = matchedMovies.slice(0, maxPerGroup).map((x) => x.item);
  const series = matchedSeries.slice(0, maxPerGroup).map((x) => x.item);

  return {
    live,
    movies,
    series,
    totalCount: matchedLive.length + matchedMovies.length + matchedSeries.length,
  };
}
