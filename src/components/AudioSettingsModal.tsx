import React, { useState, useEffect } from 'react';
import { X, Volume2, Sparkles, Check, Play, Square, Settings2, ShieldCheck, Radio } from 'lucide-react';
import { TTSConfig, VoiceName, NarrationStyle } from '../types';
import { browserSpeech } from '../utils/browserTTS';
import { normalizeIndonesianForSpeech } from '../utils/indonesianNormalizer';

interface AudioSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  ttsConfig: TTSConfig;
  setTtsConfig: React.Dispatch<React.SetStateAction<TTSConfig>>;
}

const GEMINI_VOICES: { name: VoiceName; gender: string; style: string; description: string; badge?: string }[] = [
  {
    name: 'Kore',
    gender: 'Wanita',
    style: 'Hangat & Mengalir Alami',
    description: 'Pilihan terbaik untuk novel sastra, renungan, dan kisah fiksi. Pelafalan bahasa Indonesia sangat halus dan tidak kaku.',
    badge: 'Paling Alami',
  },
  {
    name: 'Fenrir',
    gender: 'Pria',
    style: 'Tenang & Berwibawa',
    description: 'Karakter suara pria yang berbobot dan mengalir stabil tanpa jeda canggung untuk sejarah dan kisah kepemimpinan.',
    badge: 'Narator Pria',
  },
  {
    name: 'Zephyr',
    gender: 'Wanita',
    style: 'Jernih & Artikulatif',
    description: 'Artikulasi presisi tinggi untuk buku sains populer, artikel edukasi, dan panduan non-fiksi.',
  },
  {
    name: 'Puck',
    gender: 'Pria',
    style: 'Ramah & Ekspresif',
    description: 'Gaya bicara yang hidup dan bersahabat, sangat cocok untuk cerita anak dan petualangan.',
  },
  {
    name: 'Charon',
    gender: 'Pria',
    style: 'Mendalam & Sinematik',
    description: 'Karakter suara bariton yang dalam untuk narasi epik, misteri, dan legenda nusantara.',
  },
];

const NARRATION_STYLES: { id: NarrationStyle; title: string; desc: string }[] = [
  {
    id: 'natural',
    title: 'Alami & Mengalir (Rekomendasi Novel)',
    desc: 'Intonasi mendongeng yang rileks, tempo kalimat teratur, dan artikulasi fasih tanpa patah-patah.',
  },
  {
    id: 'storytelling',
    title: 'Bercerita & Ekspresif (Dongeng / Cerita)',
    desc: 'Penuh penjiwaan emosi dan dinamika suara yang hidup mengikuti jalannya alur kisah.',
  },
  {
    id: 'calm',
    title: 'Tenang & Lembut (Relaksasi)',
    desc: 'Tempo santai dan lembut, sangat nyaman untuk didengarkan sebelum tidur atau renungan.',
  },
  {
    id: 'formal',
    title: 'Informatif & Jernih (Buku Edukasi)',
    desc: 'Artikulasi baku yang tegas dan lugas untuk materi sains, wawasan, atau modul ilmiah.',
  },
];

export const AudioSettingsModal: React.FC<AudioSettingsModalProps> = ({
  isOpen,
  onClose,
  ttsConfig,
  setTtsConfig,
}) => {
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [activeTestAudio, setActiveTestAudio] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      const idv = browserSpeech.getIndonesianVoices();
      setBrowserVoices(idv);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestVoice = async () => {
    setIsTestingVoice(true);
    // Naskah uji coba bahasa Indonesia yang mencakup nama, tanda jeda dialog, dan angka
    const sampleText =
      'Di sebuah desa kecil di lereng perbukitan, mentari pagi bersinar hangat. "Selamat datang di perjalanan cerita kita," bisiknya dengan senyuman ramah. Bab Satu dimulai hari ini.';

    try {
      if (ttsConfig.engine === 'browser') {
        browserSpeech.speak(sampleText, {
          rate: ttsConfig.speed,
          pitch: ttsConfig.pitch,
          onEnd: () => setIsTestingVoice(false),
          onError: () => setIsTestingVoice(false),
        });
      } else {
        // Test Gemini TTS dengan gaya suara yang dipilih
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: sampleText,
            voice: ttsConfig.voice,
            style: ttsConfig.style || 'natural',
          }),
        });
        const data = await res.json();
        if (data.data_url || data.audio_url) {
          if (activeTestAudio) {
            activeTestAudio.pause();
          }
          const audio = new Audio(data.data_url || data.audio_url);
          setActiveTestAudio(audio);
          audio.playbackRate = ttsConfig.speed;
          audio.onended = () => {
            setIsTestingVoice(false);
            setActiveTestAudio(null);
          };
          audio.onerror = () => {
            setIsTestingVoice(false);
            setActiveTestAudio(null);
          };
          audio.play();
        } else if (data.canUseBrowserTTS) {
          // Fallback test
          browserSpeech.speak(sampleText, {
            rate: ttsConfig.speed,
            onEnd: () => setIsTestingVoice(false),
          });
        }
      }
    } catch (err) {
      console.error(err);
      setIsTestingVoice(false);
    }
  };

  const handleStopTest = () => {
    browserSpeech.stop();
    if (activeTestAudio) {
      activeTestAudio.pause();
      setActiveTestAudio(null);
    }
    setIsTestingVoice(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-xl w-full flex flex-col shadow-2xl border border-neutral-200 overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-600/10 text-amber-700 flex items-center justify-center">
              <Volume2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900">Pengaturan Suara Narasi Alami</h3>
              <p className="text-xs text-neutral-500">
                Optimasi artikulasi dan kelancaran suara bahasa Indonesia (Anti-Terbata)
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              handleStopTest();
              onClose();
            }}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Anti-stutter Notice Card */}
          <div className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-[12px] text-emerald-900 leading-relaxed">
              <span className="font-semibold block text-emerald-950">Normalisasi Kelancaran Aktif:</span>
              Naskah secara otomatis dibersihkan dari format kode markdown, elipsis patah, dan singkatan (seperti <em>dll, dsb, Bab IV</em>) diubah menjadi kata lengkap agar pelafalan mengalir alami tanpa terbata-bata.
            </div>
          </div>

          {/* Engine Selector */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-600 block mb-2">
              Mesin Narasi Audio:
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setTtsConfig((prev) => ({ ...prev, engine: 'gemini' }))}
                className={`p-3 rounded-xl border text-left transition-all ${
                  ttsConfig.engine === 'gemini'
                    ? 'border-amber-600 bg-amber-50/60 ring-2 ring-amber-500/20 shadow-xs'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                    Gemini AI Neural TTS
                    <span className="text-[9px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded-full font-bold">
                      Rekomendasi
                    </span>
                  </span>
                  {ttsConfig.engine === 'gemini' && <Check className="w-4 h-4 text-amber-600" />}
                </div>
                <p className="text-[11px] text-neutral-500 mt-1 leading-snug">
                  Model AI Generatif dengan intonasi mendongeng alami, dinamika nada bernyawa, dan kualitas vokal studio.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setTtsConfig((prev) => ({ ...prev, engine: 'browser' }))}
                className={`p-3 rounded-xl border text-left transition-all ${
                  ttsConfig.engine === 'browser'
                    ? 'border-amber-600 bg-amber-50/60 ring-2 ring-amber-500/20 shadow-xs'
                    : 'border-neutral-200 hover:border-neutral-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-900">Web Speech Peramban</span>
                  {ttsConfig.engine === 'browser' && <Check className="w-4 h-4 text-amber-600" />}
                </div>
                <p className="text-[11px] text-neutral-500 mt-1 leading-snug">
                  Sintesis instan tanpa kuota API, menggunakan suara bahasa Indonesia dari browser perangkat.
                </p>
              </button>
            </div>
          </div>

          {/* Narration Style (Gaya Narasi) */}
          {ttsConfig.engine === 'gemini' && (
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-600 block mb-2">
                Gaya Intonasi & Nada Narasi:
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {NARRATION_STYLES.map((style) => (
                  <button
                    key={style.id}
                    type="button"
                    onClick={() => setTtsConfig((prev) => ({ ...prev, style: style.id }))}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      (ttsConfig.style || 'natural') === style.id
                        ? 'border-amber-600 bg-amber-50/50 ring-1 ring-amber-500/30'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-neutral-900">{style.title}</span>
                      {(ttsConfig.style || 'natural') === style.id && (
                        <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      )}
                    </div>
                    <p className="text-[10px] text-neutral-500 mt-0.5 leading-snug">{style.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Gemini Voices */}
          {ttsConfig.engine === 'gemini' && (
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-600 block mb-2">
                Pilih Karakter Suara AI:
              </label>
              <div className="space-y-2">
                {GEMINI_VOICES.map((v) => (
                  <button
                    key={v.name}
                    type="button"
                    onClick={() => setTtsConfig((prev) => ({ ...prev, voice: v.name }))}
                    className={`w-full p-3 rounded-xl border text-left transition-all flex items-center justify-between gap-3 ${
                      ttsConfig.voice === v.name
                        ? 'border-amber-600 bg-amber-50/40 ring-1 ring-amber-500/20 shadow-xs'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-neutral-900">{v.name}</span>
                        <span className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.2 rounded-md font-medium">
                          {v.gender} • {v.style}
                        </span>
                        {v.badge && (
                          <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-full font-bold">
                            {v.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-0.5 leading-snug">{v.description}</p>
                    </div>

                    {ttsConfig.voice === v.name && <Check className="w-4 h-4 text-amber-600 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Browser Voices Info */}
          {ttsConfig.engine === 'browser' && browserVoices.length > 0 && (
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-600 block mb-1.5">
                Suara Bahasa Indonesia Terdeteksi di Peramban:
              </label>
              <div className="p-2.5 bg-neutral-50 rounded-xl border border-neutral-200 text-xs text-neutral-700">
                <span className="font-semibold text-neutral-900">
                  {browserSpeech.getIndonesianVoice()?.name || 'Bahasa Indonesia (Default)'}
                </span>
                <span className="text-[11px] text-neutral-500 block mt-0.5">
                  Sistem otomatis memilih suara terbaik yang terpasang di perangkat Anda.
                </span>
              </div>
            </div>
          )}

          {/* Speed / Tempo */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-600">
                Kecepatan Narasi Suara:
              </label>
              <span className="text-xs font-semibold text-amber-700">{ttsConfig.speed}x</span>
            </div>
            <input
              type="range"
              min={0.8}
              max={1.6}
              step={0.05}
              value={ttsConfig.speed}
              onChange={(e) =>
                setTtsConfig((prev) => ({ ...prev, speed: parseFloat(e.target.value) }))
              }
              className="w-full accent-amber-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-neutral-400 mt-1">
              <span>0.8x Sangat Tenang</span>
              <span>1.0x Standar Mengalir</span>
              <span>1.6x Cepat</span>
            </div>
          </div>

          {/* Test Voice Section */}
          <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 flex items-center justify-between gap-3">
            <div className="text-xs text-neutral-600">
              <span className="font-semibold text-neutral-800 block">Uji Contoh Suara:</span>
              Dengarkan contoh narasi bahasa Indonesia dengan pengaturan ini
            </div>

            {isTestingVoice ? (
              <button
                type="button"
                onClick={handleStopTest}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 shadow-xs transition-colors"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Hentikan</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleTestVoice}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 shadow-xs transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Uji Suara</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between">
          <span className="text-[11px] text-neutral-500">
            Perubahan diterapkan otomatis saat menghasilkan audio.
          </span>
          <button
            onClick={() => {
              handleStopTest();
              onClose();
            }}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-amber-600 text-white hover:bg-amber-700 shadow-xs transition-colors"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
