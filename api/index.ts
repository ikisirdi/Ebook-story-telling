import express, { Request, Response, Router } from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI, Modality, Type } from '@google/genai';
import { randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';

dotenv.config();

export const app = express();

// Enable CORS and body parsing
app.use((_req: Request, res: Response, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (_req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// In-memory audio cache for serving audio streams and download
const audioCache = new Map<string, { buffer: Buffer; contentType: string; createdAt: number }>();

// Cleanup audio older than 2 hours periodically
setInterval(() => {
  const now = Date.now();
  for (const [id, item] of audioCache.entries()) {
    if (now - item.createdAt > 2 * 60 * 60 * 1000) {
      audioCache.delete(id);
    }
  }
}, 30 * 60 * 1000);

// Helper to convert 16-bit PCM little-endian buffer into standard RIFF WAV buffer
export function pcmToWavBuffer(
  pcmBuffer: Buffer,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16
): Buffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const wavHeader = Buffer.alloc(44);

  wavHeader.write('RIFF', 0);
  wavHeader.writeUInt32LE(36 + pcmBuffer.length, 4);
  wavHeader.write('WAVE', 8);
  wavHeader.write('fmt ', 12);
  wavHeader.writeUInt32LE(16, 16); // PCM subchunk size
  wavHeader.writeUInt16LE(1, 20); // PCM format = 1
  wavHeader.writeUInt16LE(numChannels, 22);
  wavHeader.writeUInt32LE(sampleRate, 24);
  wavHeader.writeUInt32LE(byteRate, 28);
  wavHeader.writeUInt16LE(blockAlign, 32);
  wavHeader.writeUInt16LE(bitsPerSample, 34);
  wavHeader.write('data', 36);
  wavHeader.writeUInt32LE(pcmBuffer.length, 40);

  return Buffer.concat([wavHeader, pcmBuffer]);
}

// Fallback rule-based text segmentation
export function fallbackSegmentText(text: string, customTitle?: string) {
  const clean = text.trim();
  const words = clean.split(/\s+/).filter(Boolean);
  const totalWords = words.length;

  // Try finding explicit chapter headings
  const chapterRegex =
    /(?:^|\n)(?:#{1,3}\s+|Bab\s+\d+|BAB\s+[IVXLCDM\d]+|Bagian\s+\d+|Chapter\s+\d+)[^\n]*/gi;
  const matches = Array.from(clean.matchAll(chapterRegex));

  const chapters: Array<{
    nomor: number;
    judul_bab: string;
    ringkasan: string;
    teks: string;
    jumlah_kata: number;
  }> = [];

  if (matches.length >= 2) {
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const start = match.index! + match[0].length;
      const end = i < matches.length - 1 ? matches[i + 1].index! : clean.length;
      const chapterTitle = match[0].replace(/^[#\s]+/, '').trim();
      const chapterContent = clean.slice(start, end).trim();
      const chapWords = chapterContent.split(/\s+/).filter(Boolean).length;

      chapters.push({
        nomor: i + 1,
        judul_bab: chapterTitle || `Bab ${i + 1}`,
        ringkasan:
          chapterContent.slice(0, 160).trim() +
          (chapterContent.length > 160 ? '...' : ''),
        teks: chapterContent,
        jumlah_kata: chapWords,
      });
    }
  } else {
    // Split by paragraphs into balanced segments (~600 - 1200 words each)
    const paragraphs = clean
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    let currentText = '';
    let currentWords = 0;
    let chapIndex = 1;
    const targetWordCount = totalWords > 4000 ? 1200 : totalWords > 2000 ? 800 : 500;

    for (const para of paragraphs) {
      const paraWords = para.split(/\s+/).filter(Boolean).length;
      if (currentWords + paraWords > targetWordCount && currentText.length > 0) {
        chapters.push({
          nomor: chapIndex,
          judul_bab: `Bab ${chapIndex}: Bagian ${chapIndex}`,
          ringkasan: currentText.slice(0, 160).trim() + '...',
          teks: currentText.trim(),
          jumlah_kata: currentWords,
        });
        chapIndex++;
        currentText = para;
        currentWords = paraWords;
      } else {
        currentText += (currentText ? '\n\n' : '') + para;
        currentWords += paraWords;
      }
    }

    if (currentText.trim().length > 0) {
      chapters.push({
        nomor: chapIndex,
        judul_bab: `Bab ${chapIndex}: Bagian ${chapIndex}`,
        ringkasan:
          currentText.slice(0, 160).trim() +
          (currentText.length > 160 ? '...' : ''),
        teks: currentText.trim(),
        jumlah_kata: currentWords,
      });
    }
  }

  // Derive title
  const firstLine = clean.split('\n')[0].replace(/^[#\s]+/, '').trim();
  const derivedTitle =
    customTitle ||
    (firstLine.length > 3 && firstLine.length < 80
      ? firstLine
      : 'Buku Narasi Elektronik');

  return {
    judul: derivedTitle,
    penulis: 'Penulis Buku',
    deskripsi: `Buku elektronik dengan total ${totalWords} kata terbagi menjadi ${chapters.length} bab.`,
    bab: chapters,
    total_kata: totalWords,
  };
}

// Indonesian Text Normalizer for Natural Audio Narration (Anti-terbata-bata)
const ROMAN_NUMERALS_MAP: Record<string, string> = {
  I: 'Satu',
  II: 'Dua',
  III: 'Tiga',
  IV: 'Empat',
  V: 'Lima',
  VI: 'Enam',
  VII: 'Tujuh',
  VIII: 'Delapan',
  IX: 'Sembilan',
  X: 'Sepuluh',
  XI: 'Sebelas',
  XII: 'Dua Belas',
  XIII: 'Tiga Belas',
  XIV: 'Empat Belas',
  XV: 'Lima Belas',
  XVI: 'Enam Belas',
  XVII: 'Tujuh Belas',
  XVIII: 'Delapan Belas',
  XIX: 'Sembilan Belas',
  XX: 'Dua Puluh',
};

const ID_ABBREVIATIONS: Array<[RegExp, string | ((...args: any[]) => string)]> = [
  [/\bdll\.?/gi, 'dan lain-lain'],
  [/\bdsb\.?/gi, 'dan sebagainya'],
  [/\bdst\.?/gi, 'dan seterusnya'],
  [/\bdkk\.?/gi, 'dan kawan-kawan'],
  [/\bhlm\.?\s*(\d+)/gi, 'halaman $1'],
  [/\bhlm\.?/gi, 'halaman'],
  [/\bhal\.?\s*(\d+)/gi, 'halaman $1'],
  [/\bhal\.?/gi, 'halaman'],
  [/\bno\.?\s*(\d+)/gi, 'nomor $1'],
  [/\bno\.?/gi, 'nomor'],
  [/\bdr\.\s+/gi, 'dokter '],
  [/\bDr\.\s+/g, 'Doktor '],
  [/\bprof\.\s+/gi, 'profesor '],
  [/\bProf\.\s+/g, 'Profesor '],
  [/\bs\/d\b/gi, 'sampai dengan'],
  [/\bs\.d\./gi, 'sampai dengan'],
  [/\bttg\.?/gi, 'tentang'],
  [/\btsb\.?/gi, 'tersebut'],
  [/\bthn\.?/gi, 'tahun'],
  [/\bbln\.?/gi, 'bulan'],
  [/\b(\d+)\s*%\b/g, '$1 persen'],
  [/\b(\d+)\s*kg\b/gi, '$1 kilogram'],
  [/\b(\d+)\s*km\b/gi, '$1 kilometer'],
  [/\b(\d+)\s*m\b/gi, '$1 meter'],
  [/\b(\d+)\s*cm\b/gi, '$1 sentimeter'],
  [/\bRp\.?\s*([\d\.]+)/gi, (_m, p1) => `${p1.replace(/\./g, '')} rupiah`],
  [/\byg\b/gi, 'yang'],
  [/\bdgn\b/gi, 'dengan'],
  [/\butk\b/gi, 'untuk'],
  [/\bpd\b/gi, 'pada'],
  [/\bsdh\b/gi, 'sudah'],
  [/\bblm\b/gi, 'belum'],
  [/\bkrn\b/gi, 'karena'],
  [/\bbkn\b/gi, 'bukan'],
  [/\btetep\b/gi, 'tetap'],
];

export function normalizeIndonesianForSpeech(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return '';
  let text = rawText;

  // 1. Bersihkan karakter format Markdown
  text = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\[\d+\]/g, '')
    .replace(/^>\s*/gm, '')
    .replace(/^[-*_]{3,}\s*$/gm, '')
    .replace(/^[\s]*[-*+]\s+/gm, '');

  // 2. Normalisasi Bab angka Romawi: "Bab IV" -> "Bab Empat"
  text = text.replace(
    /\b(Bab|BAB|Bagian|BAGIAN)\s+([IVXLCDM]+)\b/g,
    (_m, prefix, roman) => {
      const spelled = ROMAN_NUMERALS_MAP[roman.toUpperCase()];
      return spelled ? `${prefix} ${spelled}` : `${prefix} ${roman}`;
    }
  );

  // 3. Normalisasi tanda baca yang membuat TTS terbata-bata
  text = text.replace(/\.{3,}/g, ', ');
  text = text.replace(/\s*—\s*/g, ', ');
  text = text.replace(/\s*--\s*/g, ', ');
  text = text.replace(/\s*–\s*/g, ', ');

  // 4. Perluas singkatan
  for (const [regex, replacement] of ID_ABBREVIATIONS) {
    if (typeof replacement === 'function') {
      text = text.replace(regex, replacement as any);
    } else {
      text = text.replace(regex, replacement);
    }
  }

  // 5. Rapikan spasi tanda baca
  text = text
    .replace(/\?+/g, '?')
    .replace(/!+/g, '!')
    .replace(/,+/g, ',')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s*\.\s*/g, '. ')
    .replace(/\s*\?\s*/g, '? ')
    .replace(/\s*!\s*/g, '! ');

  return text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Helper to split text into natural narration chunks for TTS
export function splitTextIntoTTSChunks(text: string, maxChunkLength = 2400): string[] {
  const clean = normalizeIndonesianForSpeech(text);
  if (clean.length <= maxChunkLength) {
    return [clean];
  }

  // Split strictly by paragraphs first to preserve full sentence cadence
  const paragraphs = clean.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    if ((current + '\n\n' + para).trim().length <= maxChunkLength) {
      current = (current ? current + '\n\n' : '') + para;
      continue;
    }

    if (current.length > 0) {
      chunks.push(current.trim());
      current = '';
    }

    if (para.length <= maxChunkLength) {
      current = para;
      continue;
    }

    // Paragraph is longer than maxChunkLength, split strictly by complete sentences
    const sentenceRegex = /[^.!?\n]+[.!?\n]+(?:\s+|$)/g;
    const sentences = para.match(sentenceRegex) || [para];
    for (const sentence of sentences) {
      const sTrim = sentence.trim();
      if (!sTrim) continue;

      if ((current + ' ' + sTrim).trim().length <= maxChunkLength) {
        current = (current ? current + ' ' : '') + sTrim;
      } else {
        if (current.length > 0) {
          chunks.push(current.trim());
          current = '';
        }
        if (sTrim.length <= maxChunkLength) {
          current = sTrim;
        } else {
          // Hard break on word boundary only if single sentence exceeds limit
          let rem = sTrim;
          while (rem.length > maxChunkLength) {
            let splitIdx = rem.lastIndexOf(' ', maxChunkLength);
            if (splitIdx <= 0) splitIdx = maxChunkLength;
            chunks.push(rem.slice(0, splitIdx).trim());
            rem = rem.slice(splitIdx).trim();
          }
          current = rem;
        }
      }
    }
  }

  if (current.trim().length > 0) {
    chunks.push(current.trim());
  }

  return chunks;
}

// Persistent Supabase configuration storage on server (ensures all devices share credentials)
const SUPABASE_CONFIG_FILE = path.join(process.cwd(), '.supabase-config.json');
const SUPABASE_TMP_CONFIG_FILE = '/tmp/.supabase-config.json';
let inMemorySupabaseConfig: { url: string; key: string } | null = null;

function getStoredSupabaseConfig(): { url: string; key: string } {
  // 1. Environment variables have priority
  const envUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const envKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';
  if (envUrl && envKey) {
    return { url: envUrl.trim(), key: envKey.trim() };
  }

  // 2. In-memory cache
  if (inMemorySupabaseConfig && inMemorySupabaseConfig.url && inMemorySupabaseConfig.key) {
    return inMemorySupabaseConfig;
  }

  // 3. Read from persistent file if available
  const candidateFiles = [SUPABASE_CONFIG_FILE, SUPABASE_TMP_CONFIG_FILE];
  for (const file of candidateFiles) {
    try {
      if (fs.existsSync(file)) {
        const raw = fs.readFileSync(file, 'utf-8');
        const data = JSON.parse(raw);
        if (data && data.url && data.key) {
          inMemorySupabaseConfig = { url: String(data.url).trim(), key: String(data.key).trim() };
          return inMemorySupabaseConfig;
        }
      }
    } catch {
      // ignore
    }
  }

  return { url: '', key: '' };
}

function saveStoredSupabaseConfig(url: string, key: string): boolean {
  inMemorySupabaseConfig = { url: url.trim(), key: key.trim() };
  const payload = JSON.stringify({ url: url.trim(), key: key.trim(), savedAt: new Date().toISOString() }, null, 2);
  let saved = false;

  try {
    fs.writeFileSync(SUPABASE_CONFIG_FILE, payload, 'utf-8');
    saved = true;
  } catch {
    // ignore if process.cwd() is read-only
  }

  try {
    fs.writeFileSync(SUPABASE_TMP_CONFIG_FILE, payload, 'utf-8');
    saved = true;
  } catch {
    // ignore
  }

  return saved;
}

function clearStoredSupabaseConfig(): void {
  inMemorySupabaseConfig = null;
  try {
    if (fs.existsSync(SUPABASE_CONFIG_FILE)) fs.unlinkSync(SUPABASE_CONFIG_FILE);
  } catch {}
  try {
    if (fs.existsSync(SUPABASE_TMP_CONFIG_FILE)) fs.unlinkSync(SUPABASE_TMP_CONFIG_FILE);
  } catch {}
}

// Router to handle endpoints both with and without '/api' prefix (for Vercel rewrites flexibility)
const apiRouter = Router();

// Supabase configuration sync endpoint
apiRouter.get('/supabase-config', (_req: Request, res: Response) => {
  const config = getStoredSupabaseConfig();
  res.json({
    configured: Boolean(config.url && config.key),
    url: config.url,
    key: config.key,
  });
});

apiRouter.post('/supabase-config', (req: Request, res: Response) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {}
    }
    const { url, key, reset } = body || {};

    if (reset) {
      clearStoredSupabaseConfig();
      return res.json({ success: true, message: 'Kredensial Supabase berhasil dibersihkan.' });
    }

    if (!url || !key) {
      return res.status(400).json({ error: 'URL dan Anon Key diperlukan.' });
    }

    saveStoredSupabaseConfig(url, key);
    return res.json({
      success: true,
      message: 'Kredensial Supabase berhasil disimpan secara permanen di server untuk semua perangkat.',
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Gagal menyimpan konfigurasi Supabase.' });
  }
});

// Health check API
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    environment: process.env.VERCEL ? 'vercel' : 'container',
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

// Segment text API
apiRouter.post('/segment', async (req: Request, res: Response) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // ignore
      }
    }
    const { text, titleHint, maxWordsPerChapter, apiKey: customKey } = body || {};
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Teks input wajib diisi.' });
    }

    const trimmed = text.trim();
    const wordCount = trimmed.split(/\s+/).filter(Boolean).length;

    // Check if API key is configured
    const apiKey =
      process.env.GEMINI_API_KEY ||
      (req.headers['x-gemini-api-key'] as string) ||
      customKey;

    if (!apiKey) {
      const fallbackResult = fallbackSegmentText(trimmed, titleHint);
      return res.json({
        ...fallbackResult,
        source: 'heuristic',
        message:
          'Menggunakan algoritma segmentasi lokal (Kunci Gemini API belum diatur di Secrets atau Vercel Environment Variables).',
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const prompt = `Anda adalah editor buku dan sastrawan profesional bahasa Indonesia.
Tugas Anda adalah membaca naskah panjang berikut (total kata: ~${wordCount}) dan membaginya menjadi bab-bab (segmen) yang sangat terstruktur, berurutan, dan nyaman dibaca serta didengarkan sebagai audiobook.

Instruksi:
1. Tentukan judul buku yang representatif dan menarik jika belum ada (gunakan saran: "${titleHint || ''}" jika cocok).
2. Buat deskripsi ringkas mengenai intisari atau sinopsis naskah (2-3 kalimat).
3. Bagi teks menjadi bab-bab yang rapi.
   - PENTING: JANGAN memotong atau menghilangkan alur teks asli naskah. Seluruh teks asli harus tercakup secara utuh di antara bab-bab tersebut.
   - Berikan nama bab yang estetik dan bermakna (misalnya: "Bab 1: Jejak di Tanah Leluhur", "Bab 2: Rahasia yang Tersingkap").
   - Buat ringkasan 1-2 kalimat untuk setiap bab.
   ${maxWordsPerChapter ? `- Usahakan setiap bab berkisar sekitar ${maxWordsPerChapter} kata.` : '- Usahakan panjang per bab seimbang (sekitar 500-1500 kata per bab tergantung konteks).'}

Naskah:
"""
${trimmed.slice(0, 80000)}
"""`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            judul: { type: Type.STRING, description: 'Judul utama buku' },
            penulis: { type: Type.STRING, description: 'Nama penulis atau Tidak Disebutkan' },
            deskripsi: { type: Type.STRING, description: 'Sinopsis ringkas buku' },
            bab: {
              type: Type.ARRAY,
              description: 'Daftar bab yang terbagi secara runut',
              items: {
                type: Type.OBJECT,
                properties: {
                  nomor: { type: Type.INTEGER },
                  judul_bab: { type: Type.STRING, description: 'Nama bab lengkap' },
                  ringkasan: { type: Type.STRING, description: 'Ringkasan singkat isi bab' },
                  teks: { type: Type.STRING, description: 'Teks lengkap untuk bab ini tanpa potongan' },
                },
                required: ['nomor', 'judul_bab', 'teks'],
              },
            },
          },
          required: ['judul', 'bab'],
        },
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    if (!parsed.bab || !Array.isArray(parsed.bab) || parsed.bab.length === 0) {
      throw new Error('Hasil segmentasi dari AI kosong.');
    }

    // Add word counts
    const chaptersWithMeta = parsed.bab.map((ch: any, idx: number) => {
      const chText = ch.teks || '';
      return {
        nomor: ch.nomor || idx + 1,
        judul_bab: ch.judul_bab || `Bab ${idx + 1}`,
        ringkasan: ch.ringkasan || chText.slice(0, 160) + '...',
        teks: chText,
        jumlah_kata: chText.split(/\s+/).filter(Boolean).length,
      };
    });

    res.json({
      judul: parsed.judul || titleHint || 'Buku Narasi Elektronik',
      penulis: parsed.penulis || 'Penulis',
      deskripsi: parsed.deskripsi || `Buku elektronik dengan total ${wordCount} kata.`,
      bab: chaptersWithMeta,
      total_kata: wordCount,
      source: 'gemini',
    });
  } catch (err: any) {
    console.error('Error during segmentation:', err);
    // Fallback to local heuristic
    const fallbackResult = fallbackSegmentText(req.body.text || '', req.body.titleHint);
    res.json({
      ...fallbackResult,
      source: 'heuristic_fallback',
      warning: err.message || 'Gagal memanggil Gemini, dialihkan ke segmentasi lokal otomatis.',
    });
  }
});

// Text-to-Speech API
apiRouter.post('/tts', async (req: Request, res: Response) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // ignore
      }
    }
    const { text, voice = 'Kore', style = 'natural', apiKey: customKey } = body || {};
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Teks naskah untuk narasi suara masih kosong.' });
    }

    const cleanText = text.trim();
    const normalizedText = normalizeIndonesianForSpeech(cleanText);
    const apiKey =
      process.env.GEMINI_API_KEY ||
      (req.headers['x-gemini-api-key'] as string) ||
      customKey;

    if (!apiKey) {
      console.warn(
        '[TTS] GEMINI_API_KEY tidak ditemukan di Vercel environment variables. Mengalihkan ke Browser Web Speech.'
      );
      return res.json({
        success: true,
        audio_id: 'browser-' + randomUUID(),
        audio_url: 'speech:browser-id-ID',
        fallbackToBrowser: true,
        canUseBrowserTTS: true,
        duration_seconds: Math.round((cleanText.length || 100) / 20),
        notice:
          'Kunci GEMINI_API_KEY belum diatur di Vercel Environment Variables. Narasi suara dialihkan otomatis ke Web Speech Browser.',
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    // Gunakan segmentasi paragraf yang luas (hingga 2500 karakter per segmen)
    // agar naskah bab dapat dibacakan secara utuh dalam satu tarikan nafas dan intonasi tanpa terpotong
    const textChunks = splitTextIntoTTSChunks(normalizedText, 2500);
    // Batasi maksimum 3 segmen (~7500 karakter / ~1200 kata) per panggilan HTTP
    const chunksToProcess = textChunks.slice(0, 3);

    // Instruksi intonasi naratif yang disesuaikan agar tidak terbata-bata
    let styleInstruction =
      'Bacakan narasi buku berikut dengan intonasi mendongeng yang alami, artikulasi kata bahasa Indonesia yang fasih, tempo tenang yang mengalir lancar, dan tanpa jeda canggung:';
    if (style === 'storytelling') {
      styleInstruction =
        'Bacakan kisah berikut dengan intonasi bercerita yang hidup, penuh penghayatan, artikulasi kata jelas, dan tempo yang mengalir mulus:';
    } else if (style === 'calm') {
      styleInstruction =
        'Bacakan naskah berikut dengan suara lembut, tenang, tempo santai yang teratur, dan intonasi ramah yang mengalir damai:';
    } else if (style === 'formal') {
      styleInstruction =
        'Bacakan teks berikut dengan artikulasi jernih, intonasi terstruktur dan berwibawa dalam bahasa Indonesia baku yang fasih:';
    }

    const pcmBuffers: Buffer[] = [];
    // Jeda alami antar-segmen yang sangat halus (80 milidetik), bukan jeda hening kaku 250ms
    const naturalBreathPause = Buffer.alloc(Math.floor(24000 * 2 * 0.08));

    for (let cIdx = 0; cIdx < chunksToProcess.length; cIdx++) {
      const chunk = chunksToProcess[cIdx];
      const narrationPrompt = `${styleInstruction}\n\n${chunk}`;

      const ttsResponse = await ai.models.generateContent({
        model: 'gemini-3.1-flash-tts-preview',
        contents: [{ parts: [{ text: narrationPrompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice as any },
            },
          },
        },
      });

      const base64Audio = ttsResponse.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (base64Audio) {
        const rawPcm = Buffer.from(base64Audio, 'base64');
        if (pcmBuffers.length > 0) {
          pcmBuffers.push(naturalBreathPause);
        }
        pcmBuffers.push(rawPcm);
      }
    }

    if (pcmBuffers.length === 0) {
      throw new Error('Tidak ada data audio yang dihasilkan oleh model suara.');
    }

    const combinedPcm = Buffer.concat(pcmBuffers);
    const wavBuffer = pcmToWavBuffer(combinedPcm, 24000, 1, 16);

    const audioId = randomUUID();
    audioCache.set(audioId, {
      buffer: wavBuffer,
      contentType: 'audio/wav',
      createdAt: Date.now(),
    });

    const audioUrl = `/api/audio/${audioId}`;
    const base64Wav = wavBuffer.toString('base64');
    const dataUrl = `data:audio/wav;base64,${base64Wav}`;

    const durationSeconds = Math.round((combinedPcm.length / (24000 * 2)) * 10) / 10;

    res.json({
      success: true,
      audio_id: audioId,
      audio_url: audioUrl,
      data_url: dataUrl,
      duration_seconds: durationSeconds,
      engine: 'gemini',
      voice: voice,
      chunks_count: chunksToProcess.length,
      has_more_text: textChunks.length > 4,
      total_words: cleanText.split(/\s+/).filter(Boolean).length,
    });
  } catch (err: any) {
    const isQuotaExhausted =
      err.status === 429 ||
      err.code === 429 ||
      err.message?.includes('429') ||
      err.message?.includes('RESOURCE_EXHAUSTED') ||
      err.message?.includes('quota') ||
      err.message?.includes('exceeded your current quota');

    console.warn(
      `[TTS] ${isQuotaExhausted ? 'Quota reached (429 RESOURCE_EXHAUSTED)' : 'TTS Error'}: ${err.message || err}`
    );

    // Return 200 with browser TTS instructions so user is never blocked
    res.json({
      success: true,
      audio_id: 'browser-' + randomUUID(),
      audio_url: 'speech:browser-id-ID',
      fallbackToBrowser: true,
      canUseBrowserTTS: true,
      duration_seconds: Math.round((req.body?.text?.length || 100) / 20),
      notice: isQuotaExhausted
        ? 'Batas kuota Gemini TTS tercapai. Narasi dialihkan otomatis ke Narasi Web Speech (Bahasa Indonesia).'
        : 'Layanan audio dialihkan otomatis ke Narasi Web Speech.',
    });
  }
});

// Stream audio by ID
apiRouter.get('/audio/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const audioItem = audioCache.get(id);

  if (!audioItem) {
    return res.status(404).send('Audio tidak ditemukan atau telah kedaluwarsa.');
  }

  res.set({
    'Content-Type': audioItem.contentType,
    'Content-Length': audioItem.buffer.length,
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=7200',
  });

  res.send(audioItem.buffer);
});

// Mount router on both '/api' and '/' to guarantee it responds regardless of Vercel rewrites
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Vercel Serverless Function entry point
export default app;
