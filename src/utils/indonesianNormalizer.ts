/**
 * Indonesian Text Normalizer for Natural Text-to-Speech (TTS)
 * Mengoptimalkan naskah bahasa Indonesia agar dibacakan mengalir alami,
 * artikulatif, dan tidak terbata-bata oleh model AI maupun Web Speech.
 */

// Peta konversi angka Romawi ke kata bahasa Indonesia untuk penomoran bab
const ROMAN_NUMERALS: Record<string, string> = {
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

// Singkatan bahasa Indonesia yang sering membuat TTS terbata-bata atau mengeja huruf per huruf
const ABBREVIATIONS: Array<[RegExp, string | ((...args: any[]) => string)]> = [
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
  [/\bRp\.?\s*([\d\.]+)/gi, (_match, p1) => `${p1.replace(/\./g, '')} rupiah`],
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

/**
 * Normalisasi teks Indonesia untuk narasi audio yang mulus dan alami
 */
export function normalizeIndonesianForSpeech(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return '';

  let text = rawText;

  // 1. Bersihkan karakter kontrol dan format Markdown
  text = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Hapus kode blok markdown ``` ... ```
    .replace(/```[\s\S]*?```/g, '')
    // Hapus header markdown (# Bab 1 -> Bab 1)
    .replace(/^#{1,6}\s+/gm, '')
    // Ubah format bold/italic (**teks** atau *teks*) menjadi teks biasa
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    // Hapus link markdown [label](url) -> label
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Hapus sitasi angka seperti [1], [2], [12] yang membuat TTS terbata
    .replace(/\[\d+\]/g, '')
    // Hapus tanda kutip blok >
    .replace(/^>\s*/gm, '')
    // Hapus garis pemisah horizontal --- atau ***
    .replace(/^[-*_]{3,}\s*$/gm, '')
    // Hapus bullet points
    .replace(/^[\s]*[-*+]\s+/gm, '');

  // 2. Normalisasi Bab dengan angka Romawi: "Bab IV" -> "Bab Empat"
  text = text.replace(
    /\b(Bab|BAB|Bagian|BAGIAN)\s+([IVXLCDM]+)\b/g,
    (_m, prefix, roman) => {
      const spelled = ROMAN_NUMERALS[roman.toUpperCase()];
      return spelled ? `${prefix} ${spelled}` : `${prefix} ${roman}`;
    }
  );

  // 3. Normalisasi tanda jeda yang menyebabkan intonasi tersendat
  // Ubah elipsis (...) yang membuat model TTS terhenti atau berbisik jadi koma atau titik rapi
  text = text.replace(/\.{3,}/g, ', ');
  // Ubah em-dash dan double dash dialog menjadi koma jeda alami
  text = text.replace(/\s*—\s*/g, ', ');
  text = text.replace(/\s*--\s*/g, ', ');
  text = text.replace(/\s*–\s*/g, ', ');

  // 4. Perluas singkatan umum bahasa Indonesia
  for (const [regex, replacement] of ABBREVIATIONS) {
    if (typeof replacement === 'function') {
      text = text.replace(regex, replacement as any);
    } else {
      text = text.replace(regex, replacement);
    }
  }

  // 5. Rapikan tanda baca ganda yang membingungkan ritme suara
  text = text
    .replace(/\?+/g, '?')
    .replace(/!+/g, '!')
    .replace(/,+/g, ',')
    .replace(/\s*,\s*/g, ', ')
    .replace(/\s*\.\s*/g, '. ')
    .replace(/\s*\?\s*/g, '? ')
    .replace(/\s*!\s*/g, '! ');

  // 6. Rapikan spasi berlebih antar kata dan antar paragraf
  text = text
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

/**
 * Membagi teks naskah panjang menjadi segmen-segmen narasi alami per paragraf.
 * Menghindari pemotongan di tengah kalimat agar intonasi tidak patah.
 */
export function splitIntoNaturalSpeechSegments(
  text: string,
  maxCharLength = 2200
): string[] {
  const normalized = normalizeIndonesianForSpeech(text);
  if (!normalized) return [];
  if (normalized.length <= maxCharLength) {
    return [normalized];
  }

  const paragraphs = normalized.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  const segments: string[] = [];
  let currentSegment = '';

  for (const para of paragraphs) {
    // Jika paragraf muat di segmen yang sedang dibangun
    if ((currentSegment + '\n\n' + para).trim().length <= maxCharLength) {
      currentSegment = (currentSegment ? currentSegment + '\n\n' : '') + para;
      continue;
    }

    // Jika segmen sudah ada isinya, simpan dulu
    if (currentSegment.length > 0) {
      segments.push(currentSegment.trim());
      currentSegment = '';
    }

    // Jika satu paragraf saja sudah melebihi batas, bagi berdasarkan kalimat utuh
    if (para.length > maxCharLength) {
      const sentenceRegex = /[^.!?]+[.!?]+(?:\s+|$)/g;
      const sentences = para.match(sentenceRegex) || [para];
      let sentenceBuffer = '';

      for (const sentence of sentences) {
        const sTrim = sentence.trim();
        if (!sTrim) continue;

        if ((sentenceBuffer + ' ' + sTrim).trim().length <= maxCharLength) {
          sentenceBuffer = (sentenceBuffer ? sentenceBuffer + ' ' : '') + sTrim;
        } else {
          if (sentenceBuffer.length > 0) {
            segments.push(sentenceBuffer.trim());
            sentenceBuffer = '';
          }
          if (sTrim.length <= maxCharLength) {
            sentenceBuffer = sTrim;
          } else {
            // Pemecahan darurat pada batas spasi jika 1 kalimat luar biasa panjang
            let remaining = sTrim;
            while (remaining.length > maxCharLength) {
              let cutIdx = remaining.lastIndexOf(' ', maxCharLength);
              if (cutIdx <= 0) cutIdx = maxCharLength;
              segments.push(remaining.slice(0, cutIdx).trim());
              remaining = remaining.slice(cutIdx).trim();
            }
            sentenceBuffer = remaining;
          }
        }
      }

      if (sentenceBuffer.trim().length > 0) {
        currentSegment = sentenceBuffer.trim();
      }
    } else {
      currentSegment = para;
    }
  }

  if (currentSegment.trim().length > 0) {
    segments.push(currentSegment.trim());
  }

  return segments;
}
