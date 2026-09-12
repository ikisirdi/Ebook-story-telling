-- ====================================================================
-- SUPABASE DATABASE SCHEMA: AI EBOOK & AUDIOBOOK GENERATOR
-- Digunakan untuk menyimpan Buku, Bab / Part Naskah, dan Audio Narasi
-- ====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABEL: books (Daftar Buku Elektronik)
CREATE TABLE IF NOT EXISTS public.books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Opsional, jika menggunakan Supabase Auth
    title TEXT NOT NULL,
    author TEXT DEFAULT 'Penulis',
    description TEXT,
    language VARCHAR(10) DEFAULT 'id-ID',
    total_words INTEGER DEFAULT 0,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    cover_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pencarian buku
CREATE INDEX IF NOT EXISTS idx_books_user_id ON public.books(user_id);
CREATE INDEX IF NOT EXISTS idx_books_created_at ON public.books(created_at DESC);

-- 3. TABEL: chapters (Daftar Bab & Bagian / Part dari Buku)
CREATE TABLE IF NOT EXISTS public.chapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    chapter_number INTEGER NOT NULL, -- Nomor Bab (Bab 1, Bab 2, dst.)
    part_number INTEGER NOT NULL DEFAULT 1, -- Nomor Bagian (Part 1, Part 2, dst.)
    title TEXT NOT NULL, -- Judul bab atau judul part
    summary TEXT, -- Ringkasan singkat
    content TEXT NOT NULL, -- Teks naskah lengkap
    word_count INTEGER NOT NULL DEFAULT 0,
    audio_url TEXT, -- URL file audio (Supabase Storage / Data URL / Web Speech)
    audio_storage_path TEXT, -- Path di bucket Supabase Storage
    audio_duration NUMERIC(10, 2) DEFAULT 0, -- Durasi dalam detik
    audio_status VARCHAR(30) DEFAULT 'idle' CHECK (audio_status IN ('idle', 'generating', 'ready', 'error', 'browser_fallback')),
    audio_voice VARCHAR(50) DEFAULT 'Kore',
    audio_error TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index relasi bab ke buku
CREATE INDEX IF NOT EXISTS idx_chapters_book_id ON public.chapters(book_id);
CREATE INDEX IF NOT EXISTS idx_chapters_sort_order ON public.chapters(book_id, sort_order ASC);

-- 4. FUNCTION & TRIGGER: Auto update timestamp updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_books_updated_at ON public.books;
CREATE TRIGGER trg_books_updated_at
    BEFORE UPDATE ON public.books
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_chapters_updated_at ON public.chapters;
CREATE TRIGGER trg_chapters_updated_at
    BEFORE UPDATE ON public.chapters
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 5. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

-- Kebijakan Akses:
-- Untuk kemudahan awal & prototype (akses anonim):
CREATE POLICY "Public read books" ON public.books
    FOR SELECT USING (true);

CREATE POLICY "Public insert books" ON public.books
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update books" ON public.books
    FOR UPDATE USING (true);

CREATE POLICY "Public delete books" ON public.books
    FOR DELETE USING (true);

CREATE POLICY "Public read chapters" ON public.chapters
    FOR SELECT USING (true);

CREATE POLICY "Public insert chapters" ON public.chapters
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Public update chapters" ON public.chapters
    FOR UPDATE USING (true);

CREATE POLICY "Public delete chapters" ON public.chapters
    FOR DELETE USING (true);

-- 6. STORAGE BUCKET UNTUK AUDIO (Jalankan di Supabase Storage Menu)
-- Buat bucket baru dengan nama: 'audio-narrations' (Public bucket)
-- Atau jalankan script SQL storage berikut jika role postgres diizinkan:
INSERT INTO storage.buckets (id, name, public)
VALUES ('audio-narrations', 'audio-narrations', true)
ON CONFLICT (id) DO NOTHING;

-- Policy Storage untuk audio-narrations
CREATE POLICY "Public Access Audio Narrations"
ON storage.objects FOR SELECT
USING (bucket_id = 'audio-narrations');

CREATE POLICY "Public Upload Audio Narrations"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'audio-narrations');
