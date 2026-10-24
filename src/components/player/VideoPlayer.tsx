import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import mpegts from 'mpegts.js';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Subtitles,
  Sliders,
  ArrowLeft,
  SkipBack,
  SkipForward,
  Heart,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import type {
  AudioTrackOption,
  PlayableMedia,
  SubtitleTrackOption,
  VideoTrackOption,
} from '../../types/iptv';
import { useAppStore } from '../../store/useAppStore';
import { TV_KEYS, isBackKey } from '../../utils/tvRemote';
import { toPlayableStreamUrl } from '../../utils/network';
import {
  getActiveCueText,
  parseSubtitleCues,
  type SubtitleCue,
} from '../../services/subtitles/vttParser';
import {
  loadSubtitlesFromCache,
  saveSubtitlesToCache,
} from '../../services/storage/catalogCache';
import { SubtitleModal } from './SubtitleModal';
import { TrackSelectorModal } from './TrackSelectorModal';

interface VideoPlayerProps {
  media: PlayableMedia;
  onClose: () => void;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ media, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const mpegtsRef = useRef<mpegts.Player | null>(null);
  const osdTimeoutRef = useRef<number | null>(null);
  const triedFallbackRef = useRef<boolean>(false);

  const {
    settings,
    liveChannels,
    setActiveMedia,
    updateWatchProgress,
    toggleFavorite,
    isFavorite,
  } = useAppStore();

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isBuffering, setIsBuffering] = useState(true);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [showOsd, setShowOsd] = useState(true);
  const [activeStreamUrl, setActiveStreamUrl] = useState(media.streamUrl);

  // Audio, Video & Subtitle tracks
  const [audioTracks, setAudioTracks] = useState<AudioTrackOption[]>([]);
  const [videoTracks, setVideoTracks] = useState<VideoTrackOption[]>([]);
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrackOption[]>([]);

  const [activeAudioIndex, setActiveAudioIndex] = useState<number>(0);
  const [activeVideoIndex, setActiveVideoIndex] = useState<number>(-1); // -1 = Auto ABR
  const [activeSubtitleId, setActiveSubtitleId] = useState<string>('off');
  const [subtitleOffsetMs, setSubtitleOffsetMs] = useState<number>(0);
  const [parsedCues, setParsedCues] = useState<SubtitleCue[]>([]);
  const [currentCueText, setCurrentCueText] = useState<string | null>(null);

  // Modals
  const [showSubtitleModal, setShowSubtitleModal] = useState(false);
  const [showTrackModal, setShowTrackModal] = useState(false);

  const revealOsd = useCallback(() => {
    setShowOsd(true);
    if (osdTimeoutRef.current) {
      window.clearTimeout(osdTimeoutRef.current);
    }
    osdTimeoutRef.current = window.setTimeout(() => {
      if (!showSubtitleModal && !showTrackModal) {
        setShowOsd(false);
      }
    }, 5500);
  }, [showSubtitleModal, showTrackModal]);

  const cleanupEngines = () => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (mpegtsRef.current) {
      try {
        mpegtsRef.current.unload();
        mpegtsRef.current.detachMediaElement();
        mpegtsRef.current.destroy();
      } catch {
        // Ignore cleanup errors
      }
      mpegtsRef.current = null;
    }
  };

  const initPlayback = useCallback(
    (rawStreamUrl: string, forceFormat?: 'm3u8' | 'ts' | 'native' | 'h264') => {
      const video = videoRef.current;
      if (!video) return;

      cleanupEngines();
      setIsBuffering(true);
      setPlaybackError(null);

      // For Xtream Codes Live TV URLs (/live/user/pass/123.m3u8), prefer .ts directly
      // since most Xtream servers return HTTP 405 on .m3u8 and serve raw MPEG-TS on .ts.
      let effectiveRawUrl = rawStreamUrl;
      if (
        !forceFormat &&
        media.type === 'live' &&
        /\/live\/[^/]+\/[^/]+\/\d+\.m3u8$/i.test(rawStreamUrl)
      ) {
        effectiveRawUrl = rawStreamUrl.replace(/\.m3u8$/i, '.ts');
      }

      setActiveStreamUrl(effectiveRawUrl);

      let playableUrl = toPlayableStreamUrl(effectiveRawUrl);
      if (forceFormat === 'h264' && playableUrl.startsWith('/__proxy')) {
        playableUrl += '&transcode=h264';
      } else if (forceFormat === 'native' && playableUrl.startsWith('/__proxy')) {
        playableUrl += '&transcode=mp4';
      }

      const lowerRaw = effectiveRawUrl.toLowerCase();

      // Only use mpegts.js for Live TV .ts streams (or explicit 'ts'/'h264' mode).
      // VOD Movies & Series (.mp4, .mkv, .avi) use the native HTML5 <video> element
      // (with automatic Fragmented-MP4 remuxing in /__proxy for .mkv/.avi).
      const isTS =
        forceFormat === 'ts' ||
        forceFormat === 'h264' ||
        (!forceFormat &&
          media.type === 'live' &&
          (lowerRaw.endsWith('.ts') ||
            lowerRaw.includes('.ts?') ||
            media.containerExtension === 'ts'));

      const isM3U8 =
        forceFormat === 'm3u8' ||
        (!forceFormat &&
          !isTS &&
          (lowerRaw.includes('.m3u8') || media.containerExtension === 'm3u8'));

      // 1. MPEG-TS Engine (Live raw .ts streams — very common on Xtream Codes!)
      if (isTS && mpegts.isSupported() && settings.playerEngine !== 'native') {
        const absolutePlayableUrl = playableUrl.startsWith('/')
          ? `${window.location.origin}${playableUrl}`
          : playableUrl;

        const player = mpegts.createPlayer(
          {
            type: 'mpegts',
            isLive: media.type === 'live',
            url: absolutePlayableUrl,
            cors: true,
          },
          {
            enableWorker: true,
            enableStashBuffer: true,
            stashInitialSize: 384 * 1024,
            autoCleanupSourceBuffer: true,
            liveBufferLatencyChasing: false,
          }
        );
        mpegtsRef.current = player;
        player.attachMediaElement(video);
        player.load();
        Promise.resolve(player.play()).catch(() => {});

        player.on(mpegts.Events.ERROR, (errType, errDetail, errInfo) => {
          console.warn('[MPEG-TS Player Error]', errType, errDetail, errInfo);
          if (video.readyState < 2) {
            if (forceFormat !== 'h264' && playableUrl.startsWith('/__proxy')) {
              initPlayback(effectiveRawUrl, 'h264');
              return;
            }
            setPlaybackError(
              `MPEG-TS Error (${errType}: ${errDetail}). ${
                errInfo?.msg || 'Your stream may use HEVC/AC3 or require transcoding.'
              }`
            );
            setIsBuffering(false);
          }
        });

        setAudioTracks([
          {
            id: 'ts-audio-0',
            index: 0,
            label: 'Primary Broadcast Audio (MPEG-TS)',
            language: 'en',
            active: true,
          },
        ]);
        setVideoTracks([
          {
            id: 'ts-video-auto',
            index: -1,
            label: 'Direct Broadcast Stream (MPEG-TS)',
            active: true,
          },
        ]);
        return;
      }

      // 2. HLS.js Engine (Multi-track Audio, Video Bitrate Levels & Embedded Subtitles)
      if (isM3U8 && Hls.isSupported() && settings.playerEngine !== 'native') {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: media.type === 'live',
          manifestLoadingTimeOut: 15000,
          levelLoadingTimeOut: 15000,
        });
        hlsRef.current = hls;
        hls.loadSource(playableUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
          setIsBuffering(false);
          if (media.startPositionSec && media.type !== 'live') {
            video.currentTime = media.startPositionSec;
          }
          video.play().catch(() => {});

          const vLevels: VideoTrackOption[] = [
            {
              id: 'hls-v-auto',
              index: -1,
              label: 'Auto Adaptive Quality (Recommended)',
              active: true,
            },
            ...data.levels.map((lvl, idx) => ({
              id: `hls-v-${idx}`,
              index: idx,
              label: lvl.height ? `${lvl.height}p HD` : `Stream Level ${idx + 1}`,
              width: lvl.width,
              height: lvl.height,
              bitrate: lvl.bitrate,
              codec: lvl.videoCodec,
              active: false,
            })),
          ];
          setVideoTracks(vLevels);

          if (hls.audioTracks && hls.audioTracks.length > 0) {
            setAudioTracks(
              hls.audioTracks.map((at, idx) => ({
                id: `hls-a-${idx}`,
                index: idx,
                label: at.name || `Audio Track ${idx + 1}`,
                language: at.lang || 'en',
                codec: at.attrs?.CODECS,
                channels: at.attrs?.CHANNELS,
                active: idx === hls.audioTrack,
              }))
            );
            setActiveAudioIndex(hls.audioTrack >= 0 ? hls.audioTrack : 0);
          } else {
            setAudioTracks(
              (media.audioTracksHint || ['Default Stereo Audio']).map(
                (label, idx) => ({
                  id: `hint-a-${idx}`,
                  index: idx,
                  label,
                  language: 'en',
                  active: idx === 0,
                })
              )
            );
          }

          if (hls.subtitleTracks && hls.subtitleTracks.length > 0) {
            const embeddedSubs: SubtitleTrackOption[] = hls.subtitleTracks.map(
              (st, idx) => ({
                id: `hls-sub-${idx}`,
                label: st.name || `Embedded ${st.lang || idx + 1}`,
                language: st.lang || 'en',
                source: 'embedded',
                active: false,
              })
            );
            setSubtitleTracks((prev) => {
              const externalOnly = prev.filter((p) => p.source !== 'embedded');
              return [...embeddedSubs, ...externalOnly];
            });
          }
        });

        hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_, data) => {
          if (data.audioTracks.length > 0) {
            setAudioTracks(
              data.audioTracks.map((at, idx) => ({
                id: `hls-a-${idx}`,
                index: idx,
                label: at.name || `Audio Track ${idx + 1}`,
                language: at.lang || 'en',
                active: idx === hls.audioTrack,
              }))
            );
          }
        });

        hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_, data) => {
          if (data.subtitleTracks.length > 0) {
            const embeddedSubs: SubtitleTrackOption[] = data.subtitleTracks.map(
              (st, idx) => ({
                id: `hls-sub-${idx}`,
                label: st.name || `Embedded ${st.lang || idx + 1}`,
                language: st.lang || 'en',
                source: 'embedded',
                active: false,
              })
            );
            setSubtitleTracks((prev) => {
              const externalOnly = prev.filter((p) => p.source !== 'embedded');
              return [...embeddedSubs, ...externalOnly];
            });
          }
        });

        hls.on(Hls.Events.ERROR, (_, errData) => {
          if (errData.fatal) {
            // Many Xtream servers return raw MPEG-TS even on .m3u8 URLs or only support .ts
            if (!triedFallbackRef.current) {
              triedFallbackRef.current = true;
              const tsCandidate =
                media.fallbackStreamUrl ||
                rawStreamUrl.replace(/\.m3u8(\?.*)?$/i, '.ts$1');
              initPlayback(tsCandidate, 'ts');
            } else {
              setPlaybackError(
                `Stream error (${errData.details}). Try switching to MPEG-TS (.ts) or Native Player below.`
              );
              setIsBuffering(false);
            }
          }
        });

        return;
      }

      // 3. Native webOS / HTML5 Video Pipeline (MP4, MKV, AVI, or Native HLS)
      video.src = playableUrl;
      video.load();
      video.onloadedmetadata = () => {
        setIsBuffering(false);
        if (media.startPositionSec && media.type !== 'live') {
          video.currentTime = media.startPositionSec;
        }
        video.play().catch(() => {});

        const nativeAudio = (
          video as unknown as {
            audioTracks?: ArrayLike<{
              id?: string;
              label?: string;
              language?: string;
              enabled?: boolean;
            }>;
          }
        ).audioTracks;

        if (nativeAudio && nativeAudio.length > 0) {
          const list: AudioTrackOption[] = [];
          for (let i = 0; i < nativeAudio.length; i++) {
            const t = nativeAudio[i];
            list.push({
              id: t.id || `native-a-${i}`,
              index: i,
              label: t.label || `Audio Stream ${i + 1}`,
              language: t.language || 'en',
              active: Boolean(t.enabled),
            });
          }
          setAudioTracks(list);
        } else {
          setAudioTracks(
            (media.audioTracksHint || ['Primary Hardware Audio Track']).map(
              (label, idx) => ({
                id: `native-a-${idx}`,
                index: idx,
                label,
                language: 'en',
                active: idx === 0,
              })
            )
          );
        }

        setVideoTracks([
          {
            id: 'native-v-0',
            index: -1,
            label:
              media.videoResolutionHint ||
              (video.videoHeight
                ? `Direct Hardware Stream (${video.videoWidth}×${video.videoHeight})`
                : 'Direct Hardware Video Stream'),
            width: video.videoWidth || undefined,
            height: video.videoHeight || undefined,
            active: true,
          },
        ]);
      };

      video.onerror = () => {
        if (!triedFallbackRef.current && media.type === 'live') {
          triedFallbackRef.current = true;
          initPlayback(media.fallbackStreamUrl || rawStreamUrl, 'ts');
          return;
        }
        setIsBuffering(false);
        const ext = (media.containerExtension || '').toLowerCase();
        if (ext === 'mkv' || ext === 'avi') {
          setPlaybackError(
            `Note: This VOD file uses a .${ext.toUpperCase()} container (often with AC3/DTS audio). Desktop Chrome blocks some AC3/MKV codecs that your LG webOS TV hardware decodes natively, or you can try switching Audio/Video tracks.`
          );
        } else {
          setPlaybackError(
            'Unable to decode stream. Try switching between MPEG-TS (.ts) and HLS (.m3u8) below.'
          );
        }
      };
    },
    [media, settings.playerEngine]
  );

  useEffect(() => {
    triedFallbackRef.current = false;
    initPlayback(media.streamUrl);
    revealOsd();

    // Restore any previously downloaded subtitles & timing sync offset from IndexedDB
    loadSubtitlesFromCache(media.id).then((cached) => {
      if (cached && cached.tracks.length > 0) {
        setSubtitleTracks((prev) => {
          const embeddedOnly = prev.filter((p) => p.source === 'embedded');
          return [...cached.tracks, ...embeddedOnly];
        });
        setActiveSubtitleId(cached.activeSubtitleId);
        setSubtitleOffsetMs(cached.subtitleOffsetMs);
      }
    });

    return () => {
      cleanupEngines();
      if (osdTimeoutRef.current) window.clearTimeout(osdTimeoutRef.current);
    };
  }, [initPlayback, media.id, media.streamUrl]);

  // Update active subtitle cues when active track changes
  useEffect(() => {
    const hls = hlsRef.current;
    if (activeSubtitleId === 'off') {
      if (hls) hls.subtitleTrack = -1;
      setParsedCues([]);
      setCurrentCueText(null);
      return;
    }

    if (activeSubtitleId.startsWith('hls-sub-')) {
      const idx = Number(activeSubtitleId.replace('hls-sub-', ''));
      if (hls) hls.subtitleTrack = idx;
      setParsedCues([]);
      setCurrentCueText(null);
      return;
    }

    if (hls) hls.subtitleTrack = -1;
    const found = subtitleTracks.find((t) => t.id === activeSubtitleId);
    if (found?.rawContent) {
      const cues = parseSubtitleCues(found.rawContent);
      setParsedCues(cues);
    }
  }, [activeSubtitleId, subtitleTracks]);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    const nowSec = video.currentTime;
    const durSec = video.duration || 0;
    setCurrentTime(nowSec);
    if (durSec > 0 && Number.isFinite(durSec)) {
      setDuration(durSec);
    }

    if (parsedCues.length > 0 && activeSubtitleId !== 'off') {
      const cueText = getActiveCueText(parsedCues, nowSec, subtitleOffsetMs);
      setCurrentCueText(cueText);
    }

    if (media.type !== 'live' && nowSec > 5 && Math.floor(nowSec) % 5 === 0) {
      updateWatchProgress({
        itemId: media.id,
        type: media.type,
        title: media.title,
        subtitle: media.subtitle,
        poster: media.poster || '',
        streamUrl: media.streamUrl,
        positionSec: nowSec,
        durationSec: durSec || 3600,
        updatedAt: Date.now(),
        seriesId: media.seriesId,
        seasonNum: media.seasonNumber,
        episodeNum: media.episodeNumber,
      });
    }
  };

  const handleSelectAudioTrack = (index: number) => {
    setActiveAudioIndex(index);
    if (hlsRef.current && hlsRef.current.audioTracks.length > index) {
      hlsRef.current.audioTrack = index;
    }
    const video = videoRef.current as unknown as {
      audioTracks?: ArrayLike<{ enabled?: boolean }>;
    };
    if (video?.audioTracks) {
      for (let i = 0; i < video.audioTracks.length; i++) {
        video.audioTracks[i].enabled = i === index;
      }
    }
    setAudioTracks((prev) =>
      prev.map((t) => ({ ...t, active: t.index === index }))
    );
  };

  const handleSelectVideoTrack = (index: number) => {
    setActiveVideoIndex(index);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = index;
    }
    setVideoTracks((prev) =>
      prev.map((t) => ({ ...t, active: t.index === index }))
    );
  };

  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
    revealOsd();
  }, [revealOsd]);

  const seekRelative = useCallback(
    (deltaSec: number) => {
      const video = videoRef.current;
      if (!video || media.type === 'live') return;
      video.currentTime = Math.max(
        0,
        Math.min(video.duration || 99999, video.currentTime + deltaSec)
      );
      revealOsd();
    },
    [media.type, revealOsd]
  );

  const zapLiveChannel = useCallback(
    (direction: 1 | -1) => {
      if (media.type !== 'live' || liveChannels.length === 0) return;
      const idx = liveChannels.findIndex((c) => c.id === media.id);
      if (idx === -1) return;
      const nextIdx =
        (idx + direction + liveChannels.length) % liveChannels.length;
      const nextCh = liveChannels[nextIdx];
      setActiveMedia({
        id: nextCh.id,
        type: 'live',
        title: nextCh.name,
        subtitle: nextCh.currentProgram?.title || nextCh.categoryName,
        poster: nextCh.logo,
        streamUrl: nextCh.streamUrl,
        fallbackStreamUrl: nextCh.fallbackStreamUrl,
        containerExtension: nextCh.containerExtension,
      });
    },
    [liveChannels, media.id, media.type, setActiveMedia]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      revealOsd();

      if (isBackKey(e)) {
        e.preventDefault();
        e.stopPropagation();
        if (showSubtitleModal) {
          setShowSubtitleModal(false);
        } else if (showTrackModal) {
          setShowTrackModal(false);
        } else {
          onClose();
        }
        return;
      }

      if (showSubtitleModal || showTrackModal) return;

      switch (e.keyCode) {
        case TV_KEYS.PLAY:
          videoRef.current?.play().catch(() => {});
          setIsPlaying(true);
          break;
        case TV_KEYS.PAUSE:
          videoRef.current?.pause();
          setIsPlaying(false);
          break;
        case TV_KEYS.STOP:
          onClose();
          break;
        case TV_KEYS.LEFT:
        case TV_KEYS.REWIND:
          seekRelative(-15);
          break;
        case TV_KEYS.RIGHT:
        case TV_KEYS.FAST_FORWARD:
          seekRelative(15);
          break;
        case TV_KEYS.CHANNEL_UP:
          zapLiveChannel(-1);
          break;
        case TV_KEYS.CHANNEL_DOWN:
          zapLiveChannel(1);
          break;
        case TV_KEYS.YELLOW:
          setShowTrackModal(true);
          break;
        case TV_KEYS.BLUE:
          setShowSubtitleModal(true);
          break;
        case TV_KEYS.RED:
          toggleFavorite(media.id);
          break;
        default:
          if (e.key === ' ') {
            e.preventDefault();
            togglePlayPause();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    media.id,
    onClose,
    revealOsd,
    seekRelative,
    showSubtitleModal,
    showTrackModal,
    toggleFavorite,
    togglePlayPause,
    zapLiveChannel,
  ]);

  const formatTime = (sec: number) => {
    if (!Number.isFinite(sec) || sec < 0) return '00:00';
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const aspectClass =
    settings.aspectRatio === 'fill'
      ? 'object-cover'
      : settings.aspectRatio === '16:9'
        ? 'object-fill aspect-video'
        : settings.aspectRatio === '4:3'
          ? 'object-contain max-w-[75vw]'
          : 'object-contain';

  const fontSizeClass =
    settings.subtitleFontSize === 'small'
      ? 'text-lg'
      : settings.subtitleFontSize === 'medium'
        ? 'text-2xl'
        : settings.subtitleFontSize === 'xlarge'
          ? 'text-4xl'
          : 'text-3xl';

  return (
    <div
      className="fixed inset-0 z-40 bg-black flex items-center justify-center select-none"
      onMouseMove={revealOsd}
      onClick={revealOsd}
    >
      {/* HTML5 / webOS Video Surface */}
      <video
        ref={videoRef}
        className={`w-full h-full ${aspectClass}`}
        playsInline
        autoPlay
        muted={isMuted}
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => {
          setIsPlaying(true);
          setIsBuffering(false);
        }}
        onPause={() => setIsPlaying(false)}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onCanPlay={() => setIsBuffering(false)}
      />

      {/* Custom High-Contrast Subtitle Overlay */}
      {currentCueText && activeSubtitleId !== 'off' && (
        <div className="fixed bottom-28 inset-x-0 flex justify-center pointer-events-none px-12 z-40">
          <div
            className={`px-6 py-2.5 rounded-xl font-semibold text-center whitespace-pre-line leading-snug shadow-lg ${fontSizeClass}`}
            style={{
              color: settings.subtitleColor,
              backgroundColor: `rgba(0, 0, 0, ${settings.subtitleBgOpacity / 100})`,
              textShadow: '0 2px 4px rgba(0,0,0,0.9)',
            }}
          >
            {currentCueText}
          </div>
        </div>
      )}

      {/* Buffering Indicator */}
      {isBuffering && !playbackError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 pointer-events-none">
          <RefreshCw className="w-12 h-12 text-sky-400 animate-spin mb-3" />
          <span className="text-sm font-medium text-slate-200">
            Connecting to stream via IPTV proxy...
          </span>
        </div>
      )}

      {/* Error Recovery Banner */}
      {playbackError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-8 z-50">
          <div className="bg-[#0F1626] border border-red-500/40 rounded-2xl p-6 max-w-xl text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-red-400 mx-auto" />
            <h3 className="text-lg font-bold text-white">Playback Recovery</h3>
            <p className="text-sm text-slate-300">{playbackError}</p>
            <div className="flex flex-wrap justify-center gap-2.5">
              <button
                onClick={() => {
                  const tsUrl = activeStreamUrl.replace(/\.m3u8(\?.*)?$/i, '.ts$1');
                  initPlayback(tsUrl, 'h264');
                }}
                className="px-4 py-2.5 rounded-xl bg-emerald-500 text-slate-950 font-bold text-xs"
              >
                Force H.264 + AAC Transcode
              </button>
              <button
                onClick={() => {
                  const tsUrl = activeStreamUrl.replace(/\.m3u8(\?.*)?$/i, '.ts$1');
                  initPlayback(tsUrl, 'ts');
                }}
                className="px-4 py-2.5 rounded-xl bg-sky-500 text-slate-950 font-bold text-xs"
              >
                Try MPEG-TS (.ts) Engine
              </button>
              <button
                onClick={() => {
                  const m3u8Url = activeStreamUrl.replace(/\.ts(\?.*)?$/i, '.m3u8$1');
                  initPlayback(m3u8Url, 'm3u8');
                }}
                className="px-4 py-2.5 rounded-xl bg-indigo-500 text-white font-bold text-xs"
              >
                Try HLS (.m3u8) Engine
              </button>
              <button
                onClick={() => initPlayback(activeStreamUrl, 'native')}
                className="px-4 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
              >
                Try Native HTML5 Video
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs"
              >
                Exit Player
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 10-Foot TV Player OSD */}
      {showOsd && (
        <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-b from-black/80 via-transparent to-black/90 p-8 transition-opacity">
          {/* Top Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={onClose}
                className="p-3 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-sky-400 flex items-center space-x-2"
              >
                <ArrowLeft className="w-5 h-5" />
                <span className="text-sm font-semibold">Back</span>
              </button>
              <div>
                <div className="flex items-center space-x-2.5">
                  <span className="px-2.5 py-0.5 rounded text-xs font-bold uppercase bg-sky-500 text-slate-950">
                    {media.type}
                  </span>
                  <h1 className="text-2xl font-bold text-white">
                    {media.title}
                  </h1>
                </div>
                {media.subtitle && (
                  <p className="text-sm text-slate-300 mt-0.5">
                    {media.subtitle}
                  </p>
                )}
              </div>
            </div>

            {/* Active Stream Badges */}
            <div className="flex items-center space-x-3 text-xs">
              <span className="px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700 text-amber-300 font-semibold">
                Audio: {audioTracks.find((a) => a.index === activeAudioIndex)?.label || 'Primary'}
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700 text-sky-300 font-semibold">
                Video: {videoTracks.find((v) => v.index === activeVideoIndex)?.label || 'Auto'}
              </span>
              <span className="px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700 text-emerald-300 font-semibold">
                Subtitles:{' '}
                {activeSubtitleId === 'off'
                  ? 'Off'
                  : subtitleTracks.find((s) => s.id === activeSubtitleId)?.label || 'Active'}
              </span>
            </div>
          </div>

          {/* Bottom Controls */}
          <div className="space-y-4">
            {/* Seekbar for Movies / Series */}
            {media.type !== 'live' && (
              <div className="space-y-1.5">
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    if (videoRef.current) videoRef.current.currentTime = val;
                    setCurrentTime(val);
                  }}
                  className="w-full accent-sky-400 h-2 bg-slate-700 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-xs font-mono text-slate-300">
                  <span>{formatTime(currentTime)}</span>
                  <span>-{formatTime(Math.max(0, duration - currentTime))}</span>
                </div>
              </div>
            )}

            {/* Transport & Track Buttons */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <button
                  onClick={togglePlayPause}
                  autoFocus
                  className="p-3.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold focus:ring-4 focus:ring-white"
                >
                  {isPlaying ? (
                    <Pause className="w-6 h-6" />
                  ) : (
                    <Play className="w-6 h-6" />
                  )}
                </button>

                {media.type !== 'live' && (
                  <>
                    <button
                      onClick={() => seekRelative(-15)}
                      className="p-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-sky-400 flex items-center space-x-1"
                    >
                      <SkipBack className="w-5 h-5" />
                      <span className="text-xs font-semibold">-15s</span>
                    </button>
                    <button
                      onClick={() => seekRelative(15)}
                      className="p-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-sky-400 flex items-center space-x-1"
                    >
                      <SkipForward className="w-5 h-5" />
                      <span className="text-xs font-semibold">+15s</span>
                    </button>
                  </>
                )}

                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className="p-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-sky-400"
                >
                  {isMuted ? (
                    <VolumeX className="w-5 h-5 text-red-400" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>

                <button
                  onClick={() => toggleFavorite(media.id)}
                  className="px-4 py-3 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700 text-white focus:ring-2 focus:ring-sky-400 flex items-center space-x-2"
                >
                  <Heart
                    className={`w-5 h-5 ${
                      isFavorite(media.id)
                        ? 'text-rose-500 fill-rose-500'
                        : 'text-slate-300'
                    }`}
                  />
                  <span className="text-xs font-semibold">Favorite</span>
                </button>
              </div>

              {/* Right Side: Audio/Video Streams & Subtitles */}
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setShowTrackModal(true)}
                  className="px-5 py-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 font-semibold text-sm flex items-center space-x-2 focus:ring-2 focus:ring-amber-400"
                >
                  <Sliders className="w-5 h-5 text-amber-400" />
                  <span>Audio & Video Streams</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 ml-1" title="Yellow Remote Button" />
                </button>

                <button
                  onClick={() => setShowSubtitleModal(true)}
                  className="px-5 py-3 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 border border-sky-400/50 text-sky-200 font-semibold text-sm flex items-center space-x-2 focus:ring-2 focus:ring-sky-400"
                >
                  <Subtitles className="w-5 h-5 text-sky-400" />
                  <span>Subtitles & Download (.SRT)</span>
                  <span className="w-2.5 h-2.5 rounded-full bg-sky-400 ml-1" title="Blue Remote Button" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Subtitle Search, Download & Sync Modal */}
      {showSubtitleModal && (
        <SubtitleModal
          media={media}
          subtitleTracks={subtitleTracks}
          activeSubtitleId={activeSubtitleId}
          subtitleOffsetMs={subtitleOffsetMs}
          onSelectTrack={(id) => {
            setActiveSubtitleId(id);
            saveSubtitlesToCache(media.id, subtitleTracks, id, subtitleOffsetMs);
          }}
          onAddExternalSubtitle={(newTrack) => {
            const nextTracks = [newTrack, ...subtitleTracks];
            setSubtitleTracks(nextTracks);
            setActiveSubtitleId(newTrack.id);
            saveSubtitlesToCache(media.id, nextTracks, newTrack.id, subtitleOffsetMs);
          }}
          onChangeOffsetMs={(offset) => {
            setSubtitleOffsetMs(offset);
            saveSubtitlesToCache(media.id, subtitleTracks, activeSubtitleId, offset);
          }}
          onClose={() => setShowSubtitleModal(false)}
        />
      )}

      {/* Audio & Video Stream Selector Modal */}
      {showTrackModal && (
        <TrackSelectorModal
          audioTracks={audioTracks}
          videoTracks={videoTracks}
          activeAudioIndex={activeAudioIndex}
          activeVideoIndex={activeVideoIndex}
          onSelectAudioTrack={handleSelectAudioTrack}
          onSelectVideoTrack={handleSelectVideoTrack}
          onClose={() => setShowTrackModal(false)}
        />
      )}
    </div>
  );
};
