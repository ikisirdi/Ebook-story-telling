import { ChapterData } from '../types';

export interface SplitOptions {
  chapterNumber: number;
  chapterTitle?: string;
  mode: 'single' | 'parts_auto' | 'parts_2' | 'parts_3' | 'parts_4' | 'scene_break';
  targetWordsPerPart?: number;
}

/**
 * Splits a single chapter's text into one or more chapter/part segments cleanly at paragraph boundaries.
 */
export function splitChapterIntoParts(text: string, options: SplitOptions): ChapterData[] {
  const cleanText = text.trim();
  if (!cleanText) return [];

  const chapterNum = options.chapterNumber || 1;
  const rawTitle = options.chapterTitle?.trim() || '';

  // Mode 1: 1 Bab Utuh (Single Chapter)
  if (options.mode === 'single') {
    const words = cleanText.split(/\s+/).filter(Boolean).length;
    const title = rawTitle ? `Bab ${chapterNum}: ${rawTitle}` : `Bab ${chapterNum}`;
    const firstPara = cleanText.split(/\n+/)[0] || '';

    return [
      {
        id: `chap-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        nomor: chapterNum,
        judul_bab: title,
        ringkasan: firstPara.length > 150 ? firstPara.slice(0, 147) + '...' : firstPara,
        teks: cleanText,
        jumlah_kata: words,
        audio_status: 'idle',
      },
    ];
  }

  // Split by Scene Break (*** or ### or ---)
  if (options.mode === 'scene_break') {
    const sceneRegex = /\n\s*(?:\*\*\*|###|---|—{3,})\s*\n/;
    const rawScenes = cleanText.split(sceneRegex).map((s) => s.trim()).filter(Boolean);

    if (rawScenes.length > 1) {
      return rawScenes.map((sceneText, idx) => {
        const words = sceneText.split(/\s+/).filter(Boolean).length;
        const partTitle = rawTitle
          ? `Bab ${chapterNum} Part ${idx + 1}: ${rawTitle}`
          : `Bab ${chapterNum} Part ${idx + 1}`;
        const firstLine = sceneText.split(/\n+/)[0] || '';

        return {
          id: `chap-${Date.now()}-${idx + 1}-${Math.random().toString(36).substring(2, 7)}`,
          nomor: chapterNum + idx,
          judul_bab: partTitle,
          ringkasan: firstLine.length > 150 ? firstLine.slice(0, 147) + '...' : firstLine,
          teks: sceneText,
          jumlah_kata: words,
          audio_status: 'idle',
        };
      });
    }
  }

  // Split by Paragraphs
  const paragraphs = cleanText.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  if (paragraphs.length <= 1) {
    // Cannot split single paragraph, return as single chapter
    const words = cleanText.split(/\s+/).filter(Boolean).length;
    const title = rawTitle ? `Bab ${chapterNum}: ${rawTitle}` : `Bab ${chapterNum}`;
    return [
      {
        id: `chap-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        nomor: chapterNum,
        judul_bab: title,
        ringkasan: cleanText.slice(0, 150),
        teks: cleanText,
        jumlah_kata: words,
        audio_status: 'idle',
      },
    ];
  }

  let numParts = 2;
  if (options.mode === 'parts_2') numParts = 2;
  else if (options.mode === 'parts_3') numParts = 3;
  else if (options.mode === 'parts_4') numParts = 4;
  else if (options.mode === 'parts_auto') {
    const totalWords = cleanText.split(/\s+/).filter(Boolean).length;
    const targetWords = options.targetWordsPerPart || 700;
    numParts = Math.max(2, Math.min(8, Math.round(totalWords / targetWords)));
  }

  // Calculate word count per paragraph
  const paraWordCounts = paragraphs.map((p) => p.split(/\s+/).filter(Boolean).length);
  const totalWords = paraWordCounts.reduce((a, b) => a + b, 0);
  const targetWordsPerPart = Math.max(100, Math.round(totalWords / numParts));

  const parts: string[][] = [];
  let currentPart: string[] = [];
  let currentPartWords = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    const wordsInPara = paraWordCounts[i];

    currentPart.push(para);
    currentPartWords += wordsInPara;

    // Check if we should close this part
    const isNotLastPart = parts.length < numParts - 1;
    const hasEnoughWords = currentPartWords >= targetWordsPerPart;
    const hasRemainingParas = i < paragraphs.length - 1;

    if (isNotLastPart && hasEnoughWords && hasRemainingParas) {
      parts.push(currentPart);
      currentPart = [];
      currentPartWords = 0;
    }
  }

  if (currentPart.length > 0) {
    parts.push(currentPart);
  }

  return parts.map((partParas, idx) => {
    const partText = partParas.join('\n\n');
    const words = partText.split(/\s+/).filter(Boolean).length;
    const partTitle = rawTitle
      ? `Bab ${chapterNum} Part ${idx + 1}: ${rawTitle}`
      : `Bab ${chapterNum} Part ${idx + 1}`;
    const firstLine = partParas[0] || '';

    return {
      id: `chap-${Date.now()}-${idx + 1}-${Math.random().toString(36).substring(2, 7)}`,
      nomor: chapterNum + idx,
      judul_bab: partTitle,
      ringkasan: firstLine.length > 150 ? firstLine.slice(0, 147) + '...' : firstLine,
      teks: partText,
      jumlah_kata: words,
      audio_status: 'idle',
    };
  });
}
