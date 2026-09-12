import express, { Request, Response, Router } from 'express';
import dotenv from 'dotenv';
import { GoogleGenAI, Modality, Type } from '@google/genai';
import { randomUUID } from 'crypto';

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

// Helper to split text into natural narration chunks for TTS
export function splitTextIntoTTSChunks(text: string, maxChunkLength = 850): string[] {
  const clean = text.trim();
  if (clean.length <= maxChunkLength) {
    return [clean];
  }

  // Split by paragraphs first
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

    // Paragraph is longer than maxChunkLength, split by sentences
    const sentenceRegex = /[^.!?\n]+(?:[.!?\n]+|$)/g;
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
          // Hard break on space if sentence is unusually long
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

// Router to handle endpoints both with and without '/api' prefix (for Vercel rewrites flexibility)
const apiRouter = Router();

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
    const { text, voice = 'Kore', apiKey: customKey } = body || {};
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Teks naskah untuk narasi suara masih kosong.' });
    }

    const cleanText = text.trim();
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

    // Split into natural narration chunks (up to 4 chunks = ~3400 characters, ~500-600 words)
    const textChunks = splitTextIntoTTSChunks(cleanText, 850);
    // Limit to max 4 chunks per HTTP request to avoid serverless timeout
    const chunksToProcess = textChunks.slice(0, 4);

    const pcmBuffers: Buffer[] = [];
    const silenceBuffer = Buffer.alloc(Math.floor(24000 * 2 * 0.25)); // 250ms silence between chunks

    for (let cIdx = 0; cIdx < chunksToProcess.length; cIdx++) {
      const chunk = chunksToProcess[cIdx];
      const narrationPrompt = `Bacakan naskah buku berikut dengan artikulasi jernih, tempo tenang, dan intonasi naratif yang alami dalam bahasa Indonesia:\n\n${chunk}`;

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
          pcmBuffers.push(silenceBuffer);
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
