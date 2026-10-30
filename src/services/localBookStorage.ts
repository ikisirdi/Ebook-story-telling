import { EbookData, ChapterData } from '../types';
import { SupabaseBookSummary } from './supabaseService';

const LOCAL_BOOKS_KEY = 'ai_ebook_local_books_index';
const LOCAL_EBOOK_PREFIX = 'ai_ebook_data_';

/**
 * Retrieve summary list of books saved in browser LocalStorage
 */
export function getLocalBooksList(): SupabaseBookSummary[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_BOOKS_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as SupabaseBookSummary[];
    return Array.isArray(list) ? list : [];
  } catch (e) {
    console.warn('Gagal membaca buku dari LocalStorage:', e);
    return [];
  }
}

/**
 * Save an ebook to browser LocalStorage as an offline-resilient backup
 */
export function saveLocalEbook(ebook: EbookData): string {
  if (typeof window === 'undefined') return ebook.id || 'local-book-1';

  try {
    const bookId = ebook.id || 'book_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    const updatedEbook: EbookData = {
      ...ebook,
      id: bookId,
    };

    // 1. Save full ebook with chapters
    localStorage.setItem(LOCAL_EBOOK_PREFIX + bookId, JSON.stringify(updatedEbook));

    // 2. Update index
    const currentList = getLocalBooksList();
    const existingIdx = currentList.findIndex(
      (b) => b.id === bookId || b.title.trim().toLowerCase() === (ebook.judul || '').trim().toLowerCase()
    );

    const summary: SupabaseBookSummary = {
      id: bookId,
      title: ebook.judul || 'Buku Narasi Elektronik',
      author: ebook.penulis || 'Penulis',
      description: ebook.deskripsi || '',
      total_words: ebook.total_kata || 0,
      created_at: ebook.dibuat_pada || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      duplicate_count: 1,
    };

    if (existingIdx >= 0) {
      currentList[existingIdx] = summary;
    } else {
      currentList.unshift(summary);
    }

    localStorage.setItem(LOCAL_BOOKS_KEY, JSON.stringify(currentList));
    return bookId;
  } catch (e) {
    console.warn('Gagal menyimpan ke LocalStorage:', e);
    return ebook.id || 'local-fallback';
  }
}

/**
 * Load complete Ebook with chapters from browser LocalStorage
 */
export function loadLocalEbook(bookId: string): EbookData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LOCAL_EBOOK_PREFIX + bookId);
    if (!raw) {
      // Try finding by title in index
      const list = getLocalBooksList();
      const match = list.find((b) => b.id === bookId);
      if (match) {
        const rawByMatch = localStorage.getItem(LOCAL_EBOOK_PREFIX + match.id);
        if (rawByMatch) return JSON.parse(rawByMatch);
      }
      return null;
    }
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Gagal memuat buku dari LocalStorage:', e);
    return null;
  }
}

/**
 * Delete a book from browser LocalStorage
 */
export function deleteLocalEbook(bookId: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.removeItem(LOCAL_EBOOK_PREFIX + bookId);
    const currentList = getLocalBooksList().filter((b) => b.id !== bookId);
    localStorage.setItem(LOCAL_BOOKS_KEY, JSON.stringify(currentList));
    return true;
  } catch (e) {
    console.warn('Gagal menghapus buku dari LocalStorage:', e);
    return false;
  }
}
