import React, { useState } from 'react';
import {
  Volume2,
  Play,
  Pause,
  RefreshCw,
  Edit3,
  Check,
  BookOpen,
  Headphones,
  FileCheck2,
  Trash2,
  ChevronRight,
  Sparkles,
  AlertCircle,
  Plus,
  PlusCircle,
  RotateCcw
} from 'lucide-react';
import { ChapterData, EbookData, TTSConfig } from '../types';

interface ChapterManagerProps {
  ebook: EbookData;
  setEbook: React.Dispatch<React.SetStateAction<EbookData>>;
  onGenerateAudioForChapter: (chapterId: string) => Promise<void>;
  onGenerateAllAudio: () => Promise<void>;
  isBatchGenerating: boolean;
  batchProgress: { current: number; total: number };
  onOpenReaderAtChapter: (index: number) => void;
  activePlayingId: string | null;
  onTogglePlayPreview: (chapter: ChapterData) => void;
  ttsConfig: TTSConfig;
  onAddNewChapter?: () => void;
  onResetBook?: () => void;
}

export const ChapterManager: React.FC<ChapterManagerProps> = ({
  ebook,
  setEbook,
  onGenerateAudioForChapter,
  onGenerateAllAudio,
  isBatchGenerating,
  batchProgress,
  onOpenReaderAtChapter,
  activePlayingId,
  onTogglePlayPreview,
  ttsConfig,
  onAddNewChapter,
  onResetBook,
}) => {
  const [editingChapterId, setEditingChapterId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editText, setEditText] = useState('');

  const audioReadyCount = ebook.bab.filter((b) => b.audio_url && b.audio_status === 'ready').length;

  const handleStartEdit = (chapter: ChapterData) => {
    setEditingChapterId(chapter.id);
    setEditTitle(chapter.judul_bab);
    setEditText(chapter.teks);
  };

  const handleSaveEdit = (chapterId: string) => {
    setEbook((prev) => ({
      ...prev,
      bab: prev.bab.map((b) => {
        if (b.id === chapterId) {
          const newWords = editText.trim().split(/\s+/).filter(Boolean).length;
          return {
            ...b,
            judul_bab: editTitle.trim() || b.judul_bab,
            teks: editText.trim(),
            jumlah_kata: newWords,
            // Reset audio if text changed
            audio_status: b.teks !== editText.trim() ? 'idle' : b.audio_status,
            audio_url: b.teks !== editText.trim() ? undefined : b.audio_url,
          };
        }
        return b;
      }),
    }));
    setEditingChapterId(null);
  };

  const handleDeleteChapter = (chapterId: string) => {
    if (ebook.bab.length <= 1) {
      alert('Minimal harus ada 1 bab.');
      return;
    }
    if (confirm('Hapus bab ini dari buku?')) {
      setEbook((prev) => {
        const remaining = prev.bab.filter((b) => b.id !== chapterId);
        return {
          ...prev,
          bab: remaining.map((ch, idx) => ({ ...ch, nomor: idx + 1 })),
          total_kata: remaining.reduce((acc, curr) => acc + curr.jumlah_kata, 0),
        };
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Book Metadata Overview Card */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
              Buku Siap Diterbitkan
            </span>
            <h2 className="text-xl sm:text-2xl font-bold font-serif-book text-neutral-900 mt-1">
              {ebook.judul}
            </h2>
            <p className="text-sm text-neutral-500 mt-1">
              {ebook.deskripsi || `Buku terstruktur dengan total ${ebook.bab.length} bab.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              id="batch-generate-audio-btn"
              onClick={onGenerateAllAudio}
              disabled={isBatchGenerating || audioReadyCount === ebook.bab.length}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isBatchGenerating ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>
                    Memproses Bab {batchProgress.current} dari {batchProgress.total}...
                  </span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4" />
                  <span>
                    {audioReadyCount === ebook.bab.length
                      ? 'Semua Audio Siap'
                      : `Buat Audio Semua Bab (${ebook.bab.length - audioReadyCount})`}
                  </span>
                </>
              )}
            </button>

            <button
              id="jump-to-reader-btn"
              onClick={() => onOpenReaderAtChapter(0)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 shadow-xs transition-colors"
            >
              <BookOpen className="w-4 h-4 text-neutral-500" />
              <span>Baca di E-Reader</span>
            </button>

            {onAddNewChapter && (
              <button
                id="top-add-chapter-btn"
                onClick={onAddNewChapter}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-amber-600 hover:bg-amber-700 text-white shadow-xs transition-all"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Tambah Bab {ebook.bab.length + 1}</span>
              </button>
            )}

            {onResetBook && (
              <button
                id="chapter-manager-reset-btn"
                onClick={() => {
                  if (confirm('Bersihkan buku ini dan mulai dari awal polosan?')) {
                    onResetBook();
                  }
                }}
                className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-xl border border-neutral-200 transition-colors"
                title="Reset buku dan mulai polosan"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-neutral-100">
          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
            <span className="text-[11px] text-neutral-500 font-medium block">Total Bab</span>
            <span className="text-lg font-bold text-neutral-900">{ebook.bab.length} Bab</span>
          </div>
          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
            <span className="text-[11px] text-neutral-500 font-medium block">Total Kata</span>
            <span className="text-lg font-bold text-neutral-900">
              {ebook.total_kata.toLocaleString('id-ID')} Kata
            </span>
          </div>
          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
            <span className="text-[11px] text-neutral-500 font-medium block">Audio Siap</span>
            <span className="text-lg font-bold text-amber-700">
              {audioReadyCount} / {ebook.bab.length} Bab
            </span>
          </div>
          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-100">
            <span className="text-[11px] text-neutral-500 font-medium block">Suara Narasi</span>
            <span className="text-sm font-semibold text-neutral-800 truncate block mt-0.5">
              {ttsConfig.engine === 'gemini' ? `Gemini (${ttsConfig.voice})` : 'Web Speech ID'}
            </span>
          </div>
        </div>
      </div>

      {/* Chapters Listing */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-600">
            Daftar Bab & Narasi Audio ({ebook.bab.length})
          </h3>
          <span className="text-xs text-neutral-500">
            Klik tombol putar pada tiap bab untuk memverifikasi narasi suara
          </span>
        </div>

        {ebook.bab.map((chapter, index) => {
          const isEditing = editingChapterId === chapter.id;
          const isPlaying = activePlayingId === chapter.id;
          const isGeneratingThis = chapter.audio_status === 'generating';

          return (
            <div
              key={chapter.id}
              className="bg-white rounded-xl border border-neutral-200/90 shadow-xs hover:border-neutral-300 transition-all overflow-hidden"
            >
              {isEditing ? (
                // Edit Mode
                <div className="p-5 space-y-4 bg-amber-50/20">
                  <div>
                    <label className="text-xs font-semibold text-neutral-700 block mb-1">Judul Bab:</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full text-sm font-medium px-3 py-2 rounded-lg border border-neutral-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-neutral-700 block mb-1">Isi Teks Bab:</label>
                    <textarea
                      rows={8}
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full text-sm font-serif-book p-3 rounded-lg border border-neutral-300 bg-white"
                    />
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => setEditingChapterId(null)}
                      className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900"
                    >
                      Batal
                    </button>
                    <button
                      onClick={() => handleSaveEdit(chapter.id)}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Simpan Perubahan</span>
                    </button>
                  </div>
                </div>
              ) : (
                // View Mode
                <div className="p-4 sm:p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-neutral-100 text-neutral-700 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                        {chapter.nomor}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-base font-bold text-neutral-900 truncate">
                            {chapter.judul_bab}
                          </h4>
                          {chapter.audio_url && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                              <Headphones className="w-3 h-3" />
                              {chapter.audio_url.startsWith('speech:') ? 'Web Speech ID' : 'Gemini Audio'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">
                          {chapter.ringkasan || chapter.teks.slice(0, 160) + '...'}
                        </p>
                      </div>
                    </div>

                    {/* Actions on right */}
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      <span className="text-xs text-neutral-400 font-medium mr-1">
                        {chapter.jumlah_kata} kata
                      </span>

                      {/* Audio Button */}
                      {chapter.audio_url ? (
                        <button
                          id={`play-chapter-${chapter.id}`}
                          onClick={() => onTogglePlayPreview(chapter)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            isPlaying
                              ? 'bg-amber-600 text-white shadow-xs'
                              : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                          }`}
                        >
                          {isPlaying ? (
                            <>
                              <Pause className="w-3.5 h-3.5" />
                              <span>Jeda Audio</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 fill-current" />
                              <span>Putar Audio</span>
                            </>
                          )}
                        </button>
                      ) : (
                        <button
                          id={`generate-audio-${chapter.id}`}
                          onClick={() => onGenerateAudioForChapter(chapter.id)}
                          disabled={isGeneratingThis || isBatchGenerating}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-neutral-100 text-neutral-700 hover:bg-neutral-200 hover:text-neutral-900 border border-neutral-200 disabled:opacity-50 transition-colors"
                        >
                          {isGeneratingThis ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Membuat...</span>
                            </>
                          ) : (
                            <>
                              <Volume2 className="w-3.5 h-3.5 text-neutral-500" />
                              <span>Buat Audio</span>
                            </>
                          )}
                        </button>
                      )}

                      {/* Read in E-Reader */}
                      <button
                        onClick={() => onOpenReaderAtChapter(index)}
                        className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                        title="Buka bab ini di Reader"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => handleStartEdit(chapter)}
                        className="p-1.5 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
                        title="Edit teks bab"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteChapter(chapter.id)}
                        className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Hapus bab"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {chapter.audio_status === 'error' && chapter.audio_error && (
                    <div className="mt-2 text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{chapter.audio_error}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {onAddNewChapter && (
          <button
            type="button"
            id="bottom-add-chapter-btn"
            onClick={onAddNewChapter}
            className="w-full py-4 border-2 border-dashed border-neutral-300 hover:border-amber-500 rounded-2xl flex items-center justify-center gap-2 text-sm font-semibold text-neutral-600 hover:text-amber-700 hover:bg-amber-50/40 transition-all group"
          >
            <PlusCircle className="w-5 h-5 text-neutral-400 group-hover:text-amber-600 transition-colors" />
            <span>+ Unggah / Tambah Bab Berikutnya (Bab {ebook.bab.length + 1})</span>
          </button>
        )}
      </div>
    </div>
  );
};
