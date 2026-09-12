import React, { useState } from 'react';
import { X, Copy, Check, Download, Code, FileJson } from 'lucide-react';
import { EbookData, StandardEbookOutput } from '../types';

interface JsonOutputModalProps {
  isOpen: boolean;
  onClose: () => void;
  ebook: EbookData;
}

export const JsonOutputModal: React.FC<JsonOutputModalProps> = ({
  isOpen,
  onClose,
  ebook,
}) => {
  const [copied, setCopied] = useState<boolean>(false);
  const [selectedFormat, setSelectedFormat] = useState<'single' | 'array' | 'full'>('single');
  const [selectedChapterIndex, setSelectedChapterIndex] = useState<number>(0);

  if (!isOpen) return null;

  const currentChapter = ebook.bab[selectedChapterIndex] || ebook.bab[0];

  // Specific format: {judul, bab, teks, audio_url}
  const singleChapterJson: StandardEbookOutput = {
    judul: ebook.judul,
    bab: currentChapter?.judul_bab || 'Bab 1',
    teks: currentChapter?.teks || '',
    audio_url: currentChapter?.audio_url || 'https://contoh-url-audio.com/narasi-bab.wav',
  };

  const allChaptersJson: StandardEbookOutput[] = ebook.bab.map((b) => ({
    judul: ebook.judul,
    bab: b.judul_bab,
    teks: b.teks,
    audio_url: b.audio_url || '',
  }));

  const fullEbookJson = {
    judul: ebook.judul,
    penulis: ebook.penulis,
    deskripsi: ebook.deskripsi,
    bahasa: ebook.bahasa,
    dibuat_pada: ebook.dibuat_pada,
    total_kata: ebook.total_kata,
    total_bab: ebook.bab.length,
    daftar_bab: ebook.bab.map((b) => ({
      nomor: b.nomor,
      judul_bab: b.judul_bab,
      ringkasan: b.ringkasan,
      jumlah_kata: b.jumlah_kata,
      teks: b.teks,
      audio_url: b.audio_url || '',
      durasi_detik: b.durasi_detik,
    })),
  };

  const getActiveJsonString = () => {
    switch (selectedFormat) {
      case 'single':
        return JSON.stringify(singleChapterJson, null, 2);
      case 'array':
        return JSON.stringify(allChaptersJson, null, 2);
      case 'full':
        return JSON.stringify(fullEbookJson, null, 2);
    }
  };

  const activeJson = getActiveJsonString();

  const handleCopy = () => {
    navigator.clipboard.writeText(activeJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([activeJson], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ebook.judul.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-output.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-neutral-200 overflow-hidden">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-600/10 text-amber-700 flex items-center justify-center">
              <Code className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900">Output Struktur JSON</h3>
              <p className="text-xs text-neutral-500">
                Sesuai instruksi: <code className="bg-neutral-200 text-neutral-800 px-1 py-0.5 rounded text-[11px]">{`{judul, bab, teks, audio_url}`}</code>
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

        {/* Controls / Tabs */}
        <div className="px-6 py-3 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-3 bg-white">
          <div className="flex items-center gap-1.5 bg-neutral-100 p-1 rounded-lg text-xs">
            <button
              onClick={() => setSelectedFormat('single')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                selectedFormat === 'single'
                  ? 'bg-white text-neutral-900 shadow-xs font-semibold'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Per Bab Tunggal
            </button>
            <button
              onClick={() => setSelectedFormat('array')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                selectedFormat === 'array'
                  ? 'bg-white text-neutral-900 shadow-xs font-semibold'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Array Semua Bab [{ebook.bab.length}]
            </button>
            <button
              onClick={() => setSelectedFormat('full')}
              className={`px-3 py-1 rounded-md font-medium transition-all ${
                selectedFormat === 'full'
                  ? 'bg-white text-neutral-900 shadow-xs font-semibold'
                  : 'text-neutral-600 hover:text-neutral-900'
              }`}
            >
              Lengkap E-Book
            </button>
          </div>

          {selectedFormat === 'single' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500 font-medium">Pilih Bab:</span>
              <select
                value={selectedChapterIndex}
                onChange={(e) => setSelectedChapterIndex(parseInt(e.target.value))}
                className="text-xs font-medium px-2.5 py-1 rounded-lg border border-neutral-300 bg-white"
              >
                {ebook.bab.map((b, idx) => (
                  <option key={b.id} value={idx}>
                    Bab {idx + 1}: {b.judul_bab}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Code View Area */}
        <div className="flex-1 overflow-auto p-4 bg-neutral-900 text-neutral-100 font-mono-code text-xs leading-relaxed">
          <pre className="whitespace-pre-wrap">{activeJson}</pre>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between">
          <div className="text-xs text-neutral-500">
            Karakter: {activeJson.length.toLocaleString('id-ID')}
          </div>

          <div className="flex items-center gap-2">
            <button
              id="copy-json-btn"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl border border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50 shadow-xs transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="text-emerald-700">Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Salin JSON</span>
                </>
              )}
            </button>

            <button
              id="download-json-btn"
              onClick={handleDownload}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-xl bg-amber-600 text-white hover:bg-amber-700 shadow-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh File .json</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
