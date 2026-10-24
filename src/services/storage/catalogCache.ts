import type {
  Category,
  LiveChannel,
  MovieItem,
  SeriesItem,
  SubtitleTrackOption,
} from '../../types/iptv';

const DB_NAME = 'kerloy_iptv_webos_db';
const DB_VERSION = 1;
const STORE_CATALOGS = 'catalogs';
const STORE_SUBTITLES = 'subtitles';

export interface CachedCatalogData {
  profileId: string;
  updatedAt: number;
  categories: Category[];
  liveChannels: LiveChannel[];
  movies: MovieItem[];
  series: SeriesItem[];
}

export interface CachedSubtitleData {
  mediaId: string;
  updatedAt: number;
  tracks: SubtitleTrackOption[];
  activeSubtitleId: string;
  subtitleOffsetMs: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_CATALOGS)) {
        db.createObjectStore(STORE_CATALOGS, { keyPath: 'profileId' });
      }
      if (!db.objectStoreNames.contains(STORE_SUBTITLES)) {
        db.createObjectStore(STORE_SUBTITLES, { keyPath: 'mediaId' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves a profile's full downloaded Xtream / M3U catalog (Live TV, Movies, Series)
 * into IndexedDB on the LG webOS TV so subsequent launches are instantaneous.
 */
export async function saveCatalogToCache(
  profileId: string,
  data: {
    categories: Category[];
    liveChannels: LiveChannel[];
    movies: MovieItem[];
    series: SeriesItem[];
  }
): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_CATALOGS, 'readwrite');
      const store = tx.objectStore(STORE_CATALOGS);
      const record: CachedCatalogData = {
        profileId,
        updatedAt: Date.now(),
        ...data,
      };
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignore storage errors on restricted environments
  }
}

/**
 * Loads a profile's cached catalog from IndexedDB on the TV.
 */
export async function loadCatalogFromCache(
  profileId: string
): Promise<CachedCatalogData | null> {
  try {
    const db = await openDatabase();
    const result = await new Promise<CachedCatalogData | null>((resolve, reject) => {
      const tx = db.transaction(STORE_CATALOGS, 'readonly');
      const store = tx.objectStore(STORE_CATALOGS);
      const req = store.get(profileId);
      req.onsuccess = () => resolve((req.result as CachedCatalogData) || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  } catch {
    return null;
  }
}

export async function deleteCatalogFromCache(profileId: string): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_CATALOGS, 'readwrite');
      tx.objectStore(STORE_CATALOGS).delete(profileId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignore
  }
}

/**
 * Persists downloaded subtitles (.srt / .vtt) and timing offset for a specific Movie or Episode in IndexedDB.
 */
export async function saveSubtitlesToCache(
  mediaId: string,
  tracks: SubtitleTrackOption[],
  activeSubtitleId: string,
  subtitleOffsetMs: number
): Promise<void> {
  try {
    const externalTracks = tracks.filter((t) => t.source !== 'embedded');
    if (externalTracks.length === 0 && activeSubtitleId === 'off') return;

    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SUBTITLES, 'readwrite');
      const store = tx.objectStore(STORE_SUBTITLES);
      const record: CachedSubtitleData = {
        mediaId,
        updatedAt: Date.now(),
        tracks: externalTracks,
        activeSubtitleId,
        subtitleOffsetMs,
      };
      store.put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignore
  }
}

/**
 * Loads previously downloaded subtitles and timing sync offset for a Movie or Episode.
 */
export async function loadSubtitlesFromCache(
  mediaId: string
): Promise<CachedSubtitleData | null> {
  try {
    const db = await openDatabase();
    const result = await new Promise<CachedSubtitleData | null>((resolve, reject) => {
      const tx = db.transaction(STORE_SUBTITLES, 'readonly');
      const store = tx.objectStore(STORE_SUBTITLES);
      const req = store.get(mediaId);
      req.onsuccess = () => resolve((req.result as CachedSubtitleData) || null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result;
  } catch {
    return null;
  }
}
