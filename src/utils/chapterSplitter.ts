import { ChapterData } from '../types';

export interface SplitOptions {
  chapterNumber: number;
  chapterTitle?: string;
  mode:
    | 'single'
    | 'parts_auto'
    | 'parts_short'
    | 'parts_medium'
    | 'parts_2'
    | 'parts_3'
    | 'parts_4'
    | 'scene_break';
  targetWordsPerPart?: number;
}

/**
 * Splits a single existing chapter into multiple audio-ready parts (e.g. Bab 1 Part 1, Part 2...)
 */
export function splitSingleChapterIntoAudioParts(
  chapter: ChapterData,
  targetWordsPerPart = 350
): ChapterData[] {
  const cleanText = chapter.teks.trim();
  if (!cleanText) return [chapter];

  const words = cleanText.split(/\s+/).filter(Boolean).length;
  // If chapter is already short enough for a single audio track, keep it as is
  if (words <= targetWordsPerPart * 1.3) {
    return [chapter];
  }

  const baseTitle = chapter.judul_bab.replace(/\s*-\s*Part\s*\d+/gi, '').trim();
  const paragraphs = cleanText.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  if (paragraphs.length <= 1) {
    // If single large paragraph, split by sentence groups
    const sentenceRegex = /[^.!?\n]+(?:[.!?\n]+|$)/g;
    const sentences = cleanText.match(sentenceRegex) || [cleanText];
    const targetCount = Math.max(2, Math.ceil(words / targetWordsPerPart));
    const sentPerPart = Math.ceil(sentences.length / targetCount);

    const result: ChapterData[] = [];
    for (let i = 0; i < targetCount; i++) {
      const partSentences = sentences.slice(i * sentPerPart, (i + 1) * sentPerPart);
      const partText = partSentences.join(' ').trim();
      if (!partText) continue;
      const partWords = partText.split(/\s+/).filter(Boolean).length;
      result.push({
        id: `chap-${Date.now()}-${i + 1}-${Math.random().toString(36).substring(2, 7)}`,
        nomor: chapter.nomor + i,
        judul_bab: `${baseTitle} - Part ${i + 1}`,
        ringkasan: partText.slice(0, 140) + '...',
        teks: partText,
        jumlah_kata: partWords,
        audio_status: 'idle',
      });
    }
    return result.length > 0 ? result : [chapter];
  }

  const numParts = Math.max(2, Math.round(words / targetWordsPerPart));
  const paraWordCounts = paragraphs.map((p) => p.split(/\s+/).filter(Boolean).length);
  const targetWords = Math.max(120, Math.round(words / numParts));

  const parts: string[][] = [];
  let currentPart: string[] = [];
  let currentPartWords = 0;

  for (let i = 0; i < paragraphs.length; i++) {
    const para = paragraphs[i];
    const wordsInPara = paraWordCounts[i];

    currentPart.push(para);
    currentPartWords += wordsInPara;

    const isNotLastPart = parts.length < numParts - 1;
    const hasEnoughWords = currentPartWords >= targetWords;
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
    const partWords = partText.split(/\s+/).filter(Boolean).length;
    const firstLine = partParas[0] || '';

    return {
      id: `chap-${Date.now()}-${idx + 1}-${Math.random().toString(36).substring(2, 7)}`,
      nomor: chapter.nomor + idx,
      judul_bab: `${baseTitle} - Part ${idx + 1}`,
      ringkasan: firstLine.length > 140 ? firstLine.slice(0, 137) + '...' : firstLine,
      teks: partText,
      jumlah_kata: partWords,
      audio_status: 'idle',
    };
  });
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
  const totalWords = cleanText.split(/\s+/).filter(Boolean).length;

  if (options.mode === 'parts_2') numParts = 2;
  else if (options.mode === 'parts_3') numParts = 3;
  else if (options.mode === 'parts_4') numParts = 4;
  else if (options.mode === 'parts_short') {
    // Target ~250 words per part (audio ~1.5 mins)
    numParts = Math.max(2, Math.min(25, Math.round(totalWords / 250)));
  } else if (options.mode === 'parts_medium') {
    // Target ~450 words per part (audio ~3 mins)
    numParts = Math.max(2, Math.min(20, Math.round(totalWords / 450)));
  } else if (options.mode === 'parts_auto') {
    // Target ~350 words per part (optimal audio narration ~2-2.5 mins)
    const targetWords = options.targetWordsPerPart || 350;
    numParts = Math.max(2, Math.min(20, Math.round(totalWords / targetWords)));
  }

  // Calculate word count per paragraph
  const paraWordCounts = paragraphs.map((p) => p.split(/\s+/).filter(Boolean).length);
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
