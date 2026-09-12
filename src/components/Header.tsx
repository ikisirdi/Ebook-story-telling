import React from 'react';
import { BookOpen, FileText, Download, Code, Sparkles, Volume2, Settings2, Database } from 'lucide-react';

interface HeaderProps {
  activeTab: 'input' | 'reader';
  setActiveTab: (tab: 'input' | 'reader') => void;
  hasChapters: boolean;
  totalChapters: number;
  totalWords: number;
  onOpenExport: () => void;
  onOpenJson: () => void;
  onOpenSettings: () => void;
  onOpenSupabase: () => void;
  isSupabaseConnected?: boolean;
  isProcessing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  hasChapters,
  totalChapters,
  totalWords,
  onOpenExport,
  onOpenJson,
  onOpenSettings,
  onOpenSupabase,
  isSupabaseConnected = false,
  isProcessing,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-neutral-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo & Title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-neutral-900 tracking-tight truncate">
                AI E-Book & Narasi Audio
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3" /> Bahasa Indonesia
              </span>
            </div>
            <p className="text-xs text-neutral-500 hidden md:block">
              Konversi naskah panjang hingga 15.000 kata ke format e-book interaktif
            </p>
          </div>
        </div>

        {/* Center Tabs: Input vs Reader */}
        <div className="flex items-center bg-neutral-100 p-1 rounded-lg border border-neutral-200/70">
          <button
            id="tab-input-btn"
            onClick={() => setActiveTab('input')}
            className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all ${
              activeTab === 'input'
                ? 'bg-white text-neutral-900 shadow-xs'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Naskah & Bab</span>
            {hasChapters && (
              <span className="text-[10px] bg-neutral-200 text-neutral-700 px-1.5 py-0.2 rounded-full">
                {totalChapters}
              </span>
            )}
          </button>

          <button
            id="tab-reader-btn"
            onClick={() => setActiveTab('reader')}
            disabled={!hasChapters}
            className={`flex items-center gap-2 px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all ${
              activeTab === 'reader'
                ? 'bg-white text-neutral-900 shadow-xs'
                : hasChapters
                ? 'text-neutral-600 hover:text-neutral-900'
                : 'text-neutral-300 cursor-not-allowed'
            }`}
            title={!hasChapters ? 'Bagi teks menjadi bab terlebih dahulu' : 'Buka E-Reader'}
          >
            <BookOpen className="w-4 h-4" />
            <span>Baca E-Book</span>
          </button>
        </div>

        {/* Right Action buttons */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            id="open-supabase-btn"
            onClick={onOpenSupabase}
            className={`relative p-2 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-semibold ${
              isSupabaseConnected
                ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
            }`}
            title="Database Supabase & Setup Vercel"
          >
            <Database className="w-4 h-4 text-emerald-600" />
            <span className="hidden xl:inline text-neutral-700">Supabase</span>
            {isSupabaseConnected && (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 absolute top-1.5 right-1.5" />
            )}
          </button>

          <button
            id="open-settings-btn"
            onClick={onOpenSettings}
            className="p-2 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
            title="Pengaturan Suara Narasi"
          >
            <Settings2 className="w-4 h-4" />
          </button>

          <button
            id="open-json-btn"
            onClick={onOpenJson}
            disabled={!hasChapters}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-lg border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Lihat Output Struktur JSON {judul, bab, teks, audio_url}"
          >
            <Code className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Format JSON</span>
          </button>

          <button
            id="open-export-btn"
            onClick={onOpenExport}
            disabled={!hasChapters || isProcessing}
            className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 shadow-xs disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Ekspor HTML / EPUB</span>
          </button>
        </div>
      </div>
    </header>
  );
};
