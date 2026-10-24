import React, { useState, useRef } from 'react';
import {
  Server,
  FileText,
  Plus,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Upload,
  ShieldCheck,
  Star,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export const PlaylistsView: React.FC = () => {
  const {
    profiles,
    activeProfileId,
    defaultProfileId,
    isLoadingPlaylist,
    playlistError,
    loadProfileCatalog,
    setDefaultProfile,
    addXtreamProfile,
    addM3UProfile,
    removeProfile,
  } = useAppStore();

  const [mode, setMode] = useState<'xtream' | 'm3u'>('xtream');

  // Xtream form state
  const [xtreamName, setXtreamName] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [liveFormat, setLiveFormat] = useState<'m3u8' | 'ts'>('ts');
  const [makeDefaultXtream, setMakeDefaultXtream] = useState(true);

  // M3U form state
  const [m3uName, setM3uName] = useState('');
  const [m3uUrl, setM3uUrl] = useState('');
  const [epgUrl, setEpgUrl] = useState('');
  const [m3uRawText, setM3uRawText] = useState('');
  const [makeDefaultM3u, setMakeDefaultM3u] = useState(true);
  const fileRef = useRef<HTMLInputElement>(null);

  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const handleAddXtream = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!serverUrl.trim() || !username.trim() || !password.trim()) return;
    setStatusBanner(null);
    try {
      await addXtreamProfile({
        name: xtreamName || `Xtream (${username})`,
        serverUrl,
        username,
        password,
        preferredLiveFormat: liveFormat,
        setAsDefault: makeDefaultXtream,
      });
      setXtreamName('');
      setServerUrl('');
      setUsername('');
      setPassword('');
      setStatusBanner(
        makeDefaultXtream
          ? 'Xtream Codes server connected & saved as your Default IPTV!'
          : 'Xtream Codes server connected & synced!'
      );
    } catch {
      // Error displayed via playlistError
    }
  };

  const handleAddM3U = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!m3uUrl.trim() && !m3uRawText.trim()) return;
    setStatusBanner(null);
    try {
      await addM3UProfile({
        name: m3uName || 'Custom M3U Playlist',
        m3uUrl: m3uUrl.trim() || undefined,
        m3uContent: m3uRawText.trim() || undefined,
        epgUrl: epgUrl.trim() || undefined,
        setAsDefault: makeDefaultM3u,
      });
      setM3uName('');
      setM3uUrl('');
      setEpgUrl('');
      setM3uRawText('');
      setStatusBanner('M3U Playlist parsed & loaded!');
    } catch {
      // Error displayed via playlistError
    }
  };

  const handleM3UFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setM3uRawText(String(reader.result || ''));
      if (!m3uName) setM3uName(file.name.replace(/\.(m3u8?|txt)$/i, ''));
    };
    reader.readAsText(file);
  };

  return (
    <div className="h-full overflow-y-auto pr-2 grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Column: Saved Profiles */}
      <div className="lg:col-span-5 space-y-4">
        <div className="bg-[#0F1626] border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">
                IPTV Sources & Default Profile
              </h2>
              <p className="text-xs text-slate-400">
                Your ★ Default IPTV loads automatically every time the app starts
              </p>
            </div>
            <button
              onClick={() => loadProfileCatalog(activeProfileId, true)}
              disabled={isLoadingPlaylist}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-sky-400 flex items-center space-x-1.5"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isLoadingPlaylist ? 'animate-spin' : ''}`}
              />
              <span>Sync Now</span>
            </button>
          </div>

          <div className="space-y-3">
            {profiles.map((prof) => {
              const isActive = prof.id === activeProfileId;
              const isDefault = prof.id === defaultProfileId || Boolean(prof.isDefault);
              return (
                <div
                  key={prof.id}
                  className={`p-4 rounded-xl border transition-all space-y-3 ${
                    isActive
                      ? 'bg-sky-500/15 border-sky-400'
                      : 'bg-slate-900/80 border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <button
                      onClick={() => loadProfileCatalog(prof.id)}
                      className="text-left flex-1 focus:outline-none"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-sky-300">
                          {prof.type}
                        </span>
                        {isDefault && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-500 text-slate-950 flex items-center space-x-1">
                            <Star className="w-3 h-3 fill-slate-950" />
                            <span>DEFAULT IPTV</span>
                          </span>
                        )}
                        <span className="font-bold text-white text-sm">
                          {prof.name}
                        </span>
                        {isActive && (
                          <CheckCircle2 className="w-4 h-4 text-sky-400" />
                        )}
                      </div>

                      {prof.serverUrl && (
                        <div className="text-xs text-slate-400 mt-1 truncate">
                          Server: {prof.serverUrl} ({prof.username})
                        </div>
                      )}
                      {prof.m3uUrl && (
                        <div className="text-xs text-slate-400 mt-1 truncate">
                          M3U: {prof.m3uUrl}
                        </div>
                      )}
                      {prof.accountInfo && (
                        <div className="text-[11px] text-emerald-400 mt-1 flex items-center space-x-3">
                          <span>Status: {prof.accountInfo.status}</span>
                          <span>Expires: {prof.accountInfo.expDate}</span>
                          <span>
                            Conns: {prof.accountInfo.activeConnections}/
                            {prof.accountInfo.maxConnections}
                          </span>
                        </div>
                      )}
                    </button>

                    {prof.id !== 'demo-profile' && (
                      <button
                        onClick={() => removeProfile(prof.id)}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800"
                        title="Remove Profile"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Action Footer: Set as Default IPTV / Switch */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                    {!isDefault ? (
                      <button
                        onClick={() => {
                          setDefaultProfile(prof.id);
                          setStatusBanner(`"${prof.name}" is now your Default IPTV source on startup!`);
                        }}
                        className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-300 text-xs font-bold flex items-center space-x-1.5"
                      >
                        <Star className="w-3.5 h-3.5" />
                        <span>Set as Default IPTV</span>
                      </button>
                    ) : (
                      <span className="text-[11px] font-semibold text-amber-400 flex items-center space-x-1">
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                        <span>Loads automatically on startup</span>
                      </span>
                    )}

                    {!isActive && (
                      <button
                        onClick={() => loadProfileCatalog(prof.id)}
                        className="px-3 py-1.5 rounded-lg bg-sky-500 text-slate-950 text-xs font-bold"
                      >
                        Activate Now
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Column: Add New Xtream Codes or M3U Playlist */}
      <div className="lg:col-span-7">
        <div className="bg-[#0F1626] border border-slate-800 rounded-2xl p-6 space-y-5">
          <div className="flex space-x-3 border-b border-slate-800 pb-4">
            <button
              onClick={() => setMode('xtream')}
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center space-x-2 border transition-all focus:ring-2 focus:ring-sky-400 ${
                mode === 'xtream'
                  ? 'bg-sky-500 text-slate-950 border-sky-400'
                  : 'bg-slate-900 text-slate-300 border-slate-800'
              }`}
            >
              <Server className="w-4 h-4" />
              <span>Add Xtream Codes API</span>
            </button>

            <button
              onClick={() => setMode('m3u')}
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm flex items-center justify-center space-x-2 border transition-all focus:ring-2 focus:ring-sky-400 ${
                mode === 'm3u'
                  ? 'bg-sky-500 text-slate-950 border-sky-400'
                  : 'bg-slate-900 text-slate-300 border-slate-800'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Add M3U / M3U8 Playlist</span>
            </button>
          </div>

          {playlistError && (
            <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/40 text-red-300 text-xs">
              {playlistError}
            </div>
          )}

          {statusBanner && (
            <div className="p-3.5 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4" />
              <span>{statusBanner}</span>
            </div>
          )}

          {mode === 'xtream' ? (
            <form onSubmit={handleAddXtream} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Profile Name
                </label>
                <input
                  type="text"
                  value={xtreamName}
                  onChange={(e) => setXtreamName(e.target.value)}
                  placeholder="e.g. My Default Xtream IPTV"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  Server / Portal URL (http:// or https://)
                </label>
                <input
                  type="text"
                  required
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="http://star.jixtv.xyz"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Xtream username"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Xtream password"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                    Preferred Live TV Stream Format
                  </label>
                  <div className="flex space-x-2">
                    {(['ts', 'm3u8'] as const).map((fmt) => (
                      <button
                        type="button"
                        key={fmt}
                        onClick={() => setLiveFormat(fmt)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase border ${
                          liveFormat === fmt
                            ? 'bg-indigo-500 text-white border-indigo-400'
                            : 'bg-slate-900 text-slate-400 border-slate-700'
                        }`}
                      >
                        {fmt === 'ts'
                          ? 'MPEG-TS (.ts) — Recommended'
                          : 'HLS (.m3u8)'}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center space-x-2.5 cursor-pointer bg-slate-900 px-4 py-2.5 rounded-xl border border-slate-800">
                  <input
                    type="checkbox"
                    checked={makeDefaultXtream}
                    onChange={(e) => setMakeDefaultXtream(e.target.checked)}
                    className="w-4 h-4 accent-amber-400 rounded"
                  />
                  <span className="text-xs font-bold text-amber-300">
                    ★ Set as Default IPTV on Startup
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={isLoadingPlaylist}
                className="w-full py-3.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-sm flex items-center justify-center space-x-2 focus:ring-4 focus:ring-white"
              >
                <Plus className="w-5 h-5" />
                <span>
                  {isLoadingPlaylist
                    ? 'Connecting & Syncing Live TV, Movies & Series...'
                    : 'Connect Xtream Codes Server'}
                </span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleAddM3U} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                    Playlist Name
                  </label>
                  <input
                    type="text"
                    value={m3uName}
                    onChange={(e) => setM3uName(e.target.value)}
                    placeholder="e.g. Global M3U Channels"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                    Optional XMLTV EPG URL
                  </label>
                  <input
                    type="url"
                    value={epgUrl}
                    onChange={(e) => setEpgUrl(e.target.value)}
                    placeholder="http://example.com/epg.xml"
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1">
                  M3U / M3U8 Playlist URL
                </label>
                <input
                  type="url"
                  value={m3uUrl}
                  onChange={(e) => setM3uUrl(e.target.value)}
                  placeholder="https://iptv-org.github.io/iptv/index.m3u"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase text-slate-400">
                    Or Upload Local .M3U File / Paste Raw #EXTM3U
                  </label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".m3u,.m3u8,.txt"
                    onChange={handleM3UFileUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-bold flex items-center space-x-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload .M3U / .M3U8 File</span>
                  </button>
                </div>

                <textarea
                  rows={4}
                  value={m3uRawText}
                  onChange={(e) => setM3uRawText(e.target.value)}
                  placeholder={'#EXTM3U\n#EXTINF:-1 tvg-logo="" group-title="Movies",Sample Movie (2024)\nhttps://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-white text-xs font-mono"
                />
              </div>

              <label className="flex items-center space-x-2.5 cursor-pointer bg-slate-900 px-4 py-2.5 rounded-xl border border-slate-800 w-fit">
                <input
                  type="checkbox"
                  checked={makeDefaultM3u}
                  onChange={(e) => setMakeDefaultM3u(e.target.checked)}
                  className="w-4 h-4 accent-amber-400 rounded"
                />
                <span className="text-xs font-bold text-amber-300">
                  ★ Set as Default IPTV on Startup
                </span>
              </label>

              <button
                type="submit"
                disabled={isLoadingPlaylist}
                className="w-full py-3.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-extrabold text-sm flex items-center justify-center space-x-2 focus:ring-4 focus:ring-white"
              >
                <Plus className="w-5 h-5" />
                <span>
                  {isLoadingPlaylist
                    ? 'Parsing M3U Playlist...'
                    : 'Load M3U Playlist'}
                </span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
