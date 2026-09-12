import React, { useState } from 'react';
import { X, Download, FileCode, BookCheck, FileJson, CheckCircle2, Headphones, Sparkles, Loader2 } from 'lucide-react';
import { EbookData } from '../types';
import { generateStandaloneHtmlEbook } from '../utils/htmlEbookGenerator';
import { generateEpubBlob } from '../utils/epubGenerator';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  ebook: EbookData;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  ebook,
}) => {
  const [isExportingHtml, setIsExportingHtml] = useState<boolean>(false);
  const [isExportingEpub, setIsExportingEpub] = useState<boolean>(false);
  const [isExportingJson, setIsExportingJson] = useState<boolean>(false);

  if (!isOpen) return null;

  const audioReadyCount = ebook.bab.filter((b) => b.audio_url).length;
  const filenameBase = ebook.judul.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const handleDownloadHtml = () => {
    setIsExportingHtml(true);
    try {
      const htmlContent = generateStandaloneHtmlEbook(ebook);
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filenameBase}-ebook.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Gagal menghasilkan file HTML.');
    } finally {
      setIsExportingHtml(false);
    }
  };

  const handleDownloadEpub = async () => {
    setIsExportingEpub(true);
    try {
      const epubBlob = await generateEpubBlob(ebook);
      const url = URL.createObjectURL(epubBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filenameBase}.epub`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert('Gagal menghasilkan file EPUB.');
    } finally {
      setIsExportingEpub(false);
    }
  };

  const handleDownloadJson = () => {
    setIsExportingJson(true);
    try {
      const exportJson = ebook.bab.map((b) => ({
        judul: ebook.judul,
        bab: b.judul_bab,
        teks: b.teks,
        audio_url: b.audio_url || '',
      }));
      const blob = new Blob([JSON.stringify(exportJson, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filenameBase}-output.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setIsExportingJson(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-xl w-full flex flex-col shadow-2xl border border-neutral-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-600/10 text-amber-700 flex items-center justify-center">
              <Download className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900">Simpan & Ekspor Buku Elektronik</h3>
              <p className="text-xs text-neutral-500">
                Pilih format keluaran buku elektronik dengan tombol pemutar audio per bab
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Status Note */}
          <div className="p-3.5 bg-amber-50/60 rounded-xl border border-amber-200/80 flex items-start gap-3 text-xs text-amber-900">
            <Headphones className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Status Narasi Audio: </span>
              {audioReadyCount} dari {ebook.bab.length} bab memiliki audio siap.
              {audioReadyCount < ebook.bab.length && (
                <span className="block text-amber-800/80 mt-0.5">
                  Catatan: Bab tanpa audio Gemini akan menggunakan pembacaan suara natural peramban (Web Speech ID).
                </span>
              )}
            </div>
          </div>

          {/* Export Option 1: Standalone HTML */}
          <div className="p-4 rounded-xl border border-neutral-200 hover:border-amber-400 bg-white transition-all flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 mt-0.5">
                <FileCode className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-neutral-900">Buku Elektronik Interaktif (HTML)</h4>
                  <span className="text-[10px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-full">
                    Rekomendasi
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-1">
                  Satu file .html mandiri lengkap dengan daftar isi, pemutar audio per bab, dan pilihan tema baca.
                </p>
              </div>
            </div>

            <button
              id="export-html-btn"
              onClick={handleDownloadHtml}
              disabled={isExportingHtml}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white shrink-0 shadow-xs transition-colors"
            >
              {isExportingHtml ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>Unduh .html</span>
            </button>
          </div>

          {/* Export Option 2: EPUB3 */}
          <div className="p-4 rounded-xl border border-neutral-200 hover:border-amber-400 bg-white transition-all flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                <BookCheck className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-bold text-neutral-900">Format Buku Standar (EPUB3)</h4>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full">
                    E-Reader
                  </span>
                </div>
                <p className="text-xs text-neutral-500 mt-1">
                  Format resmi untuk aplikasi Apple Books, Kindle, Google Play Books, dan pembaca e-book lainnya.
                </p>
              </div>
            </div>

            <button
              id="export-epub-btn"
              onClick={handleDownloadEpub}
              disabled={isExportingEpub}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white shrink-0 shadow-xs transition-colors"
            >
              {isExportingEpub ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>Unduh .epub</span>
            </button>
          </div>

          {/* Export Option 3: JSON */}
          <div className="p-4 rounded-xl border border-neutral-200 hover:border-amber-400 bg-white transition-all flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                <FileJson className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-neutral-900">Format Data JSON</h4>
                <p className="text-xs text-neutral-500 mt-1">
                  Struktur JSON lengkap berisikan <code className="text-neutral-700 font-mono text-[11px]">{`{judul, bab, teks, audio_url}`}</code>.
                </p>
              </div>
            </div>

            <button
              id="export-json-btn"
              onClick={handleDownloadJson}
              disabled={isExportingJson}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white shrink-0 shadow-xs transition-colors"
            >
              {isExportingJson ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
              <span>Unduh .json</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
