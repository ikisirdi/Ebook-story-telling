import React, { useState } from 'react';
import {
  Languages,
  X,
  Sparkles,
  RefreshCw,
  Check,
  ArrowRight,
  BookOpen,
  Copy,
  AlertCircle,
  Wand2,
} from 'lucide-react';
import {
  translateStoryToIndonesian,
  TranslationResult,
} from '../services/translationService';

interface TranslationModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalText: string;
  originalTitle?: string;
  onApplyTranslation: (translatedText: string, translatedTitle?: string) => void;
  initialSourceLanguageHint?: string;
}

export const TranslationModal: React.FC<TranslationModalProps> = ({
  isOpen,
  onClose,
  originalText,
  originalTitle = '',
  onApplyTranslation,
  initialSourceLanguageHint,
}) => {
  const [style, setStyle] = useState<'sastra' | 'alami' | 'santai'>('sastra');
  const [isTranslating, setIsTranslating] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<TranslationResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'translated' | 'original' | 'split'>('translated');

  if (!isOpen) return null;

  const handleStartTranslate = async () => {
    setIsTranslating(true);
    setErrorMsg(null);
    setProgressMsg('Menghubungkan ke Gemini AI...');

    try {
      const res = await translateStoryToIndonesian({
        text: originalText,
        title: originalTitle,
        style,
        onProgress: (p) => setProgressMsg(p),
      });
      setResult(res);
      setActiveTab('translated');
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal menerjemahkan cerita ke Bahasa Indonesia.');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleCopy = () => {
    if (result?.translatedText) {
      navigator.clipboard.writeText(result.translatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleApply = () => {
    if (result?.translatedText) {
      onApplyTranslation(result.translatedText, result.translatedTitle);
      onClose();
    }
  };

  const wordCount = originalText.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white border border-neutral-200 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-neutral-200 flex items-center justify-between bg-amber-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
              <Languages className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-bold text-neutral-900">
                  Terjemahkan Cerita ke Bahasa Indonesia
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                  <Sparkles className="w-3 h-3 text-amber-600" />
                  Gemini AI Sastra
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-0.5">
                Menerjemahkan naskah novel/cerita luar negeri menjadi Bahasa Indonesia yang mengalir alami dan sastrawi.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-700 p-1.5 rounded-lg hover:bg-neutral-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configuration Bar */}
        <div className="p-4 bg-neutral-50/90 border-b border-neutral-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-neutral-700 whitespace-nowrap">
              Gaya Terjemahan:
            </span>
            <div className="inline-flex rounded-xl p-1 bg-white border border-neutral-200 text-xs">
              <button
                type="button"
                onClick={() => setStyle('sastra')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  style === 'sastra'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Sastra & Novel (Indah & Kaya Diksi)
              </button>
              <button
                type="button"
                onClick={() => setStyle('alami')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  style === 'alami'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Alami Kontemporer
              </button>
              <button
                type="button"
                onClick={() => setStyle('santai')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  style === 'santai'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Santai / Kasual
              </button>
            </div>
          </div>

          {result && (
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-neutral-200 self-end sm:self-auto text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('translated')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  activeTab === 'translated'
                    ? 'bg-amber-100 text-amber-900 font-bold'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Hasil Indonesia
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('split')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors hidden md:block ${
                  activeTab === 'split'
                    ? 'bg-amber-100 text-amber-900 font-bold'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Bandingkan (Dua Kolom)
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('original')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  activeTab === 'original'
                    ? 'bg-amber-100 text-amber-900 font-bold'
                    : 'text-neutral-600 hover:text-neutral-900'
                }`}
              >
                Teks Asli
              </button>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Terjadi Kendala Terjemahan:</p>
                <p className="mt-0.5">{errorMsg}</p>
              </div>
            </div>
          )}

          {!result && !isTranslating && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 text-neutral-800 text-xs space-y-2">
                <div className="flex items-center justify-between font-semibold text-amber-900">
                  <span className="flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-amber-700" />
                    Informasi Naskah Siap Diterjemahkan
                  </span>
                  <span>{wordCount.toLocaleString('id-ID')} kata asli</span>
                </div>
                {originalTitle && (
                  <p className="text-neutral-700">
                    <strong className="text-neutral-900">Judul Asli:</strong> {originalTitle}
                  </p>
                )}
                {initialSourceLanguageHint && (
                  <p className="text-neutral-700">
                    <strong className="text-neutral-900">Bahasa Terdeteksi:</strong> {initialSourceLanguageHint}
                  </p>
                )}
                <p className="text-neutral-600 leading-relaxed">
                  Penerjemah Gemini AI akan mengolah naskah ini menjadi Bahasa Indonesia sastra yang mengalir alami, mempertahankan nama karakter fiksi, tanda petik percakapan, dan ritme cerita agar sangat nyaman didengarkan sebagai narasi audiobook.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-600 block mb-1.5">
                  Pratinjau Teks Asli (500 karakter pertama):
                </label>
                <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 font-serif-book text-xs text-neutral-700 max-h-48 overflow-y-auto whitespace-pre-wrap leading-relaxed">
                  {originalText.slice(0, 1000)}
                  {originalText.length > 1000 && '...'}
                </div>
              </div>
            </div>
          )}

          {isTranslating && (
            <div className="py-14 flex flex-col items-center justify-center text-center space-y-4">
              <div className="relative">
                <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 animate-pulse">
                  <Wand2 className="w-8 h-8 animate-spin" />
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px]">
                  <Sparkles className="w-3 h-3" />
                </div>
              </div>
              <div>
                <h4 className="text-base font-bold text-neutral-900">
                  Menerjemahkan Cerita ke Bahasa Indonesia...
                </h4>
                <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                  {progressMsg || 'Menyelaraskan gaya sastra, narasi kalimat, dan dialog tokoh...'}
                </p>
              </div>
            </div>
          )}

          {result && !isTranslating && (
            <div>
              {/* Header result info */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 rounded-xl text-emerald-900">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>
                    Terjemahan Berhasil! ({result.translatedWordCount.toLocaleString('id-ID')} kata Indonesia)
                  </span>
                </div>
                {result.translatedTitle && (
                  <span className="font-semibold text-emerald-950">
                    Judul Indonesia: "{result.translatedTitle}"
                  </span>
                )}
              </div>

              {/* Views */}
              {activeTab === 'translated' && (
                <div className="space-y-2">
                  {result.translatedTitle && (
                    <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl">
                      <span className="text-[11px] font-bold text-amber-800 uppercase block">
                        Usulan Judul:
                      </span>
                      <p className="text-sm font-bold text-neutral-900 font-serif-book">
                        {result.translatedTitle}
                      </p>
                    </div>
                  )}
                  <div className="p-4 bg-white rounded-xl border border-neutral-300 font-serif-book text-sm text-neutral-900 leading-relaxed max-h-[380px] overflow-y-auto whitespace-pre-wrap select-text">
                    {result.translatedText}
                  </div>
                </div>
              )}

              {activeTab === 'original' && (
                <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-300 font-serif-book text-xs text-neutral-700 leading-relaxed max-h-[380px] overflow-y-auto whitespace-pre-wrap">
                  {originalText}
                </div>
              )}

              {activeTab === 'split' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto">
                  <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 font-serif-book text-xs text-neutral-700 leading-relaxed">
                    <span className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider block mb-1">
                      Naskah Asli:
                    </span>
                    <div className="whitespace-pre-wrap">{originalText}</div>
                  </div>
                  <div className="p-3.5 bg-white rounded-xl border border-amber-300 font-serif-book text-xs text-neutral-900 leading-relaxed">
                    <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block mb-1">
                      Terjemahan Indonesia (Gemini Sastra):
                    </span>
                    <div className="whitespace-pre-wrap">{result.translatedText}</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-neutral-50 border-t border-neutral-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            {result && (
              <button
                type="button"
                onClick={handleCopy}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700 transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Tersalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-neutral-500" />
                    <span>Salin Teks Indonesia</span>
                  </>
                )}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-600 hover:text-neutral-900 border border-neutral-200 bg-white hover:bg-neutral-100 transition-colors cursor-pointer"
            >
              Tutup
            </button>

            {!result ? (
              <button
                type="button"
                onClick={handleStartTranslate}
                disabled={isTranslating || !originalText.trim()}
                className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {isTranslating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Sedang Menerjemahkan...</span>
                  </>
                ) : (
                  <>
                    <Languages className="w-3.5 h-3.5" />
                    <span>Mulai Terjemahkan ke Indonesia</span>
                  </>
                )}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleStartTranslate}
                  disabled={isTranslating}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-neutral-700 border border-neutral-300 bg-white hover:bg-neutral-50 transition-colors cursor-pointer"
                  title="Terjemahkan ulang dengan pengaturan baru"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition-all cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Terapkan Terjemahan ke Naskah</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
