import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  Cloud,
  CheckCircle2,
  Copy,
  Check,
  Server,
  Save,
  FolderOpen,
  Trash2,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Table2,
  Layers,
  FileCode,
} from 'lucide-react';
import { EbookData } from '../types';
import {
  getSupabaseCredentials,
  saveSupabaseCredentials,
  isSupabaseConfigured,
  getSupabaseClient,
} from '../lib/supabase';
import {
  saveEbookToSupabase,
  fetchBooksList,
  loadEbookWithChapters,
  deleteBookFromSupabase,
  SupabaseBookSummary,
} from '../services/supabaseService';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  ebook: EbookData;
  onLoadEbook: (loaded: EbookData) => void;
}

const SQL_SCHEMA_CONTENT = `-- Jalankan query ini di SQL Editor di dashboard Supabase (supabase.com)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABEL BUKU (books)
CREATE TABLE IF NOT EXISTS public.books (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
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

-- 2. TABEL BAB & BAGIAN (chapters)
CREATE TABLE IF NOT EXISTS public.chapters (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
    chapter_number INTEGER NOT NULL,
    part_number INTEGER NOT NULL DEFAULT 1,
    title TEXT NOT NULL,
    summary TEXT,
    content TEXT NOT NULL,
    word_count INTEGER NOT NULL DEFAULT 0,
    audio_url TEXT,
    audio_storage_path TEXT,
    audio_duration NUMERIC(10, 2) DEFAULT 0,
    audio_status VARCHAR(30) DEFAULT 'idle',
    audio_voice VARCHAR(50) DEFAULT 'Kore',
    audio_error TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index Relasi
CREATE INDEX IF NOT EXISTS idx_chapters_book_id ON public.chapters(book_id);
CREATE INDEX IF NOT EXISTS idx_chapters_sort_order ON public.chapters(book_id, sort_order ASC);

-- 3. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read books" ON public.books FOR SELECT USING (true);
CREATE POLICY "Public insert books" ON public.books FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update books" ON public.books FOR UPDATE USING (true);
CREATE POLICY "Public delete books" ON public.books FOR DELETE USING (true);

CREATE POLICY "Public read chapters" ON public.chapters FOR SELECT USING (true);
CREATE POLICY "Public insert chapters" ON public.chapters FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update chapters" ON public.chapters FOR UPDATE USING (true);
CREATE POLICY "Public delete chapters" ON public.chapters FOR DELETE USING (true);`;

export const SupabaseModal: React.FC<SupabaseModalProps> = ({
  isOpen,
  onClose,
  ebook,
  onLoadEbook,
}) => {
  const [activeTab, setActiveTab] = useState<'tables' | 'connect' | 'vercel'>('tables');
  const [supabaseUrl, setSupabaseUrl] = useState<string>('');
  const [supabaseKey, setSupabaseKey] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [savedBooks, setSavedBooks] = useState<SupabaseBookSummary[]>([]);
  const [showAllVersions, setShowAllVersions] = useState<boolean>(false);
  const [isLoadingBooks, setIsLoadingBooks] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const creds = getSupabaseCredentials();
      setSupabaseUrl(creds.url);
      setSupabaseKey(creds.key);
      if (isSupabaseConfigured()) {
        loadBooks(showAllVersions);
      }
    }
  }, [isOpen]);

  const loadBooks = async (all = showAllVersions) => {
    setIsLoadingBooks(true);
    setStatusMessage(null);
    try {
      // deduplicate if all is false
      const books = await fetchBooksList(!all);
      setSavedBooks(books);
    } catch (err: any) {
      console.error(err);
      setStatusMessage({
        type: 'error',
        text: 'Gagal memuat daftar buku dari Supabase: ' + (err.message || 'Periksa tabel dan URL/Key Anda.'),
      });
    } finally {
      setIsLoadingBooks(false);
    }
  };

  const handleSaveCredentials = () => {
    saveSupabaseCredentials(supabaseUrl, supabaseKey);
    setStatusMessage({
      type: 'success',
      text: 'Kredensial Supabase berhasil disimpan! Mencoba menghubungkan...',
    });
    setTimeout(() => {
      loadBooks();
    }, 500);
  };

  const handleSaveCurrentBook = async () => {
    if (!ebook.bab || ebook.bab.length === 0) {
      alert('Belum ada bab untuk disimpan. Tambahkan bab terlebih dahulu.');
      return;
    }
    setIsSaving(true);
    setStatusMessage(null);
    try {
      const res = await saveEbookToSupabase(ebook, ebook.id);
      if (res.success) {
        if (res.bookId) {
          ebook.id = res.bookId;
        }
        setStatusMessage({
          type: 'success',
          text: `Buku "${ebook.judul || 'Tanpa Judul'}" (${ebook.bab.length} bab) berhasil disimpan ke Supabase!`,
        });
        loadBooks();
      } else {
        throw new Error(res.error || 'Gagal menyimpan buku');
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: err.message || 'Gagal menyimpan ke database Supabase.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectBook = async (bookId: string) => {
    try {
      setIsLoadingBooks(true);
      const loaded = await loadEbookWithChapters(bookId);
      if (loaded) {
        onLoadEbook(loaded);
        onClose();
      } else {
        alert('Data buku tidak ditemukan di database.');
      }
    } catch (err: any) {
      alert('Gagal memuat buku: ' + err.message);
    } finally {
      setIsLoadingBooks(false);
    }
  };

  const handleDeleteBook = async (bookId: string, title: string) => {
    if (!confirm(`Hapus buku "${title}" dari Supabase secara permanen?`)) return;
    try {
      await deleteBookFromSupabase(bookId);
      setSavedBooks((prev) => prev.filter((b) => b.id !== bookId));
      setStatusMessage({
        type: 'success',
        text: `Buku "${title}" berhasil dihapus.`,
      });
    } catch (err: any) {
      alert('Gagal menghapus buku: ' + err.message);
    }
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SQL_SCHEMA_CONTENT);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between bg-neutral-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-neutral-900">
                Integrasi Supabase & Vercel
              </h3>
              <p className="text-xs text-neutral-500">
                Struktur tabel database, penyimpanan naskah, dan arsitektur deployment serverless
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 pt-3 border-b border-neutral-200 flex gap-2">
          <button
            onClick={() => setActiveTab('tables')}
            className={`pb-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'tables'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <Table2 className="w-4 h-4" />
            <span>1. Struktur Tabel Supabase</span>
          </button>

          <button
            onClick={() => setActiveTab('connect')}
            className={`pb-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'connect'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <Cloud className="w-4 h-4" />
            <span>2. Hubungkan & Simpan Data</span>
            {isSupabaseConfigured() && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" title="Terkoneksi" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('vercel')}
            className={`pb-3 px-3 text-xs sm:text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'vercel'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>3. Konfigurasi Vercel</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'tables' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                  <span>Tabel yang Diperlukan di Supabase (PostgreSQL)</span>
                </h4>
                <p className="text-xs text-neutral-600 mt-1">
                  Untuk sistem E-book Audio multi-bab, Anda memerlukan 2 tabel utama relasional dan 1 Storage Bucket:
                </p>
              </div>

              {/* Table Schema Visual Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Table 1: books */}
                <div className="border border-neutral-200 rounded-xl p-4 bg-white shadow-2xs">
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-neutral-100">
                    <span className="font-mono text-xs font-bold text-emerald-700 px-2 py-0.5 bg-emerald-50 rounded">
                      public.books
                    </span>
                    <span className="text-[11px] text-neutral-400 font-medium">Tabel Induk Buku</span>
                  </div>
                  <ul className="text-xs space-y-1.5 font-mono text-neutral-700">
                    <li><strong className="text-neutral-900">id</strong>: UUID (Primary Key)</li>
                    <li><strong className="text-neutral-900">user_id</strong>: UUID (Relasi Akun Auth)</li>
                    <li><strong className="text-neutral-900">title</strong>: TEXT (Judul Buku)</li>
                    <li><strong className="text-neutral-900">author</strong>: TEXT (Nama Penulis)</li>
                    <li><strong className="text-neutral-900">description</strong>: TEXT (Sinopsis Ringkas)</li>
                    <li><strong className="text-neutral-900">language</strong>: VARCHAR (Default 'id-ID')</li>
                    <li><strong className="text-neutral-900">total_words</strong>: INTEGER (Total Kata)</li>
                    <li><strong className="text-neutral-900">status</strong>: draft | published</li>
                    <li><strong className="text-neutral-900">created_at, updated_at</strong>: TIMESTAMPTZ</li>
                  </ul>
                </div>

                {/* Table 2: chapters */}
                <div className="border border-neutral-200 rounded-xl p-4 bg-white shadow-2xs">
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-neutral-100">
                    <span className="font-mono text-xs font-bold text-emerald-700 px-2 py-0.5 bg-emerald-50 rounded">
                      public.chapters
                    </span>
                    <span className="text-[11px] text-neutral-400 font-medium">Tabel Bab & Bagian</span>
                  </div>
                  <ul className="text-xs space-y-1.5 font-mono text-neutral-700">
                    <li><strong className="text-neutral-900">id</strong>: UUID (Primary Key)</li>
                    <li><strong className="text-neutral-900">book_id</strong>: UUID (Foreign Key ke books.id)</li>
                    <li><strong className="text-neutral-900">chapter_number</strong>: INTEGER (Bab 1, 2, ...)</li>
                    <li><strong className="text-neutral-900">part_number</strong>: INTEGER (Part 1, 2, ...)</li>
                    <li><strong className="text-neutral-900">title</strong>: TEXT (Judul Bab / Bagian)</li>
                    <li><strong className="text-neutral-900">content</strong>: TEXT (Naskah lengkap)</li>
                    <li><strong className="text-neutral-900">audio_url</strong>: TEXT (URL Audio Narasi)</li>
                    <li><strong className="text-neutral-900">audio_status</strong>: idle | ready | error</li>
                    <li><strong className="text-neutral-900">sort_order</strong>: INTEGER (Urutan Bab)</li>
                  </ul>
                </div>
              </div>

              {/* Storage Bucket Note */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-amber-700" />
                  <span>Supabase Storage Bucket: audio-narrations</span>
                </div>
                <p className="text-amber-800">
                  Untuk menyimpan file rekaman suara narasi secara permanen tanpa terhapus saat instance serverless restart di Vercel, buat bucket bernama <code>audio-narrations</code> dengan mode Public di dashboard Supabase &gt; Storage.
                </p>
              </div>

              {/* SQL Code block */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-neutral-700 flex items-center gap-1.5">
                    <FileCode className="w-4 h-4 text-neutral-500" />
                    <span>Script SQL Siap Jalankan (Supabase SQL Editor):</span>
                  </span>
                  <button
                    onClick={handleCopySql}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-neutral-900 text-white hover:bg-neutral-800 transition-colors shadow-2xs"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin Script SQL</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-neutral-900 text-neutral-200 p-4 rounded-xl text-[11px] font-mono overflow-x-auto max-h-56 leading-relaxed border border-neutral-800">
                  {SQL_SCHEMA_CONTENT}
                </pre>
                <p className="text-[11px] text-neutral-500">
                  *Script ini juga tersimpan di file <code>/supabase/schema.sql</code> di proyek Anda.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'connect' && (
            <div className="space-y-6">
              {/* Credentials Form */}
              <div className="border border-neutral-200 rounded-xl p-5 bg-white space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-neutral-900">
                    Kredensial Supabase Project
                  </h4>
                  <a
                    href="https://supabase.com/dashboard"
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-emerald-700 hover:underline inline-flex items-center gap-1"
                  >
                    <span>Buka Supabase Dashboard</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Project URL (VITE_SUPABASE_URL)
                    </label>
                    <input
                      type="text"
                      placeholder="https://xyzcompany.supabase.co"
                      value={supabaseUrl}
                      onChange={(e) => setSupabaseUrl(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-neutral-700 mb-1">
                      Anon Public Key (VITE_SUPABASE_ANON_KEY)
                    </label>
                    <input
                      type="password"
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6Ik..."
                      value={supabaseKey}
                      onChange={(e) => setSupabaseKey(e.target.value)}
                      className="w-full text-xs px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-neutral-500">
                    {isSupabaseConfigured() ? (
                      <span className="text-emerald-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Kredensial aktif di aplikasi
                      </span>
                    ) : (
                      'Kredensial dapat dimasukkan di sini atau via file .env'
                    )}
                  </span>
                  <button
                    onClick={handleSaveCredentials}
                    className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-xs transition-colors"
                  >
                    Simpan & Hubungkan
                  </button>
                </div>
              </div>

              {/* Status Banner */}
              {statusMessage && (
                <div
                  className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                    statusMessage.type === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-red-50 text-red-800 border border-red-200'
                  }`}
                >
                  {statusMessage.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  <span>{statusMessage.text}</span>
                </div>
              )}

              {/* Action: Save Current Book */}
              <div className="border border-neutral-200 rounded-xl p-5 bg-neutral-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-neutral-900">
                    Simpan Naskah Buku Saat Ini ke Database
                  </h4>
                  <p className="text-xs text-neutral-600 mt-0.5">
                    Judul: <strong>{ebook.judul || 'Buku Baru'}</strong> ({ebook.bab.length} bab, {ebook.total_kata} kata)
                  </p>
                </div>
                <button
                  onClick={handleSaveCurrentBook}
                  disabled={isSaving || ebook.bab.length === 0}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0"
                >
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Menyimpan ke Supabase...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Simpan Buku ke Supabase</span>
                    </>
                  )}
                </button>
              </div>

              {/* Saved Books Listing */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-600">
                      {showAllVersions
                        ? `Semua Baris di Database (${savedBooks.length})`
                        : `Daftar Judul Buku Tersimpan (${savedBooks.length})`}
                    </h4>
                    <p className="text-[11px] text-neutral-400">
                      {showAllVersions
                        ? 'Menampilkan seluruh baris riwayat data di tabel books secara terperinci'
                        : 'Hanya menampilkan 1 versi terbaru untuk setiap judul buku yang sama'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const next = !showAllVersions;
                        setShowAllVersions(next);
                        loadBooks(next);
                      }}
                      className="text-xs px-2.5 py-1 rounded-lg border border-neutral-200 hover:bg-neutral-50 text-neutral-600 font-medium transition-colors cursor-pointer"
                    >
                      {showAllVersions ? 'Gabungkan Judul Sama' : 'Lihat Semua Baris'}
                    </button>
                    <button
                      onClick={() => loadBooks(showAllVersions)}
                      disabled={isLoadingBooks || !isSupabaseConfigured()}
                      className="text-xs text-neutral-500 hover:text-neutral-900 inline-flex items-center gap-1 cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingBooks ? 'animate-spin' : ''}`} />
                      <span>Muat Ulang</span>
                    </button>
                  </div>
                </div>

                {!isSupabaseConfigured() ? (
                  <div className="p-6 text-center border border-dashed border-neutral-300 rounded-xl text-xs text-neutral-500">
                    Masukkan URL dan Anon Key di atas terlebih dahulu untuk melihat dan mengelola buku di Supabase.
                  </div>
                ) : savedBooks.length === 0 ? (
                  <div className="p-6 text-center border border-neutral-200 rounded-xl text-xs text-neutral-500">
                    Belum ada buku yang tersimpan di tabel <code>books</code>. Klik tombol "Simpan Buku ke Supabase" di atas untuk menyimpan naskah Anda.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {savedBooks.map((b) => (
                      <div
                        key={b.id}
                        className="p-3.5 bg-white border border-neutral-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs hover:border-neutral-300 transition-colors"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h5 className="text-xs sm:text-sm font-bold text-neutral-900 truncate">
                              {b.title}
                            </h5>
                            {!showAllVersions && b.duplicate_count && b.duplicate_count > 1 && (
                              <span className="text-[10px] bg-neutral-100 text-neutral-600 px-1.5 py-0.5 rounded font-medium shrink-0">
                                Versi Terbaru
                              </span>
                            )}
                            {showAllVersions && (
                              <span className="text-[10px] font-mono bg-neutral-100 text-neutral-500 px-1.5 py-0.2 rounded shrink-0 truncate max-w-[120px]">
                                ID: {b.id.slice(0, 8)}...
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-neutral-500 mt-0.5">
                            {b.author} • {b.total_words} kata • Tersimpan {new Date(b.updated_at || b.created_at).toLocaleString('id-ID')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleSelectBook(b.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 transition-colors cursor-pointer"
                          >
                            <FolderOpen className="w-3.5 h-3.5" />
                            <span>Buka Buku</span>
                          </button>
                          <button
                            onClick={() => handleDeleteBook(b.id, b.title)}
                            className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus Buku"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'vercel' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-bold text-neutral-900">
                  Panduan Deploy ke Vercel (vercel.com)
                </h4>
                <p className="text-xs text-neutral-600 mt-1">
                  Struktur kode aplikasi telah disesuaikan dengan arsitektur Vercel Serverless Functions dan Vite SPA.
                </p>
              </div>

              {/* Architecture diagram cards */}
              <div className="border border-neutral-200 rounded-xl p-4 bg-white space-y-3">
                <span className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                  Penyesuaian Struktur Kode yang Telah Diterapkan:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                    <strong className="block font-mono text-neutral-900 mb-1">/vercel.json</strong>
                    <span className="text-neutral-600">
                      Konfigurasi routing Vercel untuk mengarahkan <code>/api/*</code> ke serverless handler dan aset frontend ke SPA <code>/index.html</code>.
                    </span>
                  </div>
                  <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                    <strong className="block font-mono text-neutral-900 mb-1">/api/index.ts</strong>
                    <span className="text-neutral-600">
                      Serverless Function entry point yang dieksekusi secara otomatis oleh Vercel Node.js Runtime.
                    </span>
                  </div>
                  <div className="p-3 bg-neutral-50 rounded-lg border border-neutral-200">
                    <strong className="block font-mono text-neutral-900 mb-1">/server/app.ts</strong>
                    <span className="text-neutral-600">
                      Modul terpadu endpoint API (<code>/api/segment</code>, <code>/api/tts</code>) yang mendukung local dev dan Vercel cloud.
                    </span>
                  </div>
                </div>
              </div>

              {/* Environment Variables on Vercel */}
              <div className="border border-neutral-200 rounded-xl p-4 bg-white space-y-3">
                <h5 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                  Variabel Lingkungan yang Wajib Ditambahkan di Vercel:
                </h5>
                <p className="text-xs text-neutral-600">
                  Buka dashboard <strong>Vercel &gt; Proyek Anda &gt; Settings &gt; Environment Variables</strong>, lalu tambahkan:
                </p>
                <div className="space-y-2 font-mono text-xs">
                  <div className="p-2.5 bg-neutral-900 text-neutral-200 rounded-lg flex items-center justify-between">
                    <span><strong>GEMINI_API_KEY</strong> = kunci_gemini_api_anda</span>
                    <span className="text-[10px] text-amber-400 font-sans">Wajib untuk AI & TTS</span>
                  </div>
                  <div className="p-2.5 bg-neutral-900 text-neutral-200 rounded-lg flex items-center justify-between">
                    <span><strong>VITE_SUPABASE_URL</strong> = https://your-project.supabase.co</span>
                    <span className="text-[10px] text-emerald-400 font-sans">Database Supabase</span>
                  </div>
                  <div className="p-2.5 bg-neutral-900 text-neutral-200 rounded-lg flex items-center justify-between">
                    <span><strong>VITE_SUPABASE_ANON_KEY</strong> = eyJhbGciOiJIUzI1Ni...</span>
                    <span className="text-[10px] text-emerald-400 font-sans">Anon Key Supabase</span>
                  </div>
                </div>
              </div>

              {/* Step by step deployment */}
              <div className="space-y-2 text-xs text-neutral-700">
                <h5 className="font-bold text-neutral-900">Langkah-Langkah Deploy Cepat:</h5>
                <ol className="list-decimal list-inside space-y-1.5 pl-1 text-neutral-600">
                  <li>Unduh atau push repositori kode ini ke <strong>GitHub</strong> atau <strong>GitLab</strong>.</li>
                  <li>Di <strong>vercel.com</strong>, klik <strong>"Add New" &gt; "Project"</strong> lalu pilih repositori Anda.</li>
                  <li>Framework Preset akan otomatis terdeteksi sebagai <strong>Vite</strong>.</li>
                  <li>Masukkan 3 Environment Variables di atas pada menu konfigurasi Vercel.</li>
                  <li>Klik <strong>Deploy</strong>. Vercel akan otomatis meng-compile frontend dan serverless API dalam hitungan detik!</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-neutral-200 bg-neutral-50 flex items-center justify-between">
          <span className="text-xs text-neutral-500">
            Arsitektur siap produksi untuk Vercel & Supabase
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold rounded-xl bg-neutral-900 text-white hover:bg-neutral-800 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
