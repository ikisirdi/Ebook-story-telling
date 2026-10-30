import { getSupabaseClient, isLocalModeOnly } from '../lib/supabase';
import { EbookData, ChapterData } from '../types';
import {
  getLocalBooksList,
  saveLocalEbook,
  loadLocalEbook,
  deleteLocalEbook,
} from './localBookStorage';

export interface SupabaseBookSummary {
  id: string;
  title: string;
  author: string;
  description: string;
  total_words: number;
  created_at: string;
  updated_at: string;
  duplicate_count?: number;
  is_local?: boolean;
}

export interface SupabaseHealthStatus {
  isConfigured: boolean;
  isOnline: boolean;
  isPausedOrDown: boolean;
  errorMessage?: string;
}

let lastHealthStatus: SupabaseHealthStatus = {
  isConfigured: false,
  isOnline: false,
  isPausedOrDown: false,
};

type HealthListener = (status: SupabaseHealthStatus) => void;
const healthListeners = new Set<HealthListener>();

export function onSupabaseHealthChange(listener: HealthListener) {
  healthListeners.add(listener);
  listener(lastHealthStatus);
  return () => {
    healthListeners.delete(listener);
  };
}

function updateHealthStatus(status: Partial<SupabaseHealthStatus>) {
  lastHealthStatus = { ...lastHealthStatus, ...status };
  healthListeners.forEach((fn) => {
    try {
      fn(lastHealthStatus);
    } catch {}
  });
}

export function getSupabaseHealthStatus(): SupabaseHealthStatus {
  return lastHealthStatus;
}

/**
 * Deduplicate books by title, keeping the latest updated version
 */
export function deduplicateBooksByTitle(books: SupabaseBookSummary[]): SupabaseBookSummary[] {
  const map = new Map<string, SupabaseBookSummary>();

  for (const book of books) {
    const normTitle = (book.title || 'Buku Narasi Elektronik').trim().toLowerCase();
    const existing = map.get(normTitle);

    if (!existing) {
      map.set(normTitle, { ...book, duplicate_count: 1 });
    } else {
      existing.duplicate_count = (existing.duplicate_count || 1) + 1;
      // Keep newer one if current book has newer timestamp
      const existingTime = new Date(existing.updated_at || existing.created_at || 0).getTime();
      const currentTime = new Date(book.updated_at || book.created_at || 0).getTime();
      if (currentTime > existingTime) {
        map.set(normTitle, { ...book, duplicate_count: existing.duplicate_count });
      }
    }
  }

  return Array.from(map.values());
}

/**
 * Helper to determine if an error is a network unreachable / Cloudflare 521 / paused project error
 */
function isNetworkDownError(err: any): boolean {
  if (!err) return false;
  const str = String(err.message || err.details || err || '').toLowerCase();
  return (
    str.includes('failed to fetch') ||
    str.includes('networkerror') ||
    str.includes('521') ||
    str.includes('522') ||
    str.includes('503') ||
    str.includes('paused') ||
    str.includes('connection refused') ||
    str.includes('cors')
  );
}

/**
 * Fetch list of saved books from Supabase with graceful fallback to local storage
 */
export async function fetchBooksList(deduplicate = true): Promise<SupabaseBookSummary[]> {
  const localBooks = getLocalBooksList().map((b) => ({ ...b, is_local: true }));

  if (isLocalModeOnly()) {
    updateHealthStatus({ isConfigured: false, isOnline: false, isPausedOrDown: false });
    return deduplicate ? deduplicateBooksByTitle(localBooks) : localBooks;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    updateHealthStatus({ isConfigured: false, isOnline: false, isPausedOrDown: false });
    return deduplicate ? deduplicateBooksByTitle(localBooks) : localBooks;
  }

  updateHealthStatus({ isConfigured: true });

  try {
    // Timeout promise to avoid freezing on hanging connections
    const fetchPromise = supabase
      .from('books')
      .select('id, title, author, description, total_words, created_at, updated_at')
      .order('updated_at', { ascending: false });

    const timeoutPromise = new Promise<{ data: null; error: any }>((_, reject) =>
      setTimeout(() => reject(new Error('Koneksi Supabase timeout setelah 6 detik.')), 6000)
    );

    const result = await Promise.race([fetchPromise, timeoutPromise]);
    const { data, error } = result;

    if (error) {
      if (isNetworkDownError(error)) {
        console.warn(
          '[Supabase] Server Supabase tidak dapat dijangkau (Proyek sedang dijeda / 521 / Offline). Menggunakan data penyimpanan lokal.'
        );
        updateHealthStatus({
          isOnline: false,
          isPausedOrDown: true,
          errorMessage: 'Server Supabase dijeda atau tidak merespon (521). Beralih ke penyimpanan lokal.',
        });
        return deduplicate ? deduplicateBooksByTitle(localBooks) : localBooks;
      }
      console.warn('[Supabase] Kesalahan saat membaca tabel books:', error.message || error);
      return deduplicate ? deduplicateBooksByTitle(localBooks) : localBooks;
    }

    updateHealthStatus({ isOnline: true, isPausedOrDown: false, errorMessage: undefined });
    const rawList = (data || []) as SupabaseBookSummary[];

    // Combine remote books and local books (prefer remote, but include unique local ones)
    const combined = [...rawList, ...localBooks];
    if (deduplicate) {
      return deduplicateBooksByTitle(combined);
    }
    return combined;
  } catch (err: any) {
    if (isNetworkDownError(err)) {
      console.warn(
        '[Supabase] Koneksi gagal (Server down / Proyek dijeda). Menggunakan penyimpanan lokal:',
        err.message || 'Failed to fetch'
      );
      updateHealthStatus({
        isOnline: false,
        isPausedOrDown: true,
        errorMessage: 'Server Supabase sedang offline / dijeda. Mode lokal aktif otomatis.',
      });
    } else {
      console.warn('[Supabase] Warning saat mengambil data buku:', err.message || err);
    }
    return deduplicate ? deduplicateBooksByTitle(localBooks) : localBooks;
  }
}

/**
 * Fetch only unique books by title (convenience wrapper)
 */
export async function fetchUniqueBooksList(): Promise<SupabaseBookSummary[]> {
  return fetchBooksList(true);
}

/**
 * Save an ebook to Supabase with automatic local storage backup
 */
export async function saveEbookToSupabase(
  ebook: EbookData,
  existingBookId?: string
): Promise<{ success: boolean; bookId?: string; isLocal?: boolean; error?: string; warning?: string }> {
  // Always save to browser local storage first so work is never lost!
  const localBookId = saveLocalEbook(ebook);

  if (isLocalModeOnly()) {
    return {
      success: true,
      bookId: localBookId,
      isLocal: true,
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      success: true,
      bookId: localBookId,
      isLocal: true,
      warning: 'Tersimpan di Penyimpanan Lokal (Supabase belum dikonfigurasi).',
    };
  }

  try {
    let bookId = existingBookId || ebook.id;
    const normTitle = (ebook.judul || 'Buku Narasi Elektronik').trim();

    // If no explicit ID provided, check if a book with the exact same title already exists
    if (!bookId && normTitle) {
      try {
        const { data: existingBooks } = await supabase
          .from('books')
          .select('id')
          .ilike('title', normTitle)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (existingBooks && existingBooks.length > 0) {
          bookId = existingBooks[0].id;
        }
      } catch {
        // ignore and proceed to insert
      }
    }

    if (bookId) {
      // Update existing book
      const { error: updateError } = await supabase
        .from('books')
        .update({
          title: normTitle,
          author: ebook.penulis || 'Penulis',
          description: ebook.deskripsi || '',
          language: ebook.bahasa || 'id-ID',
          total_words: ebook.total_kata,
          status: 'published',
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookId);

      if (updateError) throw updateError;
    } else {
      // Insert new book
      const { data: newBook, error: insertError } = await supabase
        .from('books')
        .insert({
          title: normTitle,
          author: ebook.penulis || 'Penulis',
          description: ebook.deskripsi || '',
          language: ebook.bahasa || 'id-ID',
          total_words: ebook.total_kata,
          status: 'draft',
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      bookId = newBook.id;
    }

    if (bookId) {
      // Sync chapters
      await supabase.from('chapters').delete().eq('book_id', bookId);

      if (ebook.bab && ebook.bab.length > 0) {
        const chapterRows = ebook.bab.map((ch, idx) => ({
          book_id: bookId,
          chapter_number: ch.nomor,
          part_number: 1,
          title: ch.judul_bab,
          summary: ch.ringkasan || '',
          content: ch.teks,
          word_count: ch.jumlah_kata,
          audio_url: ch.audio_url || null,
          audio_duration: ch.audio_duration || 0,
          audio_status: ch.audio_status || 'idle',
          sort_order: idx,
        }));

        const { error: chaptersError } = await supabase
          .from('chapters')
          .insert(chapterRows);

        if (chaptersError) throw chaptersError;
      }
    }

    updateHealthStatus({ isOnline: true, isPausedOrDown: false });
    return { success: true, bookId: bookId || localBookId };
  } catch (err: any) {
    if (isNetworkDownError(err)) {
      console.warn(
        '[Supabase] Tidak dapat menyimpan ke Cloud (Server down / dijeda). Buku telah diamankan di penyimpanan lokal:',
        err.message || 'Network down'
      );
      updateHealthStatus({
        isOnline: false,
        isPausedOrDown: true,
        errorMessage: 'Server Supabase sedang offline / dijeda. Buku tersimpan di penyimpanan lokal.',
      });
      return {
        success: true,
        bookId: localBookId,
        isLocal: true,
        warning: 'Buku berhasil disimpan di Penyimpanan Lokal (Server Supabase sedang offline/dijeda).',
      };
    }

    console.warn('Supabase save error:', err.message || err);
    return {
      success: true,
      bookId: localBookId,
      isLocal: true,
      warning: 'Buku disimpan di penyimpanan lokal.',
    };
  }
}

/**
 * Load complete Ebook with its chapters (checks remote and local)
 */
export async function loadEbookWithChapters(bookId: string): Promise<EbookData | null> {
  // Check local storage first
  const localBook = loadLocalEbook(bookId);

  if (isLocalModeOnly()) {
    return localBook;
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return localBook;
  }

  try {
    // Fetch book metadata
    const { data: book, error: bookError } = await supabase
      .from('books')
      .select('*')
      .eq('id', bookId)
      .single();

    if (bookError || !book) {
      return localBook;
    }

    // Fetch chapters
    const { data: chapters, error: chapError } = await supabase
      .from('chapters')
      .select('*')
      .eq('book_id', bookId)
      .order('sort_order', { ascending: true });

    if (chapError) {
      return localBook;
    }

    const formattedChapters: ChapterData[] = (chapters || []).map((ch: any) => ({
      id: ch.id,
      nomor: ch.chapter_number,
      judul_bab: ch.title,
      ringkasan: ch.summary || '',
      teks: ch.content,
      jumlah_kata: ch.word_count,
      audio_url: ch.audio_url || undefined,
      audio_duration: ch.audio_duration ? Number(ch.audio_duration) : undefined,
      audio_status: ch.audio_status || 'idle',
    }));

    const result: EbookData = {
      id: book.id,
      judul: book.title,
      penulis: book.author || 'Penulis',
      deskripsi: book.description || '',
      bahasa: book.language || 'id-ID',
      dibuat_pada: book.created_at,
      total_kata: book.total_words || formattedChapters.reduce((acc, c) => acc + c.jumlah_kata, 0),
      bab: formattedChapters,
    };

    // Cache locally
    saveLocalEbook(result);
    return result;
  } catch (err: any) {
    console.warn('[Supabase] Gagal memuat dari remote, menggunakan data lokal:', err.message || err);
    return localBook;
  }
}

/**
 * Delete a book and its cascade chapters from Supabase and local storage
 */
export async function deleteBookFromSupabase(bookId: string): Promise<boolean> {
  deleteLocalEbook(bookId);

  const supabase = getSupabaseClient();
  if (!supabase || isLocalModeOnly()) return true;

  try {
    await supabase.from('books').delete().eq('id', bookId);
  } catch (e) {
    console.warn('Gagal menghapus dari remote Supabase:', e);
  }
  return true;
}
