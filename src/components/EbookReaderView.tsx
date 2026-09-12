import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Coffee,
  Type,
  List,
  Sparkles,
  Headphones,
  RefreshCw,
} from 'lucide-react';
import { ChapterData, EbookData } from '../types';

interface EbookReaderViewProps {
  ebook: EbookData;
  currentChapterIndex: number;
  setCurrentChapterIndex: (idx: number) => void;
  isPlaying: boolean;
  onTogglePlay: () => void;
  currentTime: number;
  duration: number;
  onSeek: (seconds: number) => void;
  playbackSpeed: number;
  setPlaybackSpeed: (speed: number) => void;
  onGenerateAudioForChapter: (chapterId: string) => Promise<void>;
  isGeneratingAudio: boolean;
  onAddNewChapter?: () => void;
}

type ThemeMode = 'light' | 'sepia' | 'dark';
type FontMode = 'serif' | 'sans';

export const EbookReaderView: React.FC<EbookReaderViewProps> = ({
  ebook,
  currentChapterIndex,
  setCurrentChapterIndex,
  isPlaying,
  onTogglePlay,
  currentTime,
  duration,
  onSeek,
  playbackSpeed,
  setPlaybackSpeed,
  onGenerateAudioForChapter,
  isGeneratingAudio,
  onAddNewChapter,
}) => {
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [fontMode, setFontMode] = useState<FontMode>('serif');
  const [fontSize, setFontSize] = useState<number>(18);
  const [showToc, setShowToc] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(1.0);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  if (!ebook.bab || ebook.bab.length === 0) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center bg-white rounded-2xl border border-neutral-200">
        <BookOpen className="w-12 h-12 text-neutral-300 mb-3" />
        <h3 className="text-lg font-bold text-neutral-900">Belum Ada Bab di Buku Ini</h3>
        <p className="text-sm text-neutral-500 max-w-md mt-1 mb-5">
          Sistem masih dalam keadaan polosan. Silakan tempelkan cerita Chapter 1 Anda untuk mulai membaca dan mendengarkan.
        </p>
        {onAddNewChapter && (
          <button
            onClick={onAddNewChapter}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm text-white bg-amber-600 hover:bg-amber-700 shadow-xs transition-colors"
          >
            Mulai Tulis / Tempel Bab Pertama
          </button>
        )}
      </div>
    );
  }

  const currentChapter = ebook.bab[currentChapterIndex] || ebook.bab[0];

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleNextChapter = () => {
    if (currentChapterIndex < ebook.bab.length - 1) {
      setCurrentChapterIndex(currentChapterIndex + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevChapter = () => {
    if (currentChapterIndex > 0) {
      setCurrentChapterIndex(currentChapterIndex - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Dynamic theme colors
  const themeClasses = {
    light: 'bg-[#fcfbf9] text-[#242220] border-neutral-200',
    sepia: 'bg-[#fbf0d9] text-[#3f311c] border-[#e4cc9e]',
    dark: 'bg-[#18181b] text-[#f4f4f5] border-neutral-800',
  };

  const contentBgClasses = {
    light: 'bg-white',
    sepia: 'bg-[#fff8eb]',
    dark: 'bg-[#27272a]',
  };

  const paragraphs = currentChapter?.teks
    ? currentChapter.teks.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
    : [];

  return (
    <div className={`min-h-[calc(100vh-4rem)] flex flex-col ${themeClasses[theme]} transition-colors duration-200`}>
      {/* Top Reader Toolbar */}
      <div className={`sticky top-16 z-20 px-4 py-2.5 border-b backdrop-blur-md flex items-center justify-between gap-3 ${theme === 'dark' ? 'bg-[#18181b]/90 border-neutral-800' : theme === 'sepia' ? 'bg-[#fbf0d9]/90 border-[#e4cc9e]' : 'bg-white/90 border-neutral-200'}`}>
        <div className="flex items-center gap-2">
          <button
            id="reader-toc-toggle-btn"
            onClick={() => setShowToc(!showToc)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${theme === 'dark' ? 'border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-neutral-200' : 'border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700'}`}
          >
            <List className="w-4 h-4" />
            <span>Daftar Isi Bab</span>
          </button>

          <span className="hidden sm:inline-block text-xs opacity-60 font-medium truncate max-w-[280px]">
            {ebook.judul} • Bab {currentChapterIndex + 1} dari {ebook.bab.length}
          </span>
        </div>

        {/* Reader Customization Controls */}
        <div className="flex items-center gap-2">
          {/* Font Family Toggle */}
          <div className="hidden sm:flex items-center rounded-lg border border-neutral-300/60 p-0.5 text-xs">
            <button
              onClick={() => setFontMode('serif')}
              className={`px-2 py-1 rounded font-serif-book ${fontMode === 'serif' ? 'bg-amber-600 text-white font-bold' : 'opacity-70 hover:opacity-100'}`}
            >
              Serif
            </button>
            <button
              onClick={() => setFontMode('sans')}
              className={`px-2 py-1 rounded font-sans-ui ${fontMode === 'sans' ? 'bg-amber-600 text-white font-bold' : 'opacity-70 hover:opacity-100'}`}
            >
              Sans
            </button>
          </div>

          {/* Font Size Adjust */}
          <div className="flex items-center gap-1 text-xs">
            <button
              onClick={() => setFontSize(Math.max(14, fontSize - 2))}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-neutral-300/60 hover:border-neutral-400 font-bold"
              title="Perkecil Teks"
            >
              A-
            </button>
            <button
              onClick={() => setFontSize(Math.min(28, fontSize + 2))}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-neutral-300/60 hover:border-neutral-400 font-bold"
              title="Perbesar Teks"
            >
              A+
            </button>
          </div>

          {/* Theme Switcher */}
          <div className="flex items-center rounded-lg border border-neutral-300/60 p-0.5">
            <button
              onClick={() => setTheme('light')}
              className={`p-1.5 rounded ${theme === 'light' ? 'bg-amber-100 text-amber-900' : 'opacity-60 hover:opacity-100'}`}
              title="Tema Terang"
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTheme('sepia')}
              className={`p-1.5 rounded ${theme === 'sepia' ? 'bg-[#e4cc9e] text-[#3f311c]' : 'opacity-60 hover:opacity-100'}`}
              title="Tema Sepia (Kertas Antik)"
            >
              <Coffee className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={`p-1.5 rounded ${theme === 'dark' ? 'bg-neutral-700 text-yellow-400' : 'opacity-60 hover:opacity-100'}`}
              title="Tema Gelap"
            >
              <Moon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex relative">
        {/* Table of Contents Drawer/Sidebar */}
        {showToc && (
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs lg:hidden"
            onClick={() => setShowToc(false)}
          />
        )}

        <aside
          className={`fixed lg:sticky top-28 lg:top-28 z-40 lg:z-10 h-[calc(100vh-7rem)] w-72 sm:w-80 shrink-0 border-r overflow-y-auto p-4 transition-transform duration-300 ${
            theme === 'dark'
              ? 'bg-[#18181b] border-neutral-800'
              : theme === 'sepia'
              ? 'bg-[#f5e9ce] border-[#e4cc9e]'
              : 'bg-[#f4f1ea] border-neutral-200'
          } ${showToc ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
        >
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-inherit">
            <h3 className="text-xs font-bold uppercase tracking-wider opacity-70">
              Daftar Isi Bab
            </h3>
            <button
              onClick={() => setShowToc(false)}
              className="lg:hidden text-xs opacity-60 hover:opacity-100 p-1"
            >
              ✕ Tutup
            </button>
          </div>

          <div className="space-y-1.5">
            {ebook.bab.map((b, idx) => (
              <button
                key={b.id}
                id={`toc-item-${b.id}`}
                onClick={() => {
                  setCurrentChapterIndex(idx);
                  setShowToc(false);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className={`w-full text-left p-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center justify-between gap-2 ${
                  currentChapterIndex === idx
                    ? 'bg-amber-600 text-white font-bold shadow-xs'
                    : 'opacity-80 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                <span className="truncate">{b.judul_bab}</span>
                {b.audio_url && (
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
                      currentChapterIndex === idx
                        ? 'bg-white/20 text-white'
                        : 'bg-amber-200/80 text-amber-900'
                    }`}
                  >
                    Audio
                  </span>
                )}
              </button>
            ))}

            {onAddNewChapter && (
              <button
                id="reader-toc-add-btn"
                onClick={() => {
                  setShowToc(false);
                  onAddNewChapter();
                }}
                className="w-full mt-3 py-2 px-3 rounded-xl border border-dashed border-amber-600/40 text-amber-700 hover:bg-amber-500/10 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              >
                <span>+ Tambah Bab {ebook.bab.length + 1}</span>
              </button>
            )}
          </div>
        </aside>

        {/* Reader Center Book Area */}
        <main className="flex-1 min-w-0 px-4 sm:px-8 py-8 sm:py-12 pb-36 max-w-3xl mx-auto w-full">
          {/* Chapter Heading Banner */}
          <div className="mb-8 pb-6 border-b border-inherit">
            <div className="text-xs font-semibold text-amber-600 uppercase tracking-widest mb-1.5">
              Bab {currentChapterIndex + 1}
            </div>
            <h2
              className={`text-2xl sm:text-4xl font-bold tracking-tight mb-3 ${
                fontMode === 'serif' ? 'font-serif-book' : 'font-sans-ui'
              }`}
            >
              {currentChapter?.judul_bab}
            </h2>

            {currentChapter?.ringkasan && (
              <p className="text-xs sm:text-sm italic opacity-75 mb-4 max-w-2xl">
                "{currentChapter.ringkasan}"
              </p>
            )}

            {/* Prominent Per-Chapter Audio Play Button as per prompt */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="text-xs opacity-60">
                {currentChapter?.jumlah_kata} kata • ~{Math.max(1, Math.round((currentChapter?.jumlah_kata || 0) / 180))} mnt baca
              </div>

              {currentChapter?.audio_url ? (
                <button
                  id="chapter-main-play-btn"
                  onClick={onTogglePlay}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-xs sm:text-sm font-semibold text-white bg-amber-600 hover:bg-amber-700 shadow-md transition-all transform hover:-translate-y-0.5"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-4 h-4 fill-current" />
                      <span>Jeda Narasi Suara Bab Ini</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Putar Narasi Suara Bab Ini</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  id="chapter-generate-audio-btn"
                  onClick={() => onGenerateAudioForChapter(currentChapter.id)}
                  disabled={isGeneratingAudio}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-neutral-200/80 hover:bg-neutral-300/80 text-neutral-800 disabled:opacity-50 transition-colors"
                >
                  {isGeneratingAudio ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sedang Membuat Audio Suara...</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="w-3.5 h-3.5 text-amber-700" />
                      <span>Buat Narasi Suara Bab Ini</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Book Text Paragraphs */}
          <article
            className={`space-y-6 leading-relaxed transition-all ${
              fontMode === 'serif' ? 'font-serif-book' : 'font-sans-ui'
            }`}
            style={{ fontSize: `${fontSize}px`, lineHeight: 1.8 }}
          >
            {paragraphs.map((para, pIdx) => (
              <p
                key={pIdx}
                className={`text-justify tracking-normal ${
                  pIdx === 0 ? 'first-letter:text-3xl first-letter:font-bold first-letter:text-amber-700 first-letter:mr-1' : 'indent-6'
                }`}
              >
                {para}
              </p>
            ))}
          </article>

          {/* Chapter Navigation Bottom Buttons */}
          <div className="flex items-center justify-between gap-4 mt-12 pt-6 border-t border-inherit">
            <button
              id="reader-prev-btn"
              onClick={handlePrevChapter}
              disabled={currentChapterIndex === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border border-inherit bg-inherit hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Bab Sebelumnya</span>
            </button>

            <span className="text-xs opacity-60 font-medium">
              Bab {currentChapterIndex + 1} dari {ebook.bab.length}
            </span>

            {currentChapterIndex === ebook.bab.length - 1 && onAddNewChapter ? (
              <button
                id="reader-add-next-btn"
                onClick={onAddNewChapter}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 text-white hover:bg-amber-700 transition-colors shadow-xs"
              >
                <span>+ Lanjut Bab {ebook.bab.length + 1}</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                id="reader-next-btn"
                onClick={handleNextChapter}
                disabled={currentChapterIndex === ebook.bab.length - 1}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold border border-inherit bg-inherit hover:bg-black/5 dark:hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <span>Bab Selanjutnya</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </main>
      </div>

      {/* Sticky Bottom Audio Player Bar */}
      <footer className="fixed bottom-0 left-0 right-0 z-40 bg-neutral-900 text-neutral-100 border-t border-neutral-800 px-4 sm:px-6 py-3 shadow-2xl">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Track Info */}
          <div className="flex items-center gap-3 w-full sm:w-auto min-w-0 sm:max-w-xs">
            <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Headphones className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="text-xs sm:text-sm font-bold text-white truncate">
                {currentChapter?.judul_bab || 'Pilih Bab'}
              </div>
              <div className="text-[11px] text-neutral-400 truncate">
                {ebook.judul} • Bab {currentChapterIndex + 1}
              </div>
            </div>
          </div>

          {/* Controls & Progress bar */}
          <div className="flex flex-col items-center gap-1.5 w-full sm:flex-1 max-w-2xl">
            <div className="flex items-center gap-4">
              <button
                onClick={handlePrevChapter}
                disabled={currentChapterIndex === 0}
                className="text-neutral-400 hover:text-white disabled:opacity-30 transition-colors p-1"
                title="Bab Sebelumnya"
              >
                <SkipBack className="w-4 h-4" />
              </button>

              <button
                id="footer-play-btn"
                onClick={onTogglePlay}
                className="w-10 h-10 rounded-full bg-white text-neutral-950 flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all"
                title={isPlaying ? 'Jeda' : 'Putar'}
              >
                {isPlaying ? (
                  <Pause className="w-5 h-5 fill-current" />
                ) : (
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                )}
              </button>

              <button
                onClick={handleNextChapter}
                disabled={currentChapterIndex === ebook.bab.length - 1}
                className="text-neutral-400 hover:text-white disabled:opacity-30 transition-colors p-1"
                title="Bab Selanjutnya"
              >
                <SkipForward className="w-4 h-4" />
              </button>
            </div>

            {/* Timeline Scrubber */}
            <div className="flex items-center gap-3 w-full text-[11px] font-mono text-neutral-400">
              <span>{formatTime(currentTime)}</span>
              <input
                id="audio-seek-slider"
                type="range"
                min={0}
                max={duration || 100}
                value={currentTime}
                onChange={(e) => onSeek(parseFloat(e.target.value))}
                className="flex-1 accent-amber-500 cursor-pointer h-1.5 bg-neutral-700 rounded-lg"
              />
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Speed & Narration tag */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            <button
              onClick={() => {
                const speeds = [0.8, 1.0, 1.25, 1.5, 2.0];
                const curIdx = speeds.indexOf(playbackSpeed);
                const nextSpeed = speeds[(curIdx + 1) % speeds.length];
                setPlaybackSpeed(nextSpeed);
              }}
              className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-colors"
              title="Ubah Kecepatan Suara"
            >
              {playbackSpeed}x
            </button>
            <span className="text-[11px] text-amber-400/90 font-medium bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded-md">
              Narasi Suara Alami ID
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
