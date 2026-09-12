import React, { useState, useRef } from 'react';
import {
  Sparkles,
  Upload,
  FileText,
  RefreshCw,
  Layers,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  RotateCcw,
  BookOpen,
  SplitSquareVertical,
  Maximize2,
  ListOrdered,
} from 'lucide-react';

export type SplitMode =
  | 'parts_auto'
  | 'parts_short'
  | 'parts_medium'
  | 'parts_2'
  | 'parts_3'
  | 'parts_4'
  | 'scene_break'
  | 'single'
  | 'ai';

interface TextInputViewProps {
  inputText: string;
  setInputText: (text: string) => void;
  bookTitle: string;
  setBookTitle: (title: string) => void;
  chapterNumber: number;
  setChapterNumber: (num: number) => void;
  chapterTitle: string;
  setChapterTitle: (title: string) => void;
  splitMode: SplitMode;
  setSplitMode: (mode: SplitMode) => void;
  onProcessChapter: (append: boolean) => void;
  isProcessing: boolean;
  wordCount: number;
  hasExistingChapters: boolean;
  existingChaptersCount: number;
  onResetAll: () => void;
}

export const TextInputView: React.FC<TextInputViewProps> = ({
  inputText,
  setInputText,
  bookTitle,
  setBookTitle,
  chapterNumber,
  setChapterNumber,
  chapterTitle,
  setChapterTitle,
  splitMode,
  setSplitMode,
  onProcessChapter,
  isProcessing,
  wordCount,
  hasExistingChapters,
  existingChaptersCount,
  onResetAll,
}) => {
  const [dragOver, setDragOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxWords = 15000;
  const wordPercentage = Math.min(100, Math.round((wordCount / maxWords) * 100));
  const estimatedReadMinutes = Math.max(1, Math.round(wordCount / 180));

  // Estimate preview of parts if user uses split mode
  const getEstimatedPartCount = () => {
    if (splitMode === 'single') return 1;
    if (splitMode === 'parts_2') return 2;
    if (splitMode === 'parts_3') return 3;
    if (splitMode === 'parts_4') return 4;
    if (splitMode === 'parts_short') return Math.max(1, Math.round(wordCount / 250));
    if (splitMode === 'parts_medium') return Math.max(1, Math.round(wordCount / 500));
    if (splitMode === 'parts_auto') return Math.max(1, Math.round(wordCount / 350));
    if (splitMode === 'scene_break') {
      const matches = inputText.match(/\n\s*(?:\*\*\*|###|---|—{3,})\s*\n/g);
      return (matches?.length || 0) + 1;
    }
    return Math.max(1, Math.ceil(wordCount / 600));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    readFile(file);
  };

  const readFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        setInputText(content);
        const cleanName = file.name.replace(/\.[^/.]+$/, '');
        if (!chapterTitle) {
          setChapterTitle(cleanName);
        }
        if (!bookTitle) {
          setBookTitle(cleanName);
        }
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      readFile(file);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / System Description */}
      <div className="bg-white border border-neutral-200/90 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-900 mb-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-700" />
              Sistem Polosan & Penambahan Bab Fleksibel
            </div>
            <h2 className="text-xl sm:text-2xl font-bold font-serif-book text-neutral-900 tracking-tight">
              {hasExistingChapters
                ? `Tambah Bab Baru (Bab ${chapterNumber}) ke Buku`
                : 'Mulai Menulis atau Tempel Chapter Pertama'}
            </h2>
            <p className="text-sm text-neutral-600 mt-1 max-w-3xl leading-relaxed">
              Setiap kali Anda copy-paste atau unggah teks, Anda dapat menjadikannya <strong>satu bab utuh</strong>{' '}
              atau membaginya menjadi <strong>Bab {chapterNumber} Part 1, Part 2, dst.</strong> Bab akan otomatis terangkai
              ke dalam daftar isi buku Anda.
            </p>
          </div>

          <div className="shrink-0 flex flex-wrap items-center gap-2">
            <button
              id="upload-file-trigger"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl border border-neutral-300 bg-white text-neutral-800 hover:bg-neutral-50 shadow-xs transition-colors"
            >
              <Upload className="w-4 h-4 text-neutral-500" />
              <span>Unggah File (.txt / .md)</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".txt,.md,.text"
              className="hidden"
            />

            {hasExistingChapters && (
              <button
                id="reset-polosan-btn"
                onClick={onResetAll}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-xl text-neutral-500 hover:text-red-600 hover:bg-red-50 border border-neutral-200 transition-colors"
                title="Hapus buku dan mulai dari awal polosan"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Polosan</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Text Editor Section */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-xs overflow-hidden">
        {/* Chapter & Book Metadata Fields */}
        <div className="p-4 sm:p-5 border-b border-neutral-200 bg-neutral-50/60 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Judul Buku */}
            <div className="sm:col-span-6">
              <label className="text-xs font-semibold text-neutral-700 block mb-1">
                Judul Utama Buku:
              </label>
              <input
                id="book-title-input"
                type="text"
                value={bookTitle}
                onChange={(e) => setBookTitle(e.target.value)}
                placeholder="Contoh: Petualangan Menembus Batas..."
                className="w-full text-sm font-medium px-3 py-2 rounded-xl border border-neutral-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-hidden bg-white text-neutral-900"
              />
            </div>

            {/* Nomor Bab */}
            <div className="sm:col-span-2">
              <label className="text-xs font-semibold text-neutral-700 block mb-1">
                Nomor Bab:
              </label>
              <div className="flex items-center">
                <span className="text-xs font-bold text-neutral-400 pl-3 pr-1 bg-white border border-r-0 border-neutral-300 rounded-l-xl py-2">
                  Bab
                </span>
                <input
                  id="chapter-number-input"
                  type="number"
                  min={1}
                  max={999}
                  value={chapterNumber}
                  onChange={(e) => setChapterNumber(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full text-sm font-bold px-2 py-2 border border-neutral-300 rounded-r-xl focus:border-amber-500 outline-hidden bg-white text-neutral-900"
                />
              </div>
            </div>

            {/* Sub-judul Bab */}
            <div className="sm:col-span-4">
              <label className="text-xs font-semibold text-neutral-700 block mb-1">
                Judul Bab Ini (Opsional):
              </label>
              <input
                id="chapter-title-input"
                type="text"
                value={chapterTitle}
                onChange={(e) => setChapterTitle(e.target.value)}
                placeholder={`Contoh: Pertemuan di Hutan...`}
                className="w-full text-sm font-medium px-3 py-2 rounded-xl border border-neutral-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-hidden bg-white text-neutral-900"
              />
            </div>
          </div>

          {/* Mode Pembagian Bab (Chapter Segmentation Mode) */}
          <div className="pt-3 border-t border-neutral-200/70">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
              <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                <SplitSquareVertical className="w-3.5 h-3.5 text-amber-600" />
                Cara Membagi Teks Bab Ini:
              </label>
              <span className="text-[11px] text-neutral-500">
                Akan menghasilkan ~{getEstimatedPartCount()} bagian / bab di buku
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Option 1: Bab X Part 1, Part 2 (Auto Audio ~350 kata) */}
              <button
                type="button"
                id="split-mode-auto"
                onClick={() => setSplitMode('parts_auto')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  splitMode === 'parts_auto'
                    ? 'border-amber-600 bg-amber-50/70 ring-2 ring-amber-500/20 shadow-xs'
                    : 'border-neutral-200 bg-white hover:border-neutral-300 text-neutral-700'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <ListOrdered className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="text-xs font-bold text-neutral-900 truncate">
                    Bagi Part Audio (Rekomendasi)
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 mt-1 line-clamp-1">
                  Bab {chapterNumber} Part 1, Part 2 (~350 kata / ~2 mnt audio)
                </p>
              </button>

              {/* Option 2: Part Pendek Audio (~250 kata) */}
              <button
                type="button"
                id="split-mode-short"
                onClick={() => setSplitMode('parts_short')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  splitMode === 'parts_short'
                    ? 'border-amber-600 bg-amber-50/70 ring-2 ring-amber-500/20 shadow-xs'
                    : 'border-neutral-200 bg-white hover:border-neutral-300 text-neutral-700'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <SplitSquareVertical className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="text-xs font-bold text-neutral-900 truncate">
                    Part Ringkas Audio
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 mt-1 line-clamp-1">
                  ~250 kata (~1.5 mnt audio per part)
                </p>
              </button>

              {/* Option 3: Bagi 2 Part Seimbang */}
              <button
                type="button"
                id="split-mode-parts2"
                onClick={() => setSplitMode('parts_2')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  splitMode === 'parts_2'
                    ? 'border-amber-600 bg-amber-50/70 ring-2 ring-amber-500/20 shadow-xs'
                    : 'border-neutral-200 bg-white hover:border-neutral-300 text-neutral-700'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <SplitSquareVertical className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="text-xs font-bold text-neutral-900 truncate">
                    Bagi 2 Part
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 mt-1 line-clamp-1">
                  Bab {chapterNumber} Part 1 & Part 2
                </p>
              </button>

              {/* Option 4: 1 Bab Utuh */}
              <button
                type="button"
                id="split-mode-single"
                onClick={() => setSplitMode('single')}
                className={`p-2.5 rounded-xl border text-left transition-all ${
                  splitMode === 'single'
                    ? 'border-amber-600 bg-amber-50/70 ring-2 ring-amber-500/20 shadow-xs'
                    : 'border-neutral-200 bg-white hover:border-neutral-300 text-neutral-700'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Maximize2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span className="text-xs font-bold text-neutral-900 truncate">
                    1 Bab Utuh
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 mt-1 line-clamp-1">
                  Seluruh naskah dalam 1 bab tunggal
                </p>
              </button>
            </div>

            {/* Smart Audio Advice Notice when text is long */}
            {wordCount > 380 && (
              <div className="mt-2.5 p-2.5 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong>Tips Narasi Suara Audiobook:</strong> Naskah Anda memiliki{' '}
                  <span className="font-bold">{wordCount} kata</span>. Pilihan{' '}
                  <strong className="underline cursor-pointer" onClick={() => setSplitMode('parts_auto')}>
                    "Bagi Part Audio (Rekomendasi)"
                  </strong>{' '}
                  akan memecah cerita Anda menjadi ~{Math.max(2, Math.round(wordCount / 350))} Part secara otomatis. Setiap Part dapat di-generate suaranya dengan durasi nyaman tanpa terpotong.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Word limit progress bar */}
        <div className="w-full bg-neutral-100 h-1">
          <div
            className={`h-1 transition-all duration-300 ${
              wordCount > maxWords
                ? 'bg-red-500'
                : wordCount > 10000
                ? 'bg-amber-500'
                : 'bg-emerald-500'
            }`}
            style={{ width: `${wordPercentage}%` }}
          />
        </div>

        {/* Drop zone & Textarea */}
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`relative p-4 sm:p-5 transition-colors ${
            dragOver ? 'bg-amber-50/70 border-2 border-dashed border-amber-400' : ''
          }`}
        >
          <textarea
            id="main-text-input"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={`Tempelkan (paste) naskah cerita untuk Bab ${chapterNumber} Anda di sini...

Format bebas: Teks akan otomatis diproses sesuai mode pembagian yang Anda pilih di atas.
Jika memilih "Bagi Part Otomatis", teks panjang ini akan dibagi menjadi Bab ${chapterNumber} Part 1, Bab ${chapterNumber} Part 2, dan seterusnya secara rapi mengikuti jeda paragraf alami.`}
            rows={16}
            className="w-full font-serif-book text-base text-neutral-900 leading-relaxed outline-hidden resize-y min-h-[360px] placeholder:text-neutral-400"
          />

          {dragOver && (
            <div className="absolute inset-0 bg-amber-50/90 flex flex-col items-center justify-center pointer-events-none rounded-xl">
              <Upload className="w-10 h-10 text-amber-600 animate-bounce mb-2" />
              <p className="text-sm font-semibold text-neutral-800">
                Lepaskan file naskah untuk memuat teks
              </p>
            </div>
          )}
        </div>

        {/* Bottom Status & Action Bar */}
        <div className="p-4 sm:p-5 bg-neutral-50/80 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 text-xs text-neutral-500">
            <div className="flex items-center gap-1.5 font-semibold text-neutral-800">
              <FileText className="w-4 h-4 text-neutral-400" />
              <span>{wordCount.toLocaleString('id-ID')} kata</span>
            </div>

            {wordCount > 0 && (
              <span className="hidden sm:inline-block text-neutral-400">•</span>
            )}

            {wordCount === 0 ? (
              <span>Tempelkan teks naskah cerita Anda di atas untuk memulai.</span>
            ) : wordCount > maxWords ? (
              <span className="flex items-center gap-1 text-red-600 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                Melebihi batas 15.000 kata. Harap kurangi teks.
              </span>
            ) : (
              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Siap diproses (~{estimatedReadMinutes} menit baca).
              </span>
            )}

            {inputText.trim() && (
              <button
                type="button"
                onClick={() => setInputText('')}
                className="text-neutral-400 hover:text-neutral-700 underline text-xs ml-2"
              >
                Kosongkan teks
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {hasExistingChapters && (
              <button
                type="button"
                id="save-new-book-btn"
                onClick={() => onProcessChapter(false)}
                disabled={wordCount === 0 || wordCount > maxWords || isProcessing}
                className="px-3.5 py-2.5 rounded-xl font-medium text-xs text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                title="Gantikan buku saat ini dengan buku baru"
              >
                Mulai Sebagai Buku Baru
              </button>
            )}

            <button
              type="button"
              id="process-chapter-btn"
              onClick={() => onProcessChapter(true)}
              disabled={wordCount === 0 || wordCount > maxWords || isProcessing}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm text-white bg-amber-600 hover:bg-amber-700 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Memproses Bab {chapterNumber}...</span>
                </>
              ) : hasExistingChapters ? (
                <>
                  <PlusCircle className="w-4 h-4" />
                  <span>Tambahkan Bab {chapterNumber} ke Buku</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Simpan & Proses Bab {chapterNumber}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
