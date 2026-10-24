import type { EpgProgram } from '../../types/iptv';

/**
 * Parses XMLTV timestamp format "YYYYMMDDHHMMSS +0000" into Unix epoch milliseconds.
 */
export function parseXmltvTimestamp(raw: string): number {
  const clean = raw.trim();
  const match = clean.match(
    /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(?:\s*([+-]\d{4}))?/
  );
  if (!match) return Date.now();

  const [, year, month, day, hour, minute, second, tz] = match;
  const isoTz = tz ? `${tz.slice(0, 3)}:${tz.slice(3, 5)}` : 'Z';
  const isoString = `${year}-${month}-${day}T${hour}:${minute}:${second}${isoTz}`;
  const parsed = Date.parse(isoString);
  return Number.isNaN(parsed) ? Date.now() : parsed;
}

/**
 * Lightweight XMLTV EPG parser that extracts <programme> entries and maps them by channel ID.
 */
export function parseXmltvEpg(xmlContent: string): Map<string, EpgProgram[]> {
  const programsByChannel = new Map<string, EpgProgram[]>();
  const programmeRegex =
    /<programme\s+[^>]*start="([^"]+)"[^>]*stop="([^"]+)"[^>]*channel="([^"]+)"[^>]*>([\s\S]*?)<\/programme>/gi;
  const titleRegex = /<title[^>]*>([\s\S]*?)<\/title>/i;
  const descRegex = /<desc[^>]*>([\s\S]*?)<\/desc>/i;

  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = programmeRegex.exec(xmlContent)) !== null) {
    index += 1;
    const start = parseXmltvTimestamp(match[1]);
    const end = parseXmltvTimestamp(match[2]);
    const channelId = match[3].trim();
    const innerXml = match[4];

    const titleMatch = innerXml.match(titleRegex);
    const descMatch = innerXml.match(descRegex);

    const decodeEntities = (str: string) =>
      str
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();

    const program: EpgProgram = {
      id: `xmltv-${channelId}-${index}`,
      channelId,
      title: titleMatch ? decodeEntities(titleMatch[1]) : 'Scheduled Program',
      description: descMatch ? decodeEntities(descMatch[1]) : '',
      start,
      end,
    };

    const existing = programsByChannel.get(channelId) || [];
    existing.push(program);
    programsByChannel.set(channelId, existing);
  }

  for (const [chId, list] of programsByChannel.entries()) {
    list.sort((a, b) => a.start - b.start);
    programsByChannel.set(chId, list);
  }

  return programsByChannel;
}
