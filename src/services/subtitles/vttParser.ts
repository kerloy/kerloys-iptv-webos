import { parseSubtitleTimeMs } from './srtToVtt';

export interface SubtitleCue {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
}

const CUE_TIMECODE_REGEX =
  /^(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}|\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3}|\d{2}:\d{2}[,.]\d{1,3})/;

/**
 * Parses SRT or WebVTT text into an array of timed SubtitleCue objects for
 * rock-solid custom OSD rendering on LG webOS 5.x+ TVs.
 */
export function parseSubtitleCues(rawContent: string): SubtitleCue[] {
  const normalized = rawContent
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  const lines = normalized.split('\n');
  const cues: SubtitleCue[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i].trim();
    const match = line.match(CUE_TIMECODE_REGEX);

    if (match) {
      const startMs = parseSubtitleTimeMs(match[1]);
      const endMs = parseSubtitleTimeMs(match[2]);
      const textLines: string[] = [];
      i += 1;

      while (i < lines.length && lines[i].trim() !== '') {
        const cleaned = lines[i]
          .replace(/\{\\[^}]*\}/g, '')
          .replace(/<\/?[a-z][^>]*>/gi, '')
          .trim();
        if (cleaned) {
          textLines.push(cleaned);
        }
        i += 1;
      }

      if (textLines.length > 0) {
        cues.push({
          id: `cue-${cues.length + 1}`,
          startMs,
          endMs,
          text: textLines.join('\n'),
        });
      }
    } else {
      i += 1;
    }
  }

  return cues;
}

/**
 * Finds active subtitle text at the given video playback time (in seconds) + user offset (in ms).
 */
export function getActiveCueText(
  cues: SubtitleCue[],
  currentTimeSec: number,
  offsetMs: number
): string | null {
  if (cues.length === 0) return null;
  const targetMs = currentTimeSec * 1000 - offsetMs;

  const active = cues.filter(
    (c) => targetMs >= c.startMs && targetMs <= c.endMs
  );
  if (active.length === 0) return null;
  return active.map((c) => c.text).join('\n');
}
