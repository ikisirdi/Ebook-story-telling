export interface TranslationOptions {
  text: string;
  title?: string;
  style?: 'sastra' | 'alami' | 'santai';
  onProgress?: (progressText: string) => void;
}

export interface TranslationResult {
  success: boolean;
  translatedText: string;
  translatedTitle?: string;
  detectedSourceLanguage?: string;
  styleNotes?: string;
  originalWordCount: number;
  translatedWordCount: number;
}

/**
 * Heuristic check to see if text is likely in a foreign language (e.g. English)
 * and could benefit from Indonesian translation.
 */
export function detectLikelyForeignLanguage(text: string): {
  isLikelyForeign: boolean;
  languageHint: string;
} {
  if (!text || text.trim().length < 40) {
    return { isLikelyForeign: false, languageHint: '' };
  }

  const sample = text.slice(0, 1500).toLowerCase();

  // Common Indonesian marker words
  const indonesianWords = [
    'yang', 'dan', 'di', 'ke', 'dari', 'ini', 'itu', 'dengan', 'untuk',
    'pada', 'adalah', 'mereka', 'dia', 'sudah', 'tidak', 'akan', 'bisa',
    'saat', 'ketika', 'setelah', 'lalu', 'hanya', 'tetapi', 'karena'
  ];

  // Common English marker words
  const englishWords = [
    'the', 'and', 'to', 'of', 'a', 'in', 'that', 'have', 'i', 'it',
    'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this',
    'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she', 'or',
    'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what'
  ];

  const words = sample.split(/[^a-zA-Z0-9áéíóúñç]+/).filter(Boolean);
  let idMatches = 0;
  let enMatches = 0;

  for (const w of words) {
    if (indonesianWords.includes(w)) idMatches++;
    if (englishWords.includes(w)) enMatches++;
  }

  // Check for CJK characters (Chinese, Japanese, Korean)
  if (/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff66-\uff9f]/.test(sample)) {
    return { isLikelyForeign: true, languageHint: 'Jepang/Mandarin' };
  }

  if (enMatches > idMatches * 2 && enMatches >= 4) {
    return { isLikelyForeign: true, languageHint: 'Inggris' };
  }

  return { isLikelyForeign: false, languageHint: 'Indonesia' };
}

/**
 * Translates a text (story or chapter) into fluent, literary Indonesian using Gemini.
 * Chunks long texts safely if needed.
 */
export async function translateStoryToIndonesian(
  options: TranslationOptions
): Promise<TranslationResult> {
  const { text, title, style = 'sastra', onProgress } = options;

  if (!text || !text.trim()) {
    throw new Error('Teks naskah masih kosong.');
  }

  const cleanText = text.trim();
  const maxChunkChars = 35000; // Safe threshold for single prompt

  // If text is within normal bounds, single request
  if (cleanText.length <= maxChunkChars) {
    onProgress?.('Menerjemahkan dengan sastrawan AI Gemini...');
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: cleanText,
        title,
        style,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Gagal menerjemahkan (Status: ${response.status})`);
    }

    const data = await response.json();
    return data as TranslationResult;
  }

  // Large story: Split by paragraphs and translate chunks sequentially
  const paragraphs = cleanText.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const p of paragraphs) {
    if ((currentChunk + '\n\n' + p).length <= maxChunkChars) {
      currentChunk = currentChunk ? `${currentChunk}\n\n${p}` : p;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = p;
    }
  }
  if (currentChunk) chunks.push(currentChunk);

  const translatedChunks: string[] = [];
  let translatedTitle = title;
  let detectedLang = 'Otomatis';

  for (let i = 0; i < chunks.length; i++) {
    onProgress?.(`Menerjemahkan bagian ${i + 1} dari ${chunks.length}...`);
    const isFirst = i === 0;

    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: chunks[i],
        title: isFirst ? title : undefined,
        style,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Gagal menerjemahkan bagian ${i + 1}`);
    }

    const data = await response.json();
    translatedChunks.push(data.translatedText);
    if (isFirst && data.translatedTitle) {
      translatedTitle = data.translatedTitle;
    }
    if (data.detectedSourceLanguage) {
      detectedLang = data.detectedSourceLanguage;
    }
  }

  const finalTranslated = translatedChunks.join('\n\n');
  return {
    success: true,
    translatedText: finalTranslated,
    translatedTitle,
    detectedSourceLanguage: detectedLang,
    originalWordCount: cleanText.split(/\s+/).filter(Boolean).length,
    translatedWordCount: finalTranslated.split(/\s+/).filter(Boolean).length,
  };
}
