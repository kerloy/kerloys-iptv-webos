import { describe, it, expect } from 'vitest';
import { parseM3UPlaylist } from '../services/m3u/m3uParser';
import { XtreamClient, normalizeServerUrl } from '../services/xtream/xtreamClient';
import { convertToWebVtt, parseSubtitleTimeMs } from '../services/subtitles/srtToVtt';
import { parseSubtitleCues, getActiveCueText } from '../services/subtitles/vttParser';
import { executeGlobalSearch } from '../services/search/searchEngine';
import { DEMO_LIVE_CHANNELS, DEMO_MOVIES, DEMO_SERIES } from '../services/demo/demoCatalog';

describe('M3U / M3U8 Playlist Parser', () => {
  it('classifies Live TV, Movies (VOD), and groups TV Series SxxExx episodes automatically', () => {
    const sampleM3U = `#EXTM3U url-tvg="http://epg.example.com/xmltv.xml"
#EXTINF:-1 tvg-id="sky.news" tvg-logo="http://img/news.png" group-title="World News",Global News HD
http://stream.example.com/live/101.m3u8
#EXTINF:-1 tvg-logo="http://img/dune.jpg" group-title="4K Movies",Dune Part Two (2024)
http://stream.example.com/movie/dune2.mkv
#EXTINF:-1 tvg-logo="http://img/silo.jpg" group-title="Sci-Fi Series",Silo S01E01 - Freedom Day
http://stream.example.com/series/silo_s01e01.mp4
#EXTINF:-1 tvg-logo="http://img/silo.jpg" group-title="Sci-Fi Series",Silo S01E02 - Holston's Pick
http://stream.example.com/series/silo_s01e02.mp4
`;

    const parsed = parseM3UPlaylist(sampleM3U);
    expect(parsed.epgUrl).toBe('http://epg.example.com/xmltv.xml');
    expect(parsed.liveChannels).toHaveLength(1);
    expect(parsed.liveChannels[0].name).toBe('Global News HD');

    expect(parsed.movies).toHaveLength(1);
    expect(parsed.movies[0].name).toBe('Dune Part Two (2024)');
    expect(parsed.movies[0].year).toBe('2024');
    expect(parsed.movies[0].containerExtension).toBe('mkv');

    expect(parsed.series).toHaveLength(1);
    expect(parsed.series[0].name).toBe('Silo');
    expect(parsed.series[0].seasons).toHaveLength(1);
    expect(parsed.series[0].seasons[0].episodes).toHaveLength(2);
  });
});

describe('Xtream Codes Client URL Builders', () => {
  it('normalizes portal URLs and generates Live, VOD, and Series stream URLs', () => {
    expect(normalizeServerUrl('line.iptv-server.com:8080/')).toBe(
      'http://line.iptv-server.com:8080'
    );

    const client = new XtreamClient('http://portal.example.com:8080/', 'alice', 'secret123', 'm3u8');
    expect(client.buildLiveStreamUrl(999)).toBe(
      'http://portal.example.com:8080/live/alice/secret123/999.m3u8'
    );
    expect(client.buildVodStreamUrl(444, 'mkv')).toBe(
      'http://portal.example.com:8080/movie/alice/secret123/444.mkv'
    );
    expect(client.buildSeriesStreamUrl(555, 'mp4')).toBe(
      'http://portal.example.com:8080/series/alice/secret123/555.mp4'
    );
  });
});

describe('Subtitle SRT-to-WebVTT & Sync Offset Engine', () => {
  const sampleSrt = `1
00:00:10,000 --> 00:00:14,500
{\\an8}Welcome to Kerloy IPTV on LG webOS!

2
00:00:20,000 --> 00:00:25,000
Multi-audio and subtitle sync test.
`;

  it('parses timestamps and converts SRT to WebVTT with timing offset', () => {
    expect(parseSubtitleTimeMs('00:01:05,250')).toBe(65250);

    const vtt = convertToWebVtt(sampleSrt, 1500); // +1.5s offset
    expect(vtt).toContain('WEBVTT');
    expect(vtt).toContain('00:00:11.500 --> 00:00:16.000');
    expect(vtt).not.toContain('{\\an8}');
  });

  it('finds active subtitle cue accounting for user timing offset', () => {
    const cues = parseSubtitleCues(sampleSrt);
    expect(cues).toHaveLength(2);
    expect(getActiveCueText(cues, 12, 0)).toBe(
      'Welcome to Kerloy IPTV on LG webOS!'
    );
    // With +2000ms (+2.0s) delay, cue 1 appears between 12s and 16.5s
    expect(getActiveCueText(cues, 10.5, 2000)).toBeNull();
    expect(getActiveCueText(cues, 13.0, 2000)).toBe(
      'Welcome to Kerloy IPTV on LG webOS!'
    );
  });
});

describe('Global Multi-Facet Search Engine', () => {
  it('searches across Live TV, Movies, and Series with relevance ranking', () => {
    const res = executeGlobalSearch(
      {
        liveChannels: DEMO_LIVE_CHANNELS,
        movies: DEMO_MOVIES,
        series: DEMO_SERIES,
      },
      {
        query: 'Sintel',
        mediaType: 'all',
        includeAdult: false,
      }
    );

    expect(res.movies.length).toBeGreaterThanOrEqual(1);
    expect(res.movies[0].name).toContain('Sintel');
    expect(res.totalCount).toBeGreaterThanOrEqual(2);
  });
});
