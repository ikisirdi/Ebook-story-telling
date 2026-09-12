import React, { useState } from 'react';
import { X, Volume2, Sparkles, Check, Play, Square, Settings2 } from 'lucide-react';
import { TTSConfig, VoiceName } from '../types';
import { browserSpeech } from '../utils/browserTTS';

interface AudioSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  ttsConfig: TTSConfig;
  setTtsConfig: React.Dispatch<React.SetStateAction<TTSConfig>>;
}

const GEMINI_VOICES: { name: VoiceName; gender: string; style: string; description: string }[] = [
  { name: 'Kore', gender: 'Wanita', style: 'Hangat & Tenang', description: 'Sangat cocok untuk novel sastra, renungan, dan cerita rakyat.' },
  { name: 'Puck', gender: 'Pria', style: 'Ceria & Ramah', description: 'Artikulasi energik dan komunikatif untuk fabel dan sains populer.' },
  { name: 'Fenrir', gender: 'Pria', style: 'Tegas & Berwibawa', description: 'Nada maskulin berbobot untuk kisah sejarah nusantara dan kepemimpinan.' },
  { name: 'Zephyr', gender: 'Netral', style: 'Jernih & Modern', description: 'Artikulasi presisi untuk artikel edukasi, panduan, dan ensiklopedia.' },
  { name: 'Charon', gender: 'Pria', style: 'Mendalam & Sinematik', description: 'Karakter suara bariton yang kuat untuk narasi epik dan misteri.' },
];

export const AudioSettingsModal: React.FC<AudioSettingsModalProps> = ({
  isOpen,
  onClose,
  ttsConfig,
  setTtsConfig,
}) => {
  const [isTestingVoice, setIsTestingVoice] = useState(false);
  const [testAudioUrl, setTestAudioUrl] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleTestVoice = async () => {
    setIsTestingVoice(true);
    const sampleText = 'Selamat datang di pemutar buku elektronik audio bahasa Indonesia. Sistem ini membacakan teks dengan intonasi yang alami dan menyenangkan.';

    try {
      if (ttsConfig.engine === 'browser') {
        browserSpeech.speak(sampleText, {
          rate: ttsConfig.speed,
          pitch: ttsConfig.pitch,
          onEnd: () => setIsTestingVoice(false),
          onError: () => setIsTestingVoice(false),
        });
      } else {
        // Test Gemini TTS
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: sampleText,
            voice: ttsConfig.voice,
          }),
        });
        const data = await res.json();
        if (data.data_url || data.audio_url) {
          const audio = new Audio(data.data_url || data.audio_url);
          audio.playbackRate = ttsConfig.speed;
          audio.onended = () => setIsTestingVoice(false);
          audio.onerror = () => setIsTestingVoice(false);
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
    setIsTestingVoice(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full flex flex-col shadow-2xl border border-neutral-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-600/10 text-amber-700 flex items-center justify-center">
              <Settings2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900">Pengaturan Suara Narasi</h3>
              <p className="text-xs text-neutral-500">
                Pilih mesin suara dan karakter narator bahasa Indonesia
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

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto max-h-[75vh]">
          {/* Engine Selector */}
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-600 block mb-2">
              Mesin Narasi Suara:
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
                  <span className="text-xs font-bold text-neutral-900">Gemini AI Studio TTS</span>
                  {ttsConfig.engine === 'gemini' && <Check className="w-4 h-4 text-amber-600" />}
                </div>
                <p className="text-[11px] text-neutral-500 mt-1">
                  Model neural audio berdefinisi tinggi dengan intonasi percakapan alami.
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
                <p className="text-[11px] text-neutral-500 mt-1">
                  Sintesis suara instan bahasa Indonesia bawaan sistem operasi peramban.
                </p>
              </button>
            </div>
          </div>

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
                        ? 'border-amber-600 bg-amber-50/40 ring-1 ring-amber-500/20'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-neutral-900">{v.name}</span>
                        <span className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.2 rounded-md font-medium">
                          {v.gender} • {v.style}
                        </span>
                      </div>
                      <p className="text-[11px] text-neutral-500 mt-0.5">{v.description}</p>
                    </div>

                    {ttsConfig.voice === v.name && <Check className="w-4 h-4 text-amber-600 shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Speed / Tempo */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-600">
                Kecepatan Narasi:
              </label>
              <span className="text-xs font-semibold text-amber-700">{ttsConfig.speed}x</span>
            </div>
            <input
              type="range"
              min={0.75}
              max={1.75}
              step={0.05}
              value={ttsConfig.speed}
              onChange={(e) =>
                setTtsConfig((prev) => ({ ...prev, speed: parseFloat(e.target.value) }))
              }
              className="w-full accent-amber-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-neutral-400 mt-1">
              <span>0.75x Lambat</span>
              <span>1.0x Normal</span>
              <span>1.75x Cepat</span>
            </div>
          </div>

          {/* Test Voice Section */}
          <div className="p-3.5 bg-neutral-50 rounded-xl border border-neutral-200 flex items-center justify-between gap-3">
            <div className="text-xs text-neutral-600">
              <span className="font-semibold text-neutral-800 block">Uji Contoh Suara:</span>
              Dengarkan cuplikan narasi suara bahasa Indonesia
            </div>

            {isTestingVoice ? (
              <button
                type="button"
                onClick={handleStopTest}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-red-600 text-white hover:bg-red-700 shadow-xs"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>Hentikan</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleTestVoice}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 shadow-xs"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Uji Suara</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-200 bg-neutral-50 flex items-center justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-amber-600 text-white hover:bg-amber-700 shadow-xs transition-colors"
          >
            Selesai
          </button>
        </div>
      </div>
    </div>
  );
};
