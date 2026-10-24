import React from 'react';
import { Volume2, Film, Maximize2, Check, X, Cpu } from 'lucide-react';
import type { AudioTrackOption, VideoTrackOption } from '../../types/iptv';
import { useAppStore } from '../../store/useAppStore';

interface TrackSelectorModalProps {
  audioTracks: AudioTrackOption[];
  videoTracks: VideoTrackOption[];
  activeAudioIndex: number;
  activeVideoIndex: number;
  onSelectAudioTrack: (index: number) => void;
  onSelectVideoTrack: (index: number) => void;
  onClose: () => void;
}

export const TrackSelectorModal: React.FC<TrackSelectorModalProps> = ({
  audioTracks,
  videoTracks,
  activeAudioIndex,
  activeVideoIndex,
  onSelectAudioTrack,
  onSelectVideoTrack,
  onClose,
}) => {
  const { settings, updateSettings } = useAppStore();

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-[#0F1626] border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-[#141D33]">
          <div className="flex items-center space-x-3">
            <Volume2 className="w-6 h-6 text-amber-400" />
            <div>
              <h2 className="text-xl font-bold text-white">
                Audio & Video Stream Selector
              </h2>
              <p className="text-xs text-slate-400">
                Choose multi-language audio tracks, video resolution streams, and screen aspect ratio
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 focus:ring-2 focus:ring-sky-400 text-slate-200 flex items-center space-x-1"
          >
            <X className="w-4 h-4" />
            <span>Close</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Audio Streams Column */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center space-x-2">
              <Volume2 className="w-4 h-4" />
              <span>Audio Streams ({audioTracks.length})</span>
            </h3>
            <div className="space-y-2">
              {audioTracks.map((track) => {
                const isSelected = activeAudioIndex === track.index;
                return (
                  <button
                    key={track.id}
                    onClick={() => onSelectAudioTrack(track.index)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all focus:outline-none focus:ring-2 focus:ring-amber-400 ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-400 text-white'
                        : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-sm">{track.label}</div>
                      <div className="text-xs text-slate-400 flex items-center space-x-2 mt-0.5">
                        <span>Lang: {track.language.toUpperCase()}</span>
                        {track.codec && <span>• Codec: {track.codec}</span>}
                        {track.channels && <span>• {track.channels}ch</span>}
                      </div>
                    </div>
                    {isSelected && <Check className="w-5 h-5 text-amber-400" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Video Streams Column */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-sky-400 flex items-center space-x-2">
              <Film className="w-4 h-4" />
              <span>Video Streams & Quality ({videoTracks.length})</span>
            </h3>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {videoTracks.map((vTrack) => {
                const isSelected = activeVideoIndex === vTrack.index;
                return (
                  <button
                    key={vTrack.id}
                    onClick={() => onSelectVideoTrack(vTrack.index)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all focus:outline-none focus:ring-2 focus:ring-sky-400 ${
                      isSelected
                        ? 'bg-sky-500/20 border-sky-400 text-white'
                        : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-sm">{vTrack.label}</div>
                      <div className="text-xs text-slate-400 flex items-center space-x-2 mt-0.5">
                        {vTrack.width && vTrack.height && (
                          <span>
                            {vTrack.width}×{vTrack.height}
                          </span>
                        )}
                        {vTrack.bitrate && (
                          <span>
                            • {(vTrack.bitrate / 1_000_000).toFixed(2)} Mbps
                          </span>
                        )}
                        {vTrack.codec && <span>• {vTrack.codec}</span>}
                      </div>
                    </div>
                    {isSelected && <Check className="w-5 h-5 text-sky-400" />}
                  </button>
                );
              })}
            </div>

            {/* Aspect Ratio & Decoder */}
            <div className="pt-4 border-t border-slate-800 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Screen Aspect Ratio</span>
              </h4>
              <div className="grid grid-cols-4 gap-2">
                {(['fit', 'fill', '16:9', '4:3'] as const).map((ratio) => (
                  <button
                    key={ratio}
                    onClick={() => updateSettings({ aspectRatio: ratio })}
                    className={`py-2 rounded-lg text-xs font-bold uppercase border focus:ring-2 focus:ring-sky-400 ${
                      settings.aspectRatio === ratio
                        ? 'bg-sky-500 text-slate-950 border-sky-400'
                        : 'bg-slate-900 text-slate-300 border-slate-700'
                    }`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>

              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5 pt-2">
                <Cpu className="w-3.5 h-3.5" />
                <span>webOS Decoder Pipeline</span>
              </h4>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'auto', label: 'Auto Hybrid' },
                    { id: 'hlsjs', label: 'HLS.js MSE' },
                    { id: 'native', label: 'webOS Native' },
                  ] as const
                ).map((eng) => (
                  <button
                    key={eng.id}
                    onClick={() => updateSettings({ playerEngine: eng.id })}
                    className={`py-2 rounded-lg text-xs font-bold border focus:ring-2 focus:ring-sky-400 ${
                      settings.playerEngine === eng.id
                        ? 'bg-indigo-500 text-white border-indigo-400'
                        : 'bg-slate-900 text-slate-300 border-slate-700'
                    }`}
                  >
                    {eng.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
