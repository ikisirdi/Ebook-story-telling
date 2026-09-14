import React, { useState, useRef, useEffect } from 'react';
import {
  BookOpen,
  ChevronDown,
  Check,
  RefreshCw,
  Plus,
  Clock,
  Database,
  Library,
  FileText,
} from 'lucide-react';
import { SupabaseBookSummary } from '../services/supabaseService';

interface BookSelectorProps {
  currentBookTitle?: string;
  books: SupabaseBookSummary[];
  isLoading: boolean;
  onSelectBook: (bookId: string) => void;
  onRefresh: () => void;
  onAddNewBook?: () => void;
  onOpenSupabaseConfig?: () => void;
  isSupabaseConnected: boolean;
  theme?: 'light' | 'sepia' | 'dark';
}

export const BookSelector: React.FC<BookSelectorProps> = ({
  currentBookTitle,
  books,
  isLoading,
  onSelectBook,
  onRefresh,
  onAddNewBook,
  onOpenSupabaseConfig,
  isSupabaseConnected,
  theme = 'light',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const activeTitle = currentBookTitle?.trim() || 'Pilih Buku Bacaan';

  const themeClasses = {
    light: {
      button: 'bg-white hover:bg-neutral-50 text-neutral-800 border-neutral-200 shadow-xs',
      menu: 'bg-white border-neutral-200 shadow-xl text-neutral-800',
      itemHover: 'hover:bg-amber-50/70',
      activeItem: 'bg-amber-50 text-amber-900 font-semibold',
      subtext: 'text-neutral-500',
      divider: 'border-neutral-100',
    },
    sepia: {
      button: 'bg-[#fbf0d9] hover:bg-[#f4e4c3] text-[#3f311c] border-[#e4cc9e]',
      menu: 'bg-[#fff8eb] border-[#e4cc9e] shadow-xl text-[#3f311c]',
      itemHover: 'hover:bg-[#f5e6c7]',
      activeItem: 'bg-[#f0dcba] text-[#2b200f] font-semibold',
      subtext: 'text-[#7d6746]',
      divider: 'border-[#ecdaba]',
    },
    dark: {
      button: 'bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border-neutral-700 shadow-xs',
      menu: 'bg-neutral-900 border-neutral-800 shadow-2xl text-neutral-100',
      itemHover: 'hover:bg-neutral-800',
      activeItem: 'bg-neutral-800 text-amber-400 font-semibold',
      subtext: 'text-neutral-400',
      divider: 'border-neutral-800',
    },
  }[theme];

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        id="book-selector-dropdown-btn"
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 max-w-[260px] sm:max-w-[340px] ${themeClasses.button}`}
        title="Pilih buku bacaan yang tersimpan"
      >
        <Library className="w-4 h-4 text-amber-600 shrink-0" />
        <span className="truncate text-left">{activeTitle}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 opacity-60 shrink-0 transition-transform duration-150 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`absolute left-0 mt-1.5 w-80 sm:w-96 rounded-xl border p-2 z-50 ${themeClasses.menu} animate-in fade-in zoom-in-95 duration-100`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-2 py-1.5 border-b mb-1.5 border-neutral-100 dark:border-neutral-800">
            <div className="flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-bold tracking-tight">Koleksi Buku Anda</span>
              {books.length > 0 && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  {books.length} Judul
                </span>
              )}
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onRefresh();
              }}
              disabled={isLoading}
              className="p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 transition-colors"
              title="Segarkan daftar buku"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Book List Content */}
          <div className="max-h-72 overflow-y-auto space-y-1 py-1 pr-1 custom-scrollbar">
            {!isSupabaseConnected ? (
              <div className="p-3 text-center rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 my-1">
                <Database className="w-6 h-6 text-amber-600 mx-auto mb-1.5 opacity-80" />
                <p className="text-xs font-semibold text-amber-900 dark:text-amber-200 mb-1">
                  Supabase Belum Terhubung
                </p>
                <p className="text-[11px] text-amber-700 dark:text-amber-400 mb-2">
                  Hubungkan database Supabase untuk memuat daftar buku tersimpan secara otomatis di semua perangkat.
                </p>
                {onOpenSupabaseConfig && (
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      onOpenSupabaseConfig();
                    }}
                    className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-amber-600 text-white font-medium hover:bg-amber-700"
                  >
                    Atur Supabase
                  </button>
                )}
              </div>
            ) : isLoading ? (
              <div className="p-4 text-center">
                <RefreshCw className="w-5 h-5 text-amber-600 animate-spin mx-auto mb-1.5" />
                <p className="text-xs text-neutral-500">Memuat koleksi buku...</p>
              </div>
            ) : books.length === 0 ? (
              <div className="p-4 text-center">
                <FileText className="w-6 h-6 text-neutral-300 mx-auto mb-1" />
                <p className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                  Belum ada buku tersimpan
                </p>
                <p className="text-[11px] text-neutral-400 mt-0.5">
                  Tempel naskah cerita dan simpan untuk mulai membaca.
                </p>
              </div>
            ) : (
              books.map((b) => {
                const isActive =
                  currentBookTitle &&
                  (b.title || '').trim().toLowerCase() === currentBookTitle.trim().toLowerCase();

                return (
                  <button
                    key={b.id}
                    onClick={() => {
                      onSelectBook(b.id);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left p-2.5 rounded-lg text-xs transition-colors flex items-start justify-between gap-2 ${
                      isActive ? themeClasses.activeItem : themeClasses.itemHover
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="font-bold truncate text-neutral-900 dark:text-neutral-100">
                          {b.title || 'Buku Narasi Elektronik'}
                        </span>
                        {isActive && (
                          <span className="shrink-0 text-[10px] font-semibold bg-amber-500/20 text-amber-700 dark:text-amber-300 px-1.5 py-0.2 rounded">
                            Aktif
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-[11px] opacity-70">
                        <span>{b.total_words?.toLocaleString('id-ID') || 0} kata</span>
                        {b.updated_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {new Date(b.updated_at).toLocaleDateString('id-ID', {
                              day: 'numeric',
                              month: 'short',
                            })}
                          </span>
                        )}
                      </div>
                    </div>

                    {isActive && (
                      <Check className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* Footer Actions */}
          <div className="border-t mt-1 pt-1.5 flex items-center justify-between border-neutral-100 dark:border-neutral-800 px-1">
            {onAddNewBook && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onAddNewBook();
                }}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 hover:text-amber-700 dark:text-amber-400 py-1 px-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Buat / Tempel Buku Baru</span>
              </button>
            )}

            {onOpenSupabaseConfig && (
              <button
                onClick={() => {
                  setIsOpen(false);
                  onOpenSupabaseConfig();
                }}
                className="text-[11px] text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-300 py-1 px-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                Kelola di Supabase
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
