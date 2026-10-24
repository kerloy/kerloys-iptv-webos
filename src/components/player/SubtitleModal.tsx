import React, { useState, useEffect, useRef } from 'react';
import {
  Subtitles,
  Download,
  Search,
  Upload,
  Link2,
  Clock,
  Check,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import type {
  ExternalSubtitleTrack,
  PlayableMedia,
  SubtitleTrackOption,
} from '../../types/iptv';
import {
  cleanMediaTitleForSubtitleSearch,
  downloadExternalSubtitle,
  getLanguageLabel,
  searchExternalSubtitles,
} from '../../services/subtitles/subtitleService';
import { parseSubtitleCues } from '../../services/subtitles/vttParser';
import { useAppStore } from '../../store/useAppStore';
import { smartFetchText } from '../../utils/network';

interface SubtitleModalProps {
  media: PlayableMedia;
  subtitleTracks: SubtitleTrackOption[];
  activeSubtitleId: string;
  subtitleOffsetMs: number;
  onSelectTrack: (trackId: string) => void;
  onAddExternalSubtitle: (track: SubtitleTrackOption) => void;
  onChangeOffsetMs: (newOffsetMs: number) => void;
  onClose: () => void;
}

const AVAILABLE_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'Arabic' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'hi', label: 'Hindi' },
  { code: 'tr', label: 'Turkish' },
  { code: 'ru', label: 'Russian' },
];

export const SubtitleModal: React.FC<SubtitleModalProps> = ({
  media,
  subtitleTracks,
  activeSubtitleId,
  subtitleOffsetMs,
  onSelectTrack,
  onAddExternalSubtitle,
  onChangeOffsetMs,
  onClose,
}) => {
  const { settings, updateSettings } = useAppStore();
  const [activeSection, setActiveSection] = useState<'tracks' | 'download' | 'custom' | 'sync'>(
    subtitleTracks.length > 0 ? 'tracks' : 'download'
  );

  // Search & Download state
  const [searchQuery, setSearchQuery] = useState(
    cleanMediaTitleForSubtitleSearch(media.title) || media.title
  );
  const [selectedLang, setSelectedLang] = useState(
    settings.preferredSubtitleLanguages[0] || 'en'
  );
  const [isSearching, setIsSearching] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<ExternalSubtitleTrack[]>([]);
  const [usedFallback, setUsedFallback] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Custom URL / Local file state
  const [customUrl, setCustomUrl] = useState('');
  const [customLabel, setCustomLabel] = useState('Custom Subtitle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSearchSubtitles = async (langOverride?: string) => {
    const targetLang = langOverride || selectedLang;
    setIsSearching(true);
    setStatusMessage(null);
    try {
      const res = await searchExternalSubtitles({
        query: searchQuery || media.title,
        imdbId: media.imdbId,
        tmdbId: media.tmdbId,
        year: media.year,
        seasonNumber: media.seasonNumber,
        episodeNumber: media.episodeNumber,
        languages: [targetLang],
        openSubtitlesApiKey: settings.openSubtitlesApiKey,
        subdlApiKey: settings.subdlApiKey,
      });
      setSearchResults(res.tracks);
      setUsedFallback(res.usedDemoFallback);
    } catch (err: unknown) {
      setStatusMessage(
        err instanceof Error ? err.message : 'Subtitle search failed'
      );
    } finally {
      setIsSearching(false);
    }
  };

  useEffect(() => {
    if (activeSection === 'download' && searchResults.length === 0) {
      handleSearchSubtitles();
    }
  }, [activeSection]);

  const handleDownloadAndActivate = async (item: ExternalSubtitleTrack) => {
    setDownloadingId(item.id);
    setStatusMessage(`Downloading & extracting ${item.releaseName}...`);
    try {
      const rawContent = await downloadExternalSubtitle(
        item,
        settings.openSubtitlesApiKey
      );
      const parsed = parseSubtitleCues(rawContent);
      if (parsed.length === 0) {
        throw new Error('Subtitle file did not contain valid SRT/VTT timecodes. Try another release below.');
      }
      const newTrack: SubtitleTrackOption = {
        id: `dl-${item.id}`,
        label: `${item.languageName} — ${item.releaseName} (${parsed.length} lines)`,
        language: item.language,
        source: item.provider === 'subdl' ? 'subdl' : 'opensubtitles',
        rawContent,
        format: 'srt',
        active: true,
      };
      onAddExternalSubtitle(newTrack);
      setStatusMessage(
        `✓ Activated ${item.languageName} subtitle (${parsed.length} dialogue lines synced)`
      );
      window.setTimeout(() => {
        onClose();
      }, 450);
    } catch (err: unknown) {
      setStatusMessage(
        err instanceof Error ? err.message : 'Failed to download subtitle'
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const handleLoadFromUrl = async () => {
    if (!customUrl.trim()) return;
    setStatusMessage('Fetching subtitle from URL...');
    try {
      const rawContent = await smartFetchText(customUrl.trim());
      const newTrack: SubtitleTrackOption = {
        id: `url-${Date.now()}`,
        label: `${customLabel || 'External URL'} (${customUrl.split('/').pop()?.slice(0, 24)})`,
        language: 'en',
        source: 'external',
        rawContent,
        format: customUrl.toLowerCase().endsWith('.vtt') ? 'vtt' : 'srt',
        active: true,
      };
      onAddExternalSubtitle(newTrack);
      setCustomUrl('');
      setStatusMessage('External URL subtitle attached & enabled!');
      setActiveSection('tracks');
    } catch (err: unknown) {
      setStatusMessage(
        err instanceof Error ? err.message : 'Could not fetch subtitle URL'
      );
    }
  };

  const handleLocalFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const rawContent = String(reader.result || '');
      const newTrack: SubtitleTrackOption = {
        id: `file-${Date.now()}`,
        label: `USB/Local: ${file.name}`,
        language: 'en',
        source: 'external',
        rawContent,
        format: file.name.toLowerCase().endsWith('.vtt') ? 'vtt' : 'srt',
        active: true,
      };
      onAddExternalSubtitle(newTrack);
      setStatusMessage(`Loaded file: ${file.name}`);
      setActiveSection('tracks');
    };
    reader.readAsText(file);
  };

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
            <Subtitles className="w-6 h-6 text-sky-400" />
            <div>
              <h2 className="text-xl font-bold text-white">
                Subtitles, OpenSubtitles/SubDL Download & Sync
              </h2>
              <p className="text-xs text-slate-400">
                Switch embedded tracks, download .SRT/.VTT on the fly, or adjust timing sync
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 focus:ring-2 focus:ring-sky-400 text-slate-200 flex items-center space-x-1"
          >
            <X className="w-4 h-4" />
            <span>Close (Back)</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-[#0B101E] px-6 pt-3 space-x-3">
          {[
            { id: 'tracks', label: `Active Tracks (${subtitleTracks.length})`, icon: Subtitles },
            { id: 'download', label: 'Download (OpenSubtitles & SubDL)', icon: Download },
            { id: 'custom', label: 'Load USB File / URL (.srt / .vtt)', icon: Upload },
            { id: 'sync', label: `Timing Sync & Style (${(subtitleOffsetMs / 1000).toFixed(1)}s)`, icon: Clock },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeSection === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSection(tab.id as typeof activeSection)}
                className={`flex items-center space-x-2 px-4 py-2.5 rounded-t-xl font-medium text-sm transition-all focus:outline-none focus:ring-2 focus:ring-sky-400 ${
                  active
                    ? 'bg-[#0F1626] text-sky-400 border-t-2 border-x border-sky-400/60'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {statusMessage && (
          <div className="mx-6 mt-4 px-4 py-2.5 rounded-lg bg-sky-500/15 border border-sky-500/40 text-sky-300 text-sm flex items-center justify-between">
            <span>{statusMessage}</span>
            <button
              onClick={() => setStatusMessage(null)}
              className="text-xs underline ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {activeSection === 'tracks' && (
            <div className="space-y-2.5">
              <button
                onClick={() => onSelectTrack('off')}
                className={`w-full flex items-center justify-between px-5 py-3.5 rounded-xl border text-left transition-all focus:outline-none focus:ring-2 focus:ring-sky-400 ${
                  activeSubtitleId === 'off'
                    ? 'bg-sky-500/20 border-sky-400 text-white'
                    : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:bg-slate-800/70'
                }`}
              >
                <div>
                  <div className="font-semibold">Subtitles Off</div>
                  <div className="text-xs text-slate-400">Disable subtitle overlay</div>
                </div>
                {activeSubtitleId === 'off' && <Check className="w-5 h-5 text-sky-400" />}
              </button>

              {subtitleTracks.map((track) => {
                const isSelected = activeSubtitleId === track.id;
                return (
                  <button
                    key={track.id}
                    onClick={() => onSelectTrack(track.id)}
                    className={`w-full flex items-center justify-between px-5 py-3.5 rounded-xl border text-left transition-all focus:outline-none focus:ring-2 focus:ring-sky-400 ${
                      isSelected
                        ? 'bg-sky-500/20 border-sky-400 text-white'
                        : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className="px-2.5 py-0.5 rounded text-xs font-semibold uppercase bg-slate-800 text-sky-300 border border-slate-700">
                        {track.source}
                      </span>
                      <div>
                        <div className="font-semibold">{track.label}</div>
                        <div className="text-xs text-slate-400">
                          Language: {getLanguageLabel(track.language)}
                        </div>
                      </div>
                    </div>
                    {isSelected && <Check className="w-5 h-5 text-sky-400" />}
                  </button>
                );
              })}

              <div className="pt-3 flex justify-end">
                <button
                  onClick={() => setActiveSection('download')}
                  className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-semibold text-sm flex items-center space-x-2 focus:ring-2 focus:ring-white"
                >
                  <Download className="w-4 h-4" />
                  <span>Search & Download More Subtitles</span>
                </button>
              </div>
            </div>
          )}

          {activeSection === 'download' && (
            <div className="space-y-4">
              {/* Search bar */}
              <div className="flex space-x-3">
                <div className="flex-1 relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Movie or Series title..."
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-sky-400"
                  />
                </div>
                <button
                  onClick={() => handleSearchSubtitles()}
                  disabled={isSearching}
                  className="px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold flex items-center space-x-2 focus:ring-2 focus:ring-white"
                >
                  {isSearching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  <span>Search</span>
                </button>
              </div>

              {/* Language pills */}
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => {
                      setSelectedLang(lang.code);
                      handleSearchSubtitles(lang.code);
                    }}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all focus:ring-2 focus:ring-sky-400 ${
                      selectedLang === lang.code
                        ? 'bg-sky-500 text-slate-950 border-sky-400'
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                    }`}
                  >
                    {lang.label} ({lang.code.toUpperCase()})
                  </button>
                ))}
              </div>

              {usedFallback && (
                <div className="px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Showing instant ready-to-use subtitles. Add your free OpenSubtitles.com or SubDL API key in{' '}
                    <strong>Settings → Subtitles</strong> to search millions of live community releases.
                  </span>
                </div>
              )}

              {/* Results list */}
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {searchResults.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between px-4 py-3 rounded-xl bg-slate-900/90 border border-slate-800 hover:border-slate-600"
                  >
                    <div className="space-y-0.5 pr-4">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {item.provider}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-sky-300">
                          {item.languageName}
                        </span>
                        {item.hearingImpaired && (
                          <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300">
                            SDH / HI
                          </span>
                        )}
                      </div>
                      <div className="text-sm font-semibold text-white truncate max-w-xl">
                        {item.releaseName}
                      </div>
                      <div className="text-xs text-slate-400 flex items-center space-x-3">
                        {item.downloadCount && <span>Downloads: {item.downloadCount.toLocaleString()}</span>}
                        {item.rating && <span>Rating: ★ {item.rating}</span>}
                        {item.fps && <span>{item.fps} FPS</span>}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDownloadAndActivate(item)}
                      disabled={downloadingId === item.id}
                      className="px-4 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs flex items-center space-x-1.5 shrink-0 focus:ring-2 focus:ring-white"
                    >
                      {downloadingId === item.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      <span>Download & Include</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'custom' && (
            <div className="space-y-6">
              {/* Load from USB / Local storage */}
              <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                <h3 className="font-bold text-white flex items-center space-x-2">
                  <Upload className="w-5 h-5 text-sky-400" />
                  <span>Load .SRT / .VTT File from USB Drive or Local Storage</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Select any .srt or .vtt subtitle file from a connected USB flash drive on your LG TV or computer.
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".srt,.vtt,.ass,.ssa,.txt"
                  onChange={handleLocalFileChange}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-sm focus:ring-2 focus:ring-white"
                >
                  Choose .SRT / .VTT File...
                </button>
              </div>

              {/* Load from direct URL */}
              <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                <h3 className="font-bold text-white flex items-center space-x-2">
                  <Link2 className="w-5 h-5 text-sky-400" />
                  <span>Include Subtitle from Direct URL (.srt or .vtt)</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <input
                    type="text"
                    value={customLabel}
                    onChange={(e) => setCustomLabel(e.target.value)}
                    placeholder="Track Label (e.g. Arabic SRT)"
                    className="px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white"
                  />
                  <input
                    type="url"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://example.com/subtitles/movie.srt"
                    className="md:col-span-2 px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white"
                  />
                </div>
                <button
                  onClick={handleLoadFromUrl}
                  className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white font-bold text-sm focus:ring-2 focus:ring-white"
                >
                  Fetch & Attach Subtitle URL
                </button>
              </div>
            </div>
          )}

          {activeSection === 'sync' && (
            <div className="space-y-6">
              {/* Timing Offset */}
              <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-white">Subtitle Timing Sync Offset</h3>
                    <p className="text-xs text-slate-400">
                      Shift subtitles earlier (-) or later (+) if audio and text are out of sync
                    </p>
                  </div>
                  <div className="text-2xl font-mono font-bold text-sky-400">
                    {subtitleOffsetMs >= 0 ? `+${(subtitleOffsetMs / 1000).toFixed(1)}s` : `${(subtitleOffsetMs / 1000).toFixed(1)}s`}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  {[
                    { label: '-1.0s', delta: -1000 },
                    { label: '-0.5s', delta: -500 },
                    { label: '-0.1s', delta: -100 },
                    { label: 'Reset (0.0s)', delta: 0, reset: true },
                    { label: '+0.1s', delta: 100 },
                    { label: '+0.5s', delta: 500 },
                    { label: '+1.0s', delta: 1000 },
                  ].map((btn) => (
                    <button
                      key={btn.label}
                      onClick={() =>
                        onChangeOffsetMs(btn.reset ? 0 : subtitleOffsetMs + btn.delta)
                      }
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm border border-slate-700 focus:ring-2 focus:ring-sky-400"
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Size & Color */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <h3 className="font-bold text-white text-sm">Subtitle Font Size</h3>
                  <div className="flex gap-2">
                    {(['small', 'medium', 'large', 'xlarge'] as const).map((sz) => (
                      <button
                        key={sz}
                        onClick={() => updateSettings({ subtitleFontSize: sz })}
                        className={`px-3.5 py-2 rounded-lg text-xs font-bold uppercase border ${
                          settings.subtitleFontSize === sz
                            ? 'bg-sky-500 text-slate-950 border-sky-400'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        {sz}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <h3 className="font-bold text-white text-sm">Subtitle Text Color</h3>
                  <div className="flex gap-3">
                    {(
                      [
                        { color: '#FFFFFF', name: 'White' },
                        { color: '#FACC15', name: 'Cinema Yellow' },
                        { color: '#38BDF8', name: 'Cyan' },
                        { color: '#4ADE80', name: 'Green' },
                      ] as const
                    ).map((c) => (
                      <button
                        key={c.color}
                        onClick={() => updateSettings({ subtitleColor: c.color })}
                        className={`px-3.5 py-2 rounded-lg text-xs font-bold border flex items-center space-x-2 ${
                          settings.subtitleColor === c.color
                            ? 'border-sky-400 bg-slate-800 text-white'
                            : 'border-slate-700 bg-slate-900 text-slate-400'
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-white/30"
                          style={{ backgroundColor: c.color }}
                        />
                        <span>{c.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
