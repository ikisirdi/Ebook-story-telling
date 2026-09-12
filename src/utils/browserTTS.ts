// Web Speech API client-side synthesizer for Indonesian language

export interface SpeechPlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  currentTextIndex: number;
}

class BrowserSpeechEngine {
  private utterance: SpeechSynthesisUtterance | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private selectedVoice: SpeechSynthesisVoice | null = null;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.loadVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        this.loadVoices();
      };
    }
  }

  private loadVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    this.voices = window.speechSynthesis.getVoices();
    // Prioritize Indonesian voices (id-ID, in-ID, id, indonesian)
    const indonesianVoice = this.voices.find(
      (v) =>
        v.lang.toLowerCase().includes('id') ||
        v.lang.toLowerCase().includes('in-') ||
        v.name.toLowerCase().includes('indonesia')
    );
    if (indonesianVoice) {
      this.selectedVoice = indonesianVoice;
    }
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }

  public getIndonesianVoice(): SpeechSynthesisVoice | null {
    if (!this.selectedVoice) {
      this.loadVoices();
    }
    return this.selectedVoice;
  }

  public speak(
    text: string,
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

    const utterance = new SpeechSynthesisUtterance(text);
    this.utterance = utterance;

    const voice = this.getIndonesianVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = 'id-ID';
    }

    utterance.rate = options?.rate ?? 1.0;
    utterance.pitch = options?.pitch ?? 1.0;
    utterance.volume = options?.volume ?? 1.0;

    utterance.onstart = () => {
      options?.onStart?.();
    };

    utterance.onend = () => {
      options?.onEnd?.();
      this.utterance = null;
    };

    utterance.onerror = (e) => {
      if (e.error !== 'interrupted' && e.error !== 'canceled') {
        options?.onError?.(e);
      }
      this.utterance = null;
    };

    utterance.onboundary = (event) => {
      if (event.name === 'word' || event.charIndex !== undefined) {
        options?.onBoundary?.(event.charIndex);
      }
    };

    window.speechSynthesis.speak(utterance);
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
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      this.utterance = null;
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
