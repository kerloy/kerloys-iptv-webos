import type {
  Category,
  EpgProgram,
  LiveChannel,
  MovieItem,
  PlaylistProfile,
  SeriesEpisode,
  SeriesItem,
  SeriesSeason,
} from '../../types/iptv';
import { smartFetchJson } from '../../utils/network';

export interface XtreamAuthResponse {
  user_info?: {
    username: string;
    password: string;
    message?: string;
    auth: number | string;
    status: string;
    exp_date: string | null;
    is_trial: string;
    active_cons: string | number;
    created_at: string;
    max_connections: string | number;
    allowed_output_formats?: string[];
  };
  server_info?: {
    url: string;
    port: string;
    https_port?: string;
    server_protocol?: string;
    rtmp_port?: string;
    timezone?: string;
    timestamp_now?: number;
    time_now?: string;
  };
}

export function normalizeServerUrl(rawUrl: string): string {
  let clean = rawUrl.trim();
  if (!/^https?:\/\//i.test(clean)) {
    clean = `http://${clean}`;
  }
  return clean.replace(/\/+$/, '');
}

export function isAdultCategoryName(name: string): boolean {
  return /\b(adult|xxx|18\+|porn|erotic|nsfw|mature)\b/i.test(name);
}

export class XtreamClient {
  private baseUrl: string;
  private username: string;
  private password: string;
  private preferredLiveFormat: 'm3u8' | 'ts';

  constructor(
    serverUrl: string,
    username: string,
    password: string,
    preferredLiveFormat: 'm3u8' | 'ts' = 'm3u8'
  ) {
    this.baseUrl = normalizeServerUrl(serverUrl);
    this.username = encodeURIComponent(username.trim());
    this.password = encodeURIComponent(password.trim());
    this.preferredLiveFormat = preferredLiveFormat;
  }

  private buildApiUrl(action?: string, extraParams: Record<string, string | number> = {}): string {
    const query = new URLSearchParams();
    query.set('username', decodeURIComponent(this.username));
    query.set('password', decodeURIComponent(this.password));
    if (action) {
      query.set('action', action);
    }
    Object.entries(extraParams).forEach(([k, v]) => {
      query.set(k, String(v));
    });
    return `${this.baseUrl}/player_api.php?${query.toString()}`;
  }

  public getXmltvUrl(): string {
    return `${this.baseUrl}/xmltv.php?username=${this.username}&password=${this.password}`;
  }

  public buildLiveStreamUrl(streamId: number | string, ext: 'm3u8' | 'ts' = this.preferredLiveFormat): string {
    if (ext === 'm3u8') {
      return `${this.baseUrl}/live/${this.username}/${this.password}/${streamId}.m3u8`;
    }
    return `${this.baseUrl}/live/${this.username}/${this.password}/${streamId}.ts`;
  }

  public buildVodStreamUrl(streamId: number | string, containerExtension = 'mp4'): string {
    const cleanExt = (containerExtension || 'mp4').replace(/^\./, '');
    return `${this.baseUrl}/movie/${this.username}/${this.password}/${streamId}.${cleanExt}`;
  }

  public buildSeriesStreamUrl(episodeId: number | string, containerExtension = 'mp4'): string {
    const cleanExt = (containerExtension || 'mp4').replace(/^\./, '');
    return `${this.baseUrl}/series/${this.username}/${this.password}/${episodeId}.${cleanExt}`;
  }

  public async authenticate(): Promise<PlaylistProfile['accountInfo']> {
    const data = await smartFetchJson<XtreamAuthResponse>(this.buildApiUrl());
    if (!data?.user_info || Number(data.user_info.auth) === 0) {
      throw new Error(data?.user_info?.message || 'Invalid Xtream Codes credentials');
    }

    const ui = data.user_info;
    return {
      status: ui.status || 'Active',
      expDate: ui.exp_date ? new Date(Number(ui.exp_date) * 1000).toISOString().split('T')[0] : 'Unlimited',
      isTrial: ui.is_trial === '1',
      activeConnections: Number(ui.active_cons || 0),
      maxConnections: Number(ui.max_connections || 1),
      serverTimezone: data.server_info?.timezone,
    };
  }

  public async getCategories(type: 'live' | 'movie' | 'series'): Promise<Category[]> {
    const actionMap = {
      live: 'get_live_categories',
      movie: 'get_vod_categories',
      series: 'get_series_categories',
    };
    const raw = await smartFetchJson<Array<{ category_id: string; category_name: string }>>(
      this.buildApiUrl(actionMap[type])
    );
    if (!Array.isArray(raw)) return [];
    return raw.map((item) => ({
      id: String(item.category_id),
      name: item.category_name || 'Uncategorized',
      type,
      isAdult: isAdultCategoryName(item.category_name || ''),
    }));
  }

  public async getLiveStreams(categoriesMap: Map<string, string>): Promise<LiveChannel[]> {
    const raw = await smartFetchJson<Array<Record<string, unknown>>>(
      this.buildApiUrl('get_live_streams')
    );
    if (!Array.isArray(raw)) return [];

    return raw.map((item) => {
      const streamId = item.stream_id as number | string;
      const catId = String(item.category_id || '0');
      const catName = categoriesMap.get(catId) || 'Live TV';
      const name = String(item.name || `Channel ${streamId}`);
      const primaryFormat = this.preferredLiveFormat;
      const fallbackFormat = primaryFormat === 'm3u8' ? 'ts' : 'm3u8';

      return {
        id: `live-${streamId}`,
        streamId,
        name,
        categoryId: catId,
        categoryName: catName,
        logo: String(item.stream_icon || ''),
        epgChannelId: item.epg_channel_id ? String(item.epg_channel_id) : undefined,
        streamUrl: this.buildLiveStreamUrl(streamId, primaryFormat),
        fallbackStreamUrl: this.buildLiveStreamUrl(streamId, fallbackFormat),
        containerExtension: primaryFormat,
        tvArchive: Number(item.tv_archive) === 1,
        tvArchiveDuration: Number(item.tv_archive_duration || 0),
        isAdult: Number(item.is_adult) === 1 || isAdultCategoryName(catName) || isAdultCategoryName(name),
      };
    });
  }

  public async getVodStreams(categoriesMap: Map<string, string>): Promise<MovieItem[]> {
    const raw = await smartFetchJson<Array<Record<string, unknown>>>(
      this.buildApiUrl('get_vod_streams')
    );
    if (!Array.isArray(raw)) return [];

    return raw.map((item) => {
      const streamId = item.stream_id as number | string;
      const catId = String(item.category_id || '0');
      const catName = categoriesMap.get(catId) || 'Movies';
      const ext = String(item.container_extension || 'mp4');
      const rawName = String(item.name || `Movie ${streamId}`);
      const yearMatch = rawName.match(/\((\d{4})\)|\b(19\d{2}|20\d{2})\b/);

      return {
        id: `movie-${streamId}`,
        streamId,
        name: rawName,
        categoryId: catId,
        categoryName: catName,
        poster: String(item.stream_icon || ''),
        rating: item.rating ? Number(item.rating) : item.rating_5based ? Number(item.rating_5based) * 2 : undefined,
        year: yearMatch ? (yearMatch[1] || yearMatch[2]) : undefined,
        containerExtension: ext,
        streamUrl: this.buildVodStreamUrl(streamId, ext),
        addedAt: item.added ? Number(item.added) * 1000 : undefined,
        tmdbId: item.tmdb ? String(item.tmdb) : undefined,
        isAdult: Number(item.is_adult) === 1 || isAdultCategoryName(catName),
      };
    });
  }

  public async getVodInfo(vodId: number | string): Promise<Partial<MovieItem>> {
    const data = await smartFetchJson<Record<string, Record<string, unknown>>>(
      this.buildApiUrl('get_vod_info', { vod_id: vodId })
    );
    const info = data?.info || {};
    const backdropArr = Array.isArray(info.backdrop_path) ? info.backdrop_path : [];

    return {
      plot: info.plot ? String(info.plot) : info.description ? String(info.description) : undefined,
      cast: info.cast ? String(info.cast) : info.actors ? String(info.actors) : undefined,
      director: info.director ? String(info.director) : undefined,
      genre: info.genre ? String(info.genre) : undefined,
      duration: info.duration ? String(info.duration) : undefined,
      imdbId: info.imdb_id ? String(info.imdb_id) : undefined,
      tmdbId: info.tmdb_id ? String(info.tmdb_id) : undefined,
      backdrop: backdropArr.length > 0 ? String(backdropArr[0]) : undefined,
      year: info.releasedate ? String(info.releasedate).slice(0, 4) : undefined,
    };
  }

  public async getSeriesList(categoriesMap: Map<string, string>): Promise<SeriesItem[]> {
    const raw = await smartFetchJson<Array<Record<string, unknown>>>(
      this.buildApiUrl('get_series')
    );
    if (!Array.isArray(raw)) return [];

    return raw.map((item) => {
      const seriesId = item.series_id as number | string;
      const catId = String(item.category_id || '0');
      const catName = categoriesMap.get(catId) || 'TV Series';
      const backdropArr = Array.isArray(item.backdrop_path) ? item.backdrop_path : [];

      return {
        id: `series-${seriesId}`,
        seriesId,
        name: String(item.name || `Series ${seriesId}`),
        categoryId: catId,
        categoryName: catName,
        poster: String(item.cover || ''),
        backdrop: backdropArr.length > 0 ? String(backdropArr[0]) : undefined,
        plot: item.plot ? String(item.plot) : undefined,
        cast: item.cast ? String(item.cast) : undefined,
        director: item.director ? String(item.director) : undefined,
        genre: item.genre ? String(item.genre) : undefined,
        releaseDate: item.releaseDate ? String(item.releaseDate) : undefined,
        rating: item.rating ? Number(item.rating) : item.rating_5based ? Number(item.rating_5based) * 2 : undefined,
        tmdbId: item.tmdb ? String(item.tmdb) : undefined,
        seasons: [],
        isAdult: isAdultCategoryName(catName),
      };
    });
  }

  public async getSeriesInfo(seriesId: number | string): Promise<SeriesSeason[]> {
    const data = await smartFetchJson<{
      seasons?: Array<Record<string, unknown>>;
      episodes?: Record<string, Array<Record<string, unknown>>>;
    }>(this.buildApiUrl('get_series_info', { series_id: seriesId }));

    const episodesBySeason = data?.episodes || {};
    const seasons: SeriesSeason[] = [];

    for (const [seasonKey, epList] of Object.entries(episodesBySeason)) {
      if (!Array.isArray(epList)) continue;
      const seasonNumber = Number(seasonKey) || 1;
      const episodes: SeriesEpisode[] = epList.map((ep, idx) => {
        const epId = String(ep.id || `${seriesId}-${seasonNumber}-${idx + 1}`);
        const ext = String(ep.container_extension || 'mp4');
        const info = (ep.info as Record<string, unknown>) || {};
        return {
          id: `ep-${epId}`,
          episodeNum: Number(ep.episode_num || idx + 1),
          seasonNum: seasonNumber,
          title: String(ep.title || `Episode ${idx + 1}`),
          plot: info.plot ? String(info.plot) : undefined,
          duration: info.duration ? String(info.duration) : undefined,
          rating: info.rating ? Number(info.rating) : undefined,
          poster: info.movie_image ? String(info.movie_image) : undefined,
          containerExtension: ext,
          streamUrl: this.buildSeriesStreamUrl(epId, ext),
        };
      });

      seasons.push({
        seasonNumber,
        name: `Season ${seasonNumber}`,
        episodeCount: episodes.length,
        episodes,
      });
    }

    return seasons.sort((a, b) => a.seasonNumber - b.seasonNumber);
  }

  public async getShortEpg(streamId: number | string, limit = 6): Promise<EpgProgram[]> {
    const data = await smartFetchJson<{
      epg_listings?: Array<Record<string, unknown>>;
    }>(this.buildApiUrl('get_short_epg', { stream_id: streamId, limit }));

    const listings = data?.epg_listings;
    if (!Array.isArray(listings)) return [];

    return listings.map((item, idx) => {
      const decodeBase64 = (val: unknown): string => {
        if (typeof val !== 'string') return '';
        try {
          return decodeURIComponent(escape(atob(val)));
        } catch {
          return val;
        }
      };

      const startTs = item.start_timestamp
        ? Number(item.start_timestamp) * 1000
        : Date.parse(String(item.start || '')) || Date.now();
      const stopTs = item.stop_timestamp
        ? Number(item.stop_timestamp) * 1000
        : Date.parse(String(item.end || '')) || startTs + 3600_000;

      return {
        id: String(item.id || `${streamId}-epg-${idx}`),
        channelId: String(item.epg_id || streamId),
        title: decodeBase64(item.title) || 'Program',
        description: decodeBase64(item.description),
        start: startTs,
        end: stopTs,
        lang: item.lang ? String(item.lang) : undefined,
      };
    });
  }
}
