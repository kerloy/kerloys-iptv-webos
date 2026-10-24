/**
 * Parses an SRT or WebVTT timestamp string (e.g. "01:23:45,678" or "01:23:45.678")
 * into milliseconds.
 */
export function parseSubtitleTimeMs(rawTime: string): number {
  const clean = rawTime.trim().replace(',', '.');
  const parts = clean.split(':');
  if (parts.length === 3) {
    const hours = Number(parts[0]) || 0;
    const minutes = Number(parts[1]) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return Math.round((hours * 3600 + minutes * 60 + seconds) * 1000);
  }
  if (parts.length === 2) {
    const minutes = Number(parts[0]) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    return Math.round((minutes * 60 + seconds) * 1000);
  }
  return 0;
}

/**
 * Formats milliseconds into WebVTT timestamp "HH:MM:SS.mmm"
 */
export function formatVttTimeMs(ms: number): string {
  const clamped = Math.max(0, Math.round(ms));
  const hours = Math.floor(clamped / 3_600_000);
  const minutes = Math.floor((clamped % 3_600_000) / 60_000);
  const seconds = Math.floor((clamped % 60_000) / 1000);
  const millis = clamped % 1000;

  return (
    `${String(hours).padStart(2, '0')}:` +
    `${String(minutes).padStart(2, '0')}:` +
    `${String(seconds).padStart(2, '0')}.` +
    `${String(millis).padStart(3, '0')}`
  );
}

const TIMECODE_LINE_REGEX =
  /^(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}|\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}|\d{2}:\d{2}[,.]\d{1,3})(.*)$/;

/**
 * Converts SRT or WebVTT subtitle content into a valid WebVTT string,
 * applying an optional timing offset (in milliseconds, e.g. +500 or -1200)
 * and stripping ASS/SSA override tags like {\an8}.
 */
export function convertToWebVtt(rawContent: string, offsetMs = 0): string {
  const normalized = rawContent
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const lines = normalized.split('\n');
  const output: string[] = ['WEBVTT', ''];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trimEnd();

    if (i === 0 && line.toUpperCase().startsWith('WEBVTT')) {
      continue;
    }

    const match = line.trim().match(TIMECODE_LINE_REGEX);
    if (match) {
      const startMs = parseSubtitleTimeMs(match[1]) + offsetMs;
      const endMs = Math.max(startMs + 100, parseSubtitleTimeMs(match[2]) + offsetMs);
      const settingsSuffix = match[3] || '';
      output.push(`${formatVttTimeMs(startMs)} --> ${formatVttTimeMs(endMs)}${settingsSuffix}`);
      continue;
    }

    // Strip ASS/SSA style tags such as {\an8} or {\pos(100,200)}
    const cleanedLine = line.replace(/\{\\[^}]*\}/g, '');
    output.push(cleanedLine);
  }

  return output.join('\n');
}

/**
 * Creates a Blob URL for a WebVTT string that can be attached to an HTML5 <track> element.
 */
export function createVttBlobUrl(rawContent: string, offsetMs = 0): string {
  const vttString = convertToWebVtt(rawContent, offsetMs);
  const blob = new Blob([vttString], { type: 'text/vtt;charset=utf-8' });
  return URL.createObjectURL(blob);
}
