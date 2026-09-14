// Web Speech API client-side synthesizer for Indonesian language
// Dioptimalkan dengan antrean kalimat cerdas, normalisasi singkatan, dan pemilihan suara natural
// untuk mencegah suara terbata-bata atau terhenti di tengah jalan (bug Chromium 15s).

import { normalizeIndonesianForSpeech } from './indonesianNormalizer';

export interface SpeechPlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  currentTextIndex: number;
}

class BrowserSpeechEngine {
  private voices: SpeechSynthesisVoice[] = [];
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private queue: string[] = [];
  private currentQueueIndex = 0;
  private isCanceled = false;
  private keepAliveInterval: any = null;
  private activeUtterance: SpeechSynthesisUtterance | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.loadVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        this.loadVoices();
      };
    }
  }

  public loadVoices(): SpeechSynthesisVoice[] {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
    this.voices = window.speechSynthesis.getVoices();

    const idVoices = this.voices.filter(
      (v) =>
        v.lang.toLowerCase().includes('id') ||
        v.lang.toLowerCase().includes('in-') ||
        v.name.toLowerCase().includes('indonesia')
    );

    if (idVoices.length > 0) {
      // Urutkan berdasarkan kualitas kejernihan suara:
      // 1. Suara Natural / Neural (Microsoft Online Natural, Google Online)
      // 2. Google Bahasa Indonesia
      // 3. Apple Damayanti / macOS
      // 4. Standar id-ID
      idVoices.sort((a, b) => {
        const scoreA = this.getVoiceQualityScore(a);
        const scoreB = this.getVoiceQualityScore(b);
        return scoreB - scoreA;
      });
      this.selectedVoice = idVoices[0];
    }
    return this.voices;
  }

  private getVoiceQualityScore(voice: SpeechSynthesisVoice): number {
    const name = voice.name.toLowerCase();
    const lang = voice.lang.toLowerCase();
    let score = 10;

    if (name.includes('natural') || name.includes('online')) score += 50;
    if (name.includes('google')) score += 30;
    if (name.includes('microsoft')) score += 25;
    if (name.includes('damayanti')) score += 20;
    if (lang === 'id-id' || lang === 'id_id') score += 15;
    if (voice.default) score += 5;

    return score;
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }

  public getIndonesianVoices(): SpeechSynthesisVoice[] {
    if (this.voices.length === 0) {
      this.loadVoices();
    }
    return this.voices.filter(
      (v) =>
        v.lang.toLowerCase().includes('id') ||
        v.lang.toLowerCase().includes('in-') ||
        v.name.toLowerCase().includes('indonesia')
    );
  }

  public getIndonesianVoice(): SpeechSynthesisVoice | null {
    if (!this.selectedVoice) {
      this.loadVoices();
    }
    return this.selectedVoice;
  }

  public setVoice(voice: SpeechSynthesisVoice) {
    this.selectedVoice = voice;
  }

  /**
   * Membaca teks bahasa Indonesia dengan sistem antrean kalimat cerdas
   * agar tidak terpotong di tengah naskah dan intonasinya mengalir halus.
   */
  public speak(
    rawText: string,
    options?: {
      rate?: number;
      pitch?: number;
      volume?: number;
      onStart?: () => void;
      onEnd?: () => void;
      onError?: (err: any) => void;
      onBoundary?: (charIndex: number) => void;
    }
  ) {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      options?.onError?.(new Error('Browser ini tidak mendukung Web Speech API'));
      return;
    }

    this.stop();
    this.isCanceled = false;

    // Normalisasi teks Indonesia terlebih dahulu untuk menghilangkan singkatan dan format markdown
    const normalized = normalizeIndonesianForSpeech(rawText);
    if (!normalized.trim()) {
      options?.onEnd?.();
      return;
    }

    // Pecah naskah menjadi kalimat-kalimat utuh (maksimal ~180 karakter per kalimat)
    // agar Chromium Web Speech tidak mengalami timeout atau patah intonasi
    const sentenceRegex = /[^.!?\n]+[.!?\n]+(?:\s+|$)|[^.!?\n]+$/g;
    const rawMatches = normalized.match(sentenceRegex) || [normalized];
    const sentences: string[] = [];

    for (const match of rawMatches) {
      const trimmed = match.trim();
      if (!trimmed) continue;
      if (trimmed.length <= 220) {
        sentences.push(trimmed);
      } else {
        // Jika satu kalimat luar biasa panjang, bagi di batas koma atau spasi
        const commaParts = trimmed.split(/,\s*/);
        let buffer = '';
        for (const part of commaParts) {
          if ((buffer + ', ' + part).length <= 200) {
            buffer = buffer ? buffer + ', ' + part : part;
          } else {
            if (buffer) sentences.push(buffer.trim());
            buffer = part;
          }
        }
        if (buffer.trim()) sentences.push(buffer.trim());
      }
    }

    if (sentences.length === 0) {
      options?.onEnd?.();
      return;
    }

    this.queue = sentences;
    this.currentQueueIndex = 0;

    const voice = this.getIndonesianVoice();
    const rate = Math.min(Math.max(options?.rate ?? 1.0, 0.7), 1.6);
    const pitch = options?.pitch ?? 1.0;
    const volume = options?.volume ?? 1.0;

    options?.onStart?.();

    // Chromium keepalive ping untuk mencegah speech synthesis freeze setelah 15 detik
    this.startKeepAlive();

    const playNextSentence = () => {
      if (this.isCanceled) {
        this.stopKeepAlive();
        return;
      }

      if (this.currentQueueIndex >= this.queue.length) {
        this.stopKeepAlive();
        this.activeUtterance = null;
        options?.onEnd?.();
        return;
      }

      const sentence = this.queue[this.currentQueueIndex];
      const utterance = new SpeechSynthesisUtterance(sentence);
      this.activeUtterance = utterance;

      if (voice) {
        utterance.voice = voice;
        utterance.lang = voice.lang;
      } else {
        utterance.lang = 'id-ID';
      }

      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.volume = volume;

      utterance.onend = () => {
        if (!this.isCanceled) {
          this.currentQueueIndex++;
          // Sedikit jeda natural (40ms) antar kalimat
          setTimeout(playNextSentence, 40);
        }
      };

      utterance.onerror = (e) => {
        if (e.error !== 'interrupted' && e.error !== 'canceled') {
          console.warn('Web Speech error on sentence:', e);
        }
        if (!this.isCanceled) {
          this.currentQueueIndex++;
          playNextSentence();
        }
      };

      window.speechSynthesis.speak(utterance);
    };

    playNextSentence();
  }

  private startKeepAlive() {
    this.stopKeepAlive();
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    this.keepAliveInterval = setInterval(() => {
      if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }
    }, 10000);
  }

  private stopKeepAlive() {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  public pause() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.pause();
    }
  }

  public resume() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.resume();
    }
  }

  public stop() {
    this.isCanceled = true;
    this.stopKeepAlive();
    this.queue = [];
    this.currentQueueIndex = 0;
    this.activeUtterance = null;
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  public isSpeaking(): boolean {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      return window.speechSynthesis.speaking;
    }
    return false;
  }
}

export const browserSpeech = new BrowserSpeechEngine();
