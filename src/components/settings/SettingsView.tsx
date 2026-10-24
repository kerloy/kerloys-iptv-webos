import React, { useState } from 'react';
import {
  Subtitles,
  Cpu,
  Lock,
  Tv,
  Check,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export const SettingsView: React.FC = () => {
  const { settings, updateSettings } = useAppStore();
  const [savedNotice, setSavedNotice] = useState(false);

  const triggerSaved = () => {
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  return (
    <div className="h-full overflow-y-auto pr-2 space-y-6">
      {savedNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-xs font-bold flex items-center space-x-2">
          <Check className="w-4 h-4" />
          <span>Settings saved to LG webOS persistent storage.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subtitle Providers (OpenSubtitles.com & SubDL) */}
        <div className="bg-[#0F1626] border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center space-x-2.5 text-sky-400">
            <Subtitles className="w-5 h-5" />
            <h2 className="text-lg font-bold text-white">
              OpenSubtitles.com & SubDL API Integration
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Configure your API keys to search and download .SRT / .VTT subtitles directly inside the TV player. (Built-in fallback subtitles work automatically even without keys.)
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                OpenSubtitles.com REST API Key
              </label>
              <input
                type="text"
                value={settings.openSubtitlesApiKey}
                onChange={(e) => {
                  updateSettings({ openSubtitlesApiKey: e.target.value });
                  triggerSaved();
                }}
                placeholder="Enter OpenSubtitles API Key (api.opensubtitles.com)"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                SubDL.com API Key
              </label>
              <input
                type="text"
                value={settings.subdlApiKey}
                onChange={(e) => {
                  updateSettings({ subdlApiKey: e.target.value });
                  triggerSaved();
                }}
                placeholder="Enter SubDL API Key (api.subdl.com)"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                Default Subtitle Font Size
              </label>
              <div className="flex gap-2">
                {(['small', 'medium', 'large', 'xlarge'] as const).map((sz) => (
                  <button
                    key={sz}
                    onClick={() => {
                      updateSettings({ subtitleFontSize: sz });
                      triggerSaved();
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold uppercase border ${
                      settings.subtitleFontSize === sz
                        ? 'bg-sky-500 text-slate-950 border-sky-400'
                        : 'bg-slate-900 text-slate-300 border-slate-700'
                    }`}
                  >
                    {sz}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Player & Stream Engine Configuration */}
        <div className="bg-[#0F1626] border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center space-x-2.5 text-amber-400">
            <Cpu className="w-5 h-5" />
            <h2 className="text-lg font-bold text-white">
              LG webOS 5.x+ Media & Stream Engine
            </h2>
          </div>
          <p className="text-xs text-slate-400">
            Tune how HLS (.m3u8), MPEG-TS (.ts), and VOD (.mkv / .mp4) streams are decoded on your LG TV.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                Decoder Pipeline Mode
              </label>
              <div className="grid grid-cols-3 gap-2.5">
                {(
                  [
                    { id: 'auto', label: 'Auto Hybrid (Recommended)' },
                    { id: 'hlsjs', label: 'HLS.js MSE' },
                    { id: 'native', label: 'webOS Native Hardware' },
                  ] as const
                ).map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => {
                      updateSettings({ playerEngine: mode.id });
                      triggerSaved();
                    }}
                    className={`p-3 rounded-xl text-xs font-bold border ${
                      settings.playerEngine === mode.id
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-900 text-slate-300 border-slate-700'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                Default Live TV Stream Format (Xtream Codes)
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                {(['m3u8', 'ts'] as const).map((fmt) => (
                  <button
                    key={fmt}
                    onClick={() => {
                      updateSettings({ liveStreamFormat: fmt });
                      triggerSaved();
                    }}
                    className={`p-3 rounded-xl text-xs font-bold uppercase border ${
                      settings.liveStreamFormat === fmt
                        ? 'bg-indigo-500 text-white border-indigo-400'
                        : 'bg-slate-900 text-slate-300 border-slate-700'
                    }`}
                  >
                    {fmt === 'm3u8' ? 'HLS (.m3u8)' : 'MPEG-TS (.ts)'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Parental Controls */}
        <div className="bg-[#0F1626] border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center space-x-2.5 text-rose-400">
            <Lock className="w-5 h-5" />
            <h2 className="text-lg font-bold text-white">
              Parental Controls & PIN Lock
            </h2>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-sm text-white">
                Require PIN for 18+ / Adult Categories
              </div>
              <div className="text-xs text-slate-400">
                Locks restricted channels and VOD categories until PIN is entered
              </div>
            </div>
            <button
              onClick={() => {
                updateSettings({
                  parentalEnabled: !settings.parentalEnabled,
                  unlockedSession: false,
                });
                triggerSaved();
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold ${
                settings.parentalEnabled
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {settings.parentalEnabled ? 'ENABLED' : 'DISABLED'}
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
              4-Digit Parental PIN
            </label>
            <input
              type="password"
              maxLength={4}
              value={settings.parentalPin}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
                updateSettings({ parentalPin: digits || '0000' });
                triggerSaved();
              }}
              className="w-40 px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-center font-mono tracking-widest"
            />
          </div>
        </div>

        {/* LG webOS TV Remote Shortcuts Guide */}
        <div className="bg-[#0F1626] border border-slate-800 rounded-2xl p-6 space-y-3">
          <div className="flex items-center space-x-2.5 text-emerald-400">
            <Tv className="w-5 h-5" />
            <h2 className="text-lg font-bold text-white">
              LG webOS Magic Remote & Key Shortcuts
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
              <strong className="text-rose-400">● RED Button (403):</strong> Toggle Favorite
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
              <strong className="text-emerald-400">● GREEN Button (404):</strong> Open Global Search
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
              <strong className="text-amber-400">● YELLOW Button (405):</strong> Audio & Video Streams
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
              <strong className="text-sky-400">● BLUE Button (406):</strong> Subtitles & Download
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
              <strong className="text-white">CH ▲ / ▼:</strong> Zap Live TV Channels
            </div>
            <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
              <strong className="text-white">BACK (461):</strong> Close Modal / Exit Player
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
