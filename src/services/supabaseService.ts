import { getSupabaseClient } from '../lib/supabase';
import { EbookData, ChapterData } from '../types';

export interface SupabaseBookSummary {
  id: string;
  title: string;
  author: string;
  description: string;
  total_words: number;
  created_at: string;
  updated_at: string;
}

/**
 * Save or update an entire E-Book and its chapters to Supabase
 */
export async function saveEbookToSupabase(
  ebook: EbookData,
  existingBookId?: string
): Promise<{ success: boolean; bookId?: string; error?: string }> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      success: false,
      error: 'Kredensial Supabase belum dikonfigurasi. Silakan atur URL dan Anon Key di menu Supabase.',
    };
  }

  try {
    let bookId = existingBookId;

    if (bookId) {
      // Update existing book
      const { error: updateError } = await supabase
        .from('books')
        .update({
          title: ebook.judul || 'Buku Narasi Elektronik',
          author: ebook.penulis || 'Penulis',
          description: ebook.deskripsi || '',
          language: ebook.bahasa || 'id-ID',
          total_words: ebook.total_kata,
          status: 'published',
        })
        .eq('id', bookId);

      if (updateError) throw updateError;
    } else {
      // Insert new book
      const { data: newBook, error: insertError } = await supabase
        .from('books')
        .insert({
          title: ebook.judul || 'Buku Narasi Elektronik',
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

    if (!bookId) {
      throw new Error('Gagal mendapatkan ID buku dari Supabase.');
    }

    // Delete existing chapters for this book to ensure clean sync
    await supabase.from('chapters').delete().eq('book_id', bookId);

    // Insert all chapters
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

    return { success: true, bookId };
  } catch (err: any) {
    console.error('Supabase save error:', err);
    return {
      success: false,
      error: err.message || 'Gagal menyimpan buku ke database Supabase.',
    };
  }
}

/**
 * Fetch list of all saved books from Supabase
 */
export async function fetchBooksList(): Promise<SupabaseBookSummary[]> {
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('books')
    .select('id, title, author, description, total_words, created_at, updated_at')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error fetching books from Supabase:', error);
    throw error;
  }

  return (data || []) as SupabaseBookSummary[];
}

/**
 * Load complete Ebook with its chapters from Supabase
 */
export async function loadEbookWithChapters(bookId: string): Promise<EbookData | null> {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  // Fetch book metadata
  const { data: book, error: bookError } = await supabase
    .from('books')
    .select('*')
    .eq('id', bookId)
    .single();

  if (bookError || !book) {
    console.error('Error fetching book:', bookError);
    return null;
  }

  // Fetch chapters
  const { data: chapters, error: chapError } = await supabase
    .from('chapters')
    .select('*')
    .eq('book_id', bookId)
    .order('sort_order', { ascending: true });

  if (chapError) {
    console.error('Error fetching chapters:', chapError);
    return null;
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

  return {
    judul: book.title,
    penulis: book.author || 'Penulis',
    deskripsi: book.description || '',
    bahasa: book.language || 'id-ID',
    dibuat_pada: book.created_at,
    total_kata: book.total_words || formattedChapters.reduce((acc, c) => acc + c.jumlah_kata, 0),
    bab: formattedChapters,
  };
}

/**
 * Delete a book and its cascade chapters from Supabase
 */
export async function deleteBookFromSupabase(bookId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase.from('books').delete().eq('id', bookId);
  if (error) {
    console.error('Error deleting book:', error);
    return false;
  }
  return true;
}
