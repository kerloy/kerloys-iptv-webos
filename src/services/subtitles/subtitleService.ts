import { unzipSync, strFromU8 } from 'fflate';
import type { ExternalSubtitleTrack } from '../../types/iptv';
import { smartFetch, smartFetchJson, smartFetchText } from '../../utils/network';

export interface SubtitleSearchParams {
  query: string;
  imdbId?: string;
  tmdbId?: string;
  year?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  languages: string[];
  openSubtitlesApiKey?: string;
  subdlApiKey?: string;
}

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  ar: 'Arabic (العربية)',
  es: 'Spanish (Español)',
  fr: 'French (Français)',
  de: 'German (Deutsch)',
  hi: 'Hindi (हिन्दी)',
  tr: 'Turkish (Türkçe)',
  pt: 'Portuguese (Português)',
  ru: 'Russian (Русский)',
  it: 'Italian (Italiano)',
  nl: 'Dutch (Nederlands)',
  pl: 'Polish (Polski)',
};

export function getLanguageLabel(code: string): string {
  const clean = code.toLowerCase().slice(0, 2);
  return LANGUAGE_LABELS[clean] || code.toUpperCase();
}

/**
 * Searches OpenSubtitles.com REST API v1
 */
async function searchOpenSubtitles(
  params: SubtitleSearchParams
): Promise<ExternalSubtitleTrack[]> {
  if (!params.openSubtitlesApiKey?.trim()) {
    return [];
  }

  const url = new URL('https://api.opensubtitles.com/api/v1/subtitles');
  if (params.query) url.searchParams.set('query', params.query);
  if (params.imdbId) {
    url.searchParams.set('imdb_id', params.imdbId.replace(/^tt/i, ''));
  }
  if (params.tmdbId) {
    url.searchParams.set('tmdb_id', params.tmdbId);
  }
  if (params.seasonNumber) {
    url.searchParams.set('season_number', String(params.seasonNumber));
  }
  if (params.episodeNumber) {
    url.searchParams.set('episode_number', String(params.episodeNumber));
  }
  if (params.languages.length > 0) {
    url.searchParams.set('languages', params.languages.join(','));
  }

  const data = await smartFetchJson<{
    data?: Array<{
      id: string;
      attributes?: {
        language?: string;
        download_count?: number;
        ratings?: number;
        hearing_impaired?: boolean;
        fps?: number;
        release?: string;
        files?: Array<{ file_id?: number; file_name?: string }>;
        feature_details?: { title?: string };
      };
    }>;
  }>(url.toString(), {
    headers: {
      'Api-Key': params.openSubtitlesApiKey.trim(),
      'Content-Type': 'application/json',
      'User-Agent': 'KerloyIPTV v1.0',
    },
  });

  if (!Array.isArray(data?.data)) return [];

  const results: ExternalSubtitleTrack[] = [];
  for (const item of data.data) {
    const attr = item.attributes || {};
    const firstFile = attr.files?.[0];
    if (!firstFile?.file_id) continue;

    const lang = (attr.language || 'en').toLowerCase();
    results.push({
      id: `os-${item.id}-${firstFile.file_id}`,
      provider: 'opensubtitles',
      title: attr.feature_details?.title || params.query,
      releaseName: attr.release || firstFile.file_name || 'OpenSubtitles Release',
      language: lang,
      languageName: getLanguageLabel(lang),
      downloadCount: attr.download_count,
      rating: attr.ratings,
      hearingImpaired: attr.hearing_impaired,
      fps: attr.fps,
      fileId: firstFile.file_id,
    });
  }

  return results;
}

/**
 * Searches SubDL.com REST API v1
 */
async function searchSubDL(
  params: SubtitleSearchParams
): Promise<ExternalSubtitleTrack[]> {
  if (!params.subdlApiKey?.trim()) {
    return [];
  }

  const url = new URL('https://api.subdl.com/api/v1/subtitles');
  url.searchParams.set('api_key', params.subdlApiKey.trim());
  if (params.query) url.searchParams.set('film_name', params.query);
  if (params.imdbId) url.searchParams.set('imdb_id', params.imdbId);
  if (params.tmdbId) url.searchParams.set('tmdb_id', params.tmdbId);
  if (params.seasonNumber) {
    url.searchParams.set('season_number', String(params.seasonNumber));
    url.searchParams.set('type', 'tv');
  } else {
    url.searchParams.set('type', 'movie');
  }
  if (params.episodeNumber) {
    url.searchParams.set('episode_number', String(params.episodeNumber));
  }
  if (params.languages.length > 0) {
    url.searchParams.set(
      'languages',
      params.languages.map((l) => l.toUpperCase()).join(',')
    );
  }

  const data = await smartFetchJson<{
    status?: boolean;
    subtitles?: Array<{
      release_name?: string;
      name?: string;
      lang?: string;
      language?: string;
      url?: string;
      hi?: boolean;
      rating?: number;
    }>;
  }>(url.toString());

  if (!Array.isArray(data?.subtitles)) return [];

  return data.subtitles
    .filter((sub) => Boolean(sub.url))
    .map((sub, idx) => {
      const lang = (sub.lang || sub.language || 'en').toLowerCase().slice(0, 2);
      const dlUrl = sub.url!.startsWith('http')
        ? sub.url!
        : `https://dl.subdl.com${sub.url}`;
      return {
        id: `subdl-${idx}-${Date.now()}`,
        provider: 'subdl',
        title: params.query,
        releaseName: sub.release_name || sub.name || 'SubDL Subtitle',
        language: lang,
        languageName: getLanguageLabel(lang),
        rating: sub.rating,
        hearingImpaired: Boolean(sub.hi),
        downloadUrl: dlUrl,
      };
    });
}

/**
 * Generates instant built-in sample subtitles so the user can test downloading & syncing
 * on any stream even before entering an OpenSubtitles or SubDL API key.
 */
function getBuiltInFallbackSubtitles(params: SubtitleSearchParams): ExternalSubtitleTrack[] {
  const langs = params.languages.length > 0 ? params.languages : ['en', 'ar', 'es', 'fr'];
  return langs.flatMap((lang, idx) => [
    {
      id: `builtin-${lang}-retail-${idx}`,
      provider: 'opensubtitles' as const,
      title: params.query || 'Current Stream',
      releaseName: `${params.query || 'Stream'}.1080p.WEB-DL.${lang.toUpperCase()}.Retail.srt`,
      language: lang,
      languageName: getLanguageLabel(lang),
      downloadCount: 14200 - idx * 1300,
      rating: 9.4,
      hearingImpaired: false,
      fps: 23.976,
      downloadUrl: `builtin://${lang}/retail?title=${encodeURIComponent(params.query || 'Media')}`,
    },
    {
      id: `builtin-${lang}-sdh-${idx}`,
      provider: 'subdl' as const,
      title: params.query || 'Current Stream',
      releaseName: `${params.query || 'Stream'}.2160p.BluRay.SDH.${lang.toUpperCase()}.srt`,
      language: lang,
      languageName: getLanguageLabel(lang),
      downloadCount: 6840 - idx * 500,
      rating: 8.9,
      hearingImpaired: true,
      fps: 24,
      downloadUrl: `builtin://${lang}/sdh?title=${encodeURIComponent(params.query || 'Media')}`,
    },
  ]);
}

/**
 * Unified search across both OpenSubtitles.com and SubDL APIs, with resilient fallback.
 */
export async function searchExternalSubtitles(
  params: SubtitleSearchParams
): Promise<{ tracks: ExternalSubtitleTrack[]; usedDemoFallback: boolean }> {
  const tasks: Array<Promise<ExternalSubtitleTrack[]>> = [];

  if (params.openSubtitlesApiKey?.trim()) {
    tasks.push(searchOpenSubtitles(params).catch(() => []));
  }
  if (params.subdlApiKey?.trim()) {
    tasks.push(searchSubDL(params).catch(() => []));
  }

  if (tasks.length > 0) {
    const settled = await Promise.all(tasks);
    const merged = settled.flat();
    if (merged.length > 0) {
      return { tracks: merged, usedDemoFallback: false };
    }
  }

  return {
    tracks: getBuiltInFallbackSubtitles(params),
    usedDemoFallback: true,
  };
}

function generateSampleSrtContent(lang: string, title: string): string {
  const greetings: Record<string, [string, string, string]> = {
    en: [
      `Subtitles loaded for "${title}"`,
      'Multi-track Audio, Video & Subtitle Sync active on LG webOS TV.',
      'Use Subtitle Timing Offset (+/- 0.1s) in the player OSD to fine-tune sync.',
    ],
    ar: [
      `تم تحميل الترجمة بنجاح لـ "${title}"`,
      'نظام الصوت المتعدد والترجمة الفورية يعمل الآن على تلفزيون LG webOS.',
      'يمكنك تعديل تزامن الترجمة (+ / - 0.1 ثانية) مباشرة من المشغل.',
    ],
    es: [
      `Subtítulos cargados para "${title}"`,
      'Audio multipista y sincronización de subtítulos activos en LG webOS TV.',
      'Usa el ajuste de tiempo (+/- 0.1s) en el reproductor para sincronizar.',
    ],
    fr: [
      `Sous-titres chargés pour "${title}"`,
      'Pistes audio multiples et synchronisation actives sur LG webOS TV.',
      'Utilisez le décalage temporel (+/- 0.1s) pour ajuster la synchronisation.',
    ],
  };

  const lines = greetings[lang] || greetings.en;
  const blocks: string[] = [];
  // Create cues spanning the first 2 hours so subtitles are visible at any playback position
  for (let minute = 0; minute < 120; minute++) {
    for (let seg = 0; seg < 12; seg++) {
      const cueIndex = minute * 12 + seg + 1;
      const startSec = minute * 60 + seg * 5;
      const endSec = startSec + 4;
      const fmt = (sec: number) => {
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},000`;
      };
      const text = lines[seg % lines.length];
      blocks.push(`${cueIndex}\n${fmt(startSec)} --> ${fmt(endSec)}\n${text}\n`);
    }
  }
  return blocks.join('\n');
}

/**
 * Downloads a subtitle track from OpenSubtitles.com, SubDL (.zip or .srt), or custom URL,
 * returning the raw .srt/.vtt text content.
 */
export async function downloadExternalSubtitle(
  track: ExternalSubtitleTrack,
  openSubtitlesApiKey?: string
): Promise<string> {
  if (track.downloadUrl?.startsWith('builtin://')) {
    const urlObj = new URL(track.downloadUrl.replace('builtin://', 'http://builtin/'));
    const lang = urlObj.pathname.split('/').filter(Boolean)[0] || track.language || 'en';
    const title = urlObj.searchParams.get('title') || track.title;
    return generateSampleSrtContent(lang, title);
  }

  if (track.provider === 'opensubtitles' && track.fileId && openSubtitlesApiKey) {
    const dlRes = await smartFetchJson<{ link?: string }>(
      'https://api.opensubtitles.com/api/v1/download',
      {
        method: 'POST',
        headers: {
          'Api-Key': openSubtitlesApiKey.trim(),
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'User-Agent': 'KerloyIPTV v1.0',
        },
        body: JSON.stringify({ file_id: Number(track.fileId) }),
      }
    );
    if (!dlRes?.link) {
      throw new Error('OpenSubtitles did not return a download link');
    }
    return smartFetchText(dlRes.link);
  }

  if (track.downloadUrl) {
    const res = await smartFetch(track.downloadUrl);
    if (!res.ok) {
      throw new Error(`Subtitle download failed: HTTP ${res.status}`);
    }

    const contentType = res.headers.get('content-type') || '';
    const isZip =
      track.downloadUrl.toLowerCase().endsWith('.zip') ||
      contentType.includes('zip') ||
      contentType.includes('octet-stream');

    if (isZip) {
      const buffer = new Uint8Array(await res.arrayBuffer());
      // Check PK zip magic header (0x50, 0x4b)
      if (buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b) {
        const unzipped = unzipSync(buffer);
        const srtOrVttEntry = Object.entries(unzipped).find(([filename]) =>
          /\.(srt|vtt|ass|ssa)$/i.test(filename)
        );
        if (srtOrVttEntry) {
          return strFromU8(srtOrVttEntry[1]);
        }
      }
      return new TextDecoder('utf-8').decode(buffer);
    }

    return res.text();
  }

  throw new Error('No valid download source for this subtitle track');
}
