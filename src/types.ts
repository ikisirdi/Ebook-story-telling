export interface ChapterData {
  id: string;
  nomor: number;
  judul_bab: string;
  ringkasan?: string;
  teks: string;
  jumlah_kata: number;
  audio_url?: string;
  audio_status?: 'idle' | 'generating' | 'ready' | 'error';
  audio_error?: string;
  durasi_detik?: number;
  audio_duration?: number;
}

export interface EbookData {
  id?: string;
  judul: string;
  penulis?: string;
  deskripsi?: string;
  bahasa: string;
  dibuat_pada: string;
  total_kata: number;
  bab: ChapterData[];
}

// Format JSON output spesifik sesuai instruksi prompt: {judul, bab, teks, audio_url}
export interface StandardEbookOutput {
  judul: string;
  bab: string;
  teks: string;
  audio_url: string;
}

export type VoiceName = 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';

export type NarrationStyle = 'natural' | 'storytelling' | 'calm' | 'formal';

export interface TTSConfig {
  voice: VoiceName;
  speed: number;
  pitch: number;
  engine: 'gemini' | 'browser';
  style?: NarrationStyle;
  optimizeIndonesianText?: boolean;
}
