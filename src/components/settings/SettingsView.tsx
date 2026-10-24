import React, { useState, useMemo } from 'react';
import {
  Subtitles,
  Cpu,
  Lock,
  Unlock,
  Tv,
  Film,
  Clapperboard,
  Check,
  Play,
  Eye,
  EyeOff,
  Search,
} from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import type { Category } from '../../types/iptv';

export const SettingsView: React.FC = () => {
  const {
    settings,
    categories,
    liveChannels,
    movies,
    series,
    updateSettings,
    toggleCustomAdultCategory,
    requestAdultAccess,
    setActiveMedia,
    setSelectedMovie,
    setSelectedSeries,
  } = useAppStore();

  const [savedNotice, setSavedNotice] = useState(false);
  const [selectedAdultCat, setSelectedAdultCat] = useState<Category | null>(null);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [showCategoryManager, setShowCategoryManager] = useState(false);

  const triggerSaved = () => {
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2500);
  };

  const customAdultSet = useMemo(
    () => new Set(settings.customAdultCategoryIds || []),
    [settings.customAdultCategoryIds]
  );

  const isCategoryAdult = (cat: Category) =>
    Boolean(cat.isAdult) || customAdultSet.has(`${cat.type}:${cat.id}`);

  const adultCategories = useMemo(
    () => categories.filter((c) => isCategoryAdult(c)),
    [categories, customAdultSet]
  );

  const adultItemsForSelectedCat = useMemo(() => {
    if (!selectedAdultCat) return { live: [], movies: [], series: [] };
    if (selectedAdultCat.type === 'live') {
      return {
        live: liveChannels.filter((c) => c.categoryId === selectedAdultCat.id),
        movies: [],
        series: [],
      };
    }
    if (selectedAdultCat.type === 'movie') {
      return {
        live: [],
        movies: movies.filter((m) => m.categoryId === selectedAdultCat.id),
        series: [],
      };
    }
    return {
      live: [],
      movies: [],
      series: series.filter((s) => s.categoryId === selectedAdultCat.id),
    };
  }, [selectedAdultCat, liveChannels, movies, series]);

  const filteredAllCategories = useMemo(() => {
    const q = categorySearchQuery.trim().toLowerCase();
    if (!q) return categories.slice(0, 60);
    return categories
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 60);
  }, [categories, categorySearchQuery]);

  return (
    <div className="h-full overflow-y-auto pr-2 space-y-6">
      {savedNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-500/20 border border-emerald-400/50 text-emerald-300 text-xs font-bold flex items-center space-x-2">
          <Check className="w-4 h-4" />
          <span>Settings saved to LG webOS persistent storage.</span>
        </div>
      )}

      {/* PARENTAL CONTROLS & "FOR ADULTS" (18+) VAULT SECTION */}
      <div className="bg-[#0F1626] border border-rose-500/30 rounded-2xl p-6 space-y-5 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400">
              {settings.unlockedSession ? (
                <Unlock className="w-6 h-6 text-emerald-400" />
              ) : (
                <Lock className="w-6 h-6" />
              )}
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white">
                Parental Controls & "For Adults" (18+) Categories
              </h2>
              <p className="text-xs text-slate-400">
                All Adult / 18+ categories are kept safely inside this section behind your 4-digit PIN
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {!settings.unlockedSession ? (
              <button
                onClick={() =>
                  requestAdultAccess(() => {
                    if (adultCategories.length > 0 && !selectedAdultCat) {
                      setSelectedAdultCat(adultCategories[0]);
                    }
                  })
                }
                className="px-5 py-2.5 rounded-xl bg-rose-500 hover:bg-rose-400 text-white font-extrabold text-xs flex items-center space-x-2 focus:ring-2 focus:ring-white"
              >
                <Lock className="w-4 h-4" />
                <span>Unlock Parental Settings & "For Adults" Vault (PIN)</span>
              </button>
            ) : (
              <button
                onClick={() => {
                  updateSettings({ unlockedSession: false });
                  setSelectedAdultCat(null);
                }}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-amber-300 font-bold text-xs flex items-center space-x-2"
              >
                <Lock className="w-4 h-4" />
                <span>Lock Parental Vault Now</span>
              </button>
            )}
          </div>
        </div>

        {/* Unlocked Parental Controls & Adult Categories Browser */}
        {settings.unlockedSession ? (
          <div className="space-y-6">
            {/* PIN & Visibility Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                <label className="block text-xs font-bold uppercase text-slate-400">
                  Change 4-Digit Parental PIN
                </label>
                <input
                  type="password"
                  maxLength={4}
                  value={settings.parentalPin}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 4);
                    updateSettings({ parentalPin: digits || '1508' });
                    triggerSaved();
                  }}
                  className="w-full px-4 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-center font-mono text-base tracking-widest"
                />
              </div>

              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="text-xs font-bold uppercase text-slate-400">
                  Where Should "For Adults" Categories Appear?
                </div>
                <button
                  onClick={() => {
                    updateSettings({
                      showAdultInMainMenus: !settings.showAdultInMainMenus,
                    });
                    triggerSaved();
                  }}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 border ${
                    !settings.showAdultInMainMenus
                      ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                      : 'bg-amber-500/20 border-amber-400 text-amber-300'
                  }`}
                >
                  {!settings.showAdultInMainMenus ? (
                    <>
                      <EyeOff className="w-4 h-4" />
                      <span>Only Inside Parental Settings (Hidden from Menus)</span>
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4" />
                      <span>Shown in Main Menus (PIN Protected)</span>
                    </>
                  )}
                </button>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="text-xs font-bold uppercase text-slate-400">
                  Assign / Hide Custom Categories
                </div>
                <button
                  onClick={() => setShowCategoryManager((v) => !v)}
                  className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-300 text-xs font-bold"
                >
                  {showCategoryManager
                    ? 'Close Category Manager'
                    : `Manage Restricted Categories (${adultCategories.length})`}
                </button>
              </div>
            </div>

            {/* Optional Custom Category Restriction Manager */}
            {showCategoryManager && (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase text-sky-400">
                    Check any category to move it under Parental Settings ("For Adults")
                  </span>
                  <div className="relative w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2" />
                    <input
                      type="text"
                      value={categorySearchQuery}
                      onChange={(e) => setCategorySearchQuery(e.target.value)}
                      placeholder="Search any category name..."
                      className="w-full pl-8 pr-3 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-48 overflow-y-auto pr-1">
                  {filteredAllCategories.map((cat) => {
                    const key = `${cat.type}:${cat.id}`;
                    const checked = isCategoryAdult(cat);
                    return (
                      <button
                        key={key}
                        onClick={() => toggleCustomAdultCategory(key)}
                        className={`p-2 rounded-lg border text-left text-xs font-semibold flex items-center justify-between truncate ${
                          checked
                            ? 'bg-rose-500/20 border-rose-400 text-rose-200'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        <span className="truncate pr-2">
                          [{cat.type.toUpperCase()}] {cat.name}
                        </span>
                        {checked && <Lock className="w-3.5 h-3.5 text-rose-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Direct "For Adults" Categories & Content Browser inside Parental Settings */}
            <div className="border-t border-slate-800 pt-4 space-y-3">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-rose-400 flex items-center space-x-2">
                <Lock className="w-4 h-4" />
                <span>
                  "For Adults" (18+) Categories Vault ({adultCategories.length} Categories)
                </span>
              </h3>

              {adultCategories.length === 0 ? (
                <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-400">
                  No "For Adults" / 18+ categories detected in this playlist yet. Click{' '}
                  <strong>Manage Restricted Categories</strong> above to assign any category to this vault.
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* Adult Categories List */}
                  <div className="lg:col-span-4 bg-slate-950 border border-slate-800 rounded-xl p-3 max-h-80 overflow-y-auto space-y-1.5">
                    {adultCategories.map((cat) => {
                      const isSel =
                        selectedAdultCat?.id === cat.id &&
                        selectedAdultCat?.type === cat.type;
                      return (
                        <button
                          key={`${cat.type}-${cat.id}`}
                          onClick={() => setSelectedAdultCat(cat)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold text-left ${
                            isSel
                              ? 'bg-rose-500 text-white'
                              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <span className="truncate pr-2">{cat.name}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] uppercase bg-black/30">
                            {cat.type}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Adult Category Streams / VOD Items */}
                  <div className="lg:col-span-8 bg-slate-950 border border-slate-800 rounded-xl p-3 max-h-80 overflow-y-auto">
                    {!selectedAdultCat ? (
                      <div className="h-full flex items-center justify-center text-xs text-slate-500 py-12">
                        Select a "For Adults" category on the left to view & play its streams.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {adultItemsForSelectedCat.live.map((ch) => (
                          <button
                            key={ch.id}
                            onClick={() =>
                              setActiveMedia({
                                id: ch.id,
                                type: 'live',
                                title: ch.name,
                                subtitle: ch.categoryName,
                                poster: ch.logo,
                                streamUrl: ch.streamUrl,
                                fallbackStreamUrl: ch.fallbackStreamUrl,
                                containerExtension: ch.containerExtension,
                              })
                            }
                            className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left"
                          >
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <Tv className="w-4 h-4 text-rose-400 shrink-0" />
                              <span className="text-xs font-bold text-white truncate">
                                {ch.name}
                              </span>
                            </div>
                            <Play className="w-4 h-4 text-rose-400 shrink-0 ml-2" />
                          </button>
                        ))}

                        {adultItemsForSelectedCat.movies.map((mv) => (
                          <button
                            key={mv.id}
                            onClick={() => setSelectedMovie(mv)}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left"
                          >
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <Film className="w-4 h-4 text-amber-400 shrink-0" />
                              <span className="text-xs font-bold text-white truncate">
                                {mv.name}
                              </span>
                            </div>
                            <Play className="w-4 h-4 text-amber-400 shrink-0 ml-2" />
                          </button>
                        ))}

                        {adultItemsForSelectedCat.series.map((sr) => (
                          <button
                            key={sr.id}
                            onClick={() => setSelectedSeries(sr)}
                            className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left"
                          >
                            <div className="flex items-center space-x-2.5 min-w-0">
                              <Clapperboard className="w-4 h-4 text-indigo-400 shrink-0" />
                              <span className="text-xs font-bold text-white truncate">
                                {sr.name}
                              </span>
                            </div>
                            <Play className="w-4 h-4 text-indigo-400 shrink-0 ml-2" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-xs text-slate-400">
            <span>
              🔒 <strong>{adultCategories.length} "For Adults" (18+) categories</strong> from your IPTV playlist are currently hidden from main menus and locked inside this Parental Vault.
            </span>
            <span className="text-rose-400 font-bold">PIN Required</span>
          </div>
        )}
      </div>

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
            Configure your API keys to search and download .SRT / .VTT subtitles directly inside the TV player.
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
                {(['ts', 'm3u8'] as const).map((fmt) => (
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
                    {fmt === 'ts' ? 'MPEG-TS (.ts)' : 'HLS (.m3u8)'}
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
