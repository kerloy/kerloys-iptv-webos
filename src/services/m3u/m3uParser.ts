import type {
  Category,
  LiveChannel,
  MovieItem,
  SeriesEpisode,
  SeriesItem,
  SeriesSeason,
} from '../../types/iptv';
import { isAdultCategoryName } from '../xtream/xtreamClient';

export interface ParsedM3UPlaylist {
  categories: Category[];
  liveChannels: LiveChannel[];
  movies: MovieItem[];
  series: SeriesItem[];
  epgUrl?: string;
}

const SERIES_PATTERN = /^(.*?)\s*[-–:]?\s*(?:S(\d{1,2})\s*E(\d{1,3})|Season\s*(\d{1,2})\s*Episode\s*(\d{1,3})|(\d{1,2})x(\d{1,3}))(?:\s*[-–:]\s*(.*))?$/i;
const VOD_EXTENSION_PATTERN = /\.(mp4|mkv|avi|mov|wmv|flv|webm)(\?.*)?$/i;

function extractAttribute(line: string, attrName: string): string {
  const regex = new RegExp(`${attrName}\\s*=\\s*"([^"]*)"`, 'i');
  const match = line.match(regex);
  return match ? match[1].trim() : '';
}

function getExtensionFromUrl(url: string): string {
  const match = url.match(/\.([a-z0-9]{2,4})(?:\?.*)?$/i);
  return match ? match[1].toLowerCase() : 'm3u8';
}

/**
 * High-speed M3U / M3U8 parser supporting:
 * - Standard #EXTM3U headers (x-tvg-url / url-tvg)
 * - #EXTINF attributes: tvg-id, tvg-name, tvg-logo, group-title
 * - #EXTGRP group fallback
 * - Automatic classification into Live TV, Movies (VOD), and TV Series (grouping SxxExx episodes)
 */
export function parseM3UPlaylist(content: string): ParsedM3UPlaylist {
  const lines = content.split(/\r?\n/);
  let epgUrl: string | undefined;

  const categoriesMap = new Map<string, Category>();
  const liveChannels: LiveChannel[] = [];
  const movies: MovieItem[] = [];
  const seriesMap = new Map<string, SeriesItem>();

  let currentExtInf = '';
  let currentGroupOverride = '';
  let itemIndex = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('#EXTM3U')) {
      const urlTvg = extractAttribute(line, 'x-tvg-url') || extractAttribute(line, 'url-tvg');
      if (urlTvg) epgUrl = urlTvg;
      continue;
    }

    if (line.startsWith('#EXTGRP:')) {
      currentGroupOverride = line.slice(8).trim();
      continue;
    }

    if (line.startsWith('#EXTINF:')) {
      currentExtInf = line;
      continue;
    }

    if (line.startsWith('#')) {
      continue;
    }

    // We have a stream URL line
    const streamUrl = line;
    itemIndex += 1;

    const tvgId = extractAttribute(currentExtInf, 'tvg-id');
    const tvgName = extractAttribute(currentExtInf, 'tvg-name');
    const tvgLogo = extractAttribute(currentExtInf, 'tvg-logo');
    const groupTitle =
      extractAttribute(currentExtInf, 'group-title') ||
      currentGroupOverride ||
      'General';
    const explicitType = extractAttribute(currentExtInf, 'tvg-type').toLowerCase();

    const commaIndex = currentExtInf.lastIndexOf(',');
    const rawTitle =
      (commaIndex !== -1 ? currentExtInf.slice(commaIndex + 1).trim() : '') ||
      tvgName ||
      `Stream ${itemIndex}`;

    currentExtInf = '';
    currentGroupOverride = '';

    // Determine whether this entry is Series, Movie (VOD), or Live TV
    const seriesMatch = rawTitle.match(SERIES_PATTERN);
    const isVodUrl =
      VOD_EXTENSION_PATTERN.test(streamUrl) ||
      /\/movie\//i.test(streamUrl) ||
      explicitType === 'movie' ||
      explicitType === 'vod' ||
      /\b(movies?|vod|cinema|films?)\b/i.test(groupTitle);
    const isSeriesUrl =
      Boolean(seriesMatch) ||
      /\/series\//i.test(streamUrl) ||
      explicitType === 'series';

    if (isSeriesUrl && seriesMatch) {
      const seriesTitle = seriesMatch[1].trim() || rawTitle;
      const seasonNum = Number(seriesMatch[2] || seriesMatch[4] || seriesMatch[6] || 1);
      const episodeNum = Number(seriesMatch[3] || seriesMatch[5] || seriesMatch[7] || 1);
      const episodeSuffix = seriesMatch[8]?.trim();
      const catId = `series-cat-${groupTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

      if (!categoriesMap.has(catId)) {
        categoriesMap.set(catId, {
          id: catId,
          name: groupTitle,
          type: 'series',
          isAdult: isAdultCategoryName(groupTitle),
        });
      }

      const seriesKey = `${catId}::${seriesTitle.toLowerCase()}`;
      let seriesItem = seriesMap.get(seriesKey);
      if (!seriesItem) {
        seriesItem = {
          id: `m3u-series-${seriesMap.size + 1}`,
          seriesId: seriesMap.size + 1,
          name: seriesTitle,
          categoryId: catId,
          categoryName: groupTitle,
          poster: tvgLogo,
          seasons: [],
          isAdult: isAdultCategoryName(groupTitle) || isAdultCategoryName(seriesTitle),
        };
        seriesMap.set(seriesKey, seriesItem);
      }

      let season: SeriesSeason | undefined = seriesItem.seasons.find(
        (s) => s.seasonNumber === seasonNum
      );
      if (!season) {
        season = {
          seasonNumber: seasonNum,
          name: `Season ${seasonNum}`,
          episodeCount: 0,
          poster: tvgLogo,
          episodes: [],
        };
        seriesItem.seasons.push(season);
        seriesItem.seasons.sort((a, b) => a.seasonNumber - b.seasonNumber);
      }

      const episode: SeriesEpisode = {
        id: `m3u-ep-${itemIndex}`,
        seasonNum,
        episodeNum,
        title: episodeSuffix
          ? `S${String(seasonNum).padStart(2, '0')}E${String(episodeNum).padStart(2, '0')} - ${episodeSuffix}`
          : `Episode ${episodeNum}`,
        poster: tvgLogo,
        containerExtension: getExtensionFromUrl(streamUrl),
        streamUrl,
      };
      season.episodes.push(episode);
      season.episodes.sort((a, b) => a.episodeNum - b.episodeNum);
      season.episodeCount = season.episodes.length;
    } else if (isVodUrl) {
      const catId = `movie-cat-${groupTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      if (!categoriesMap.has(catId)) {
        categoriesMap.set(catId, {
          id: catId,
          name: groupTitle,
          type: 'movie',
          isAdult: isAdultCategoryName(groupTitle),
        });
      }

      const yearMatch = rawTitle.match(/\((\d{4})\)|\b(19\d{2}|20\d{2})\b/);
      movies.push({
        id: `m3u-movie-${itemIndex}`,
        streamId: itemIndex,
        name: rawTitle,
        categoryId: catId,
        categoryName: groupTitle,
        poster: tvgLogo,
        year: yearMatch ? (yearMatch[1] || yearMatch[2]) : undefined,
        containerExtension: getExtensionFromUrl(streamUrl),
        streamUrl,
        isAdult: isAdultCategoryName(groupTitle) || isAdultCategoryName(rawTitle),
      });
    } else {
      const catId = `live-cat-${groupTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      if (!categoriesMap.has(catId)) {
        categoriesMap.set(catId, {
          id: catId,
          name: groupTitle,
          type: 'live',
          isAdult: isAdultCategoryName(groupTitle),
        });
      }

      const ext = getExtensionFromUrl(streamUrl);
      liveChannels.push({
        id: `m3u-live-${itemIndex}`,
        streamId: itemIndex,
        name: rawTitle,
        categoryId: catId,
        categoryName: groupTitle,
        logo: tvgLogo,
        epgChannelId: tvgId || tvgName || undefined,
        streamUrl,
        containerExtension: ext === 'ts' ? 'ts' : 'm3u8',
        isAdult: isAdultCategoryName(groupTitle) || isAdultCategoryName(rawTitle),
      });
    }
  }

  return {
    categories: Array.from(categoriesMap.values()),
    liveChannels,
    movies,
    series: Array.from(seriesMap.values()),
    epgUrl,
  };
}
