import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { TextInputView, SplitMode } from './components/TextInputView';
import { ChapterManager } from './components/ChapterManager';
import { EbookReaderView } from './components/EbookReaderView';
import { JsonOutputModal } from './components/JsonOutputModal';
import { ExportModal } from './components/ExportModal';
import { AudioSettingsModal } from './components/AudioSettingsModal';
import { SupabaseModal } from './components/SupabaseModal';
import { ChapterData, EbookData, TTSConfig } from './types';
import {
  splitChapterIntoParts,
  splitSingleChapterIntoAudioParts,
} from './utils/chapterSplitter';
import { browserSpeech } from './utils/browserTTS';
import { isSupabaseConfigured, syncSupabaseConfigFromServer } from './lib/supabase';
import { CheckCircle2 } from 'lucide-react';
import {
  fetchBooksList,
  loadEbookWithChapters,
  saveEbookToSupabase,
  SupabaseBookSummary,
} from './services/supabaseService';

export default function App() {
  // Clean, empty slate (sistem polosan) for user's own stories
  const [ebook, setEbook] = useState<EbookData>({
    judul: '',
    penulis: 'Penulis',
    deskripsi: '',
    bahasa: 'id-ID',
    dibuat_pada: new Date().toISOString(),
    total_kata: 0,
    bab: [],
  });

  const [inputText, setInputText] = useState<string>('');
  const [bookTitle, setBookTitle] = useState<string>('');
  const [chapterNumber, setChapterNumber] = useState<number>(1);
  const [chapterTitle, setChapterTitle] = useState<string>('');
  const [splitMode, setSplitMode] = useState<SplitMode>('parts_auto');
  const [activeTab, setActiveTab] = useState<'input' | 'reader'>('input');
  const [currentChapterIndex, setCurrentChapterIndex] = useState<number>(0);

  // Audio Playback State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [activePlayingId, setActivePlayingId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [ttsConfig, setTtsConfig] = useState<TTSConfig>({
    voice: 'Kore',
    speed: 1.0,
    pitch: 1.0,
    engine: 'gemini',
  });

  // Supabase Saved Books State for direct in-navigation reading
  const [savedBooks, setSavedBooks] = useState<SupabaseBookSummary[]>([]);
  const [isLoadingBooks, setIsLoadingBooks] = useState<boolean>(false);
  const [isSupabaseReady, setIsSupabaseReady] = useState<boolean>(isSupabaseConfigured());
  const [isSavingToDb, setIsSavingToDb] = useState<boolean>(false);
  const [dbSaveSuccess, setDbSaveSuccess] = useState<boolean | null>(null);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Modals
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const [isJsonModalOpen, setIsJsonModalOpen] = useState<boolean>(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState<boolean>(false);

  // Progress States
  const [isSegmenting, setIsSegmenting] = useState<boolean>(false);
  const [isBatchGenerating, setIsBatchGenerating] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number }>({
    current: 0,
    total: 0,
  });
  const [generatingChapterId, setGeneratingChapterId] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize hidden audio element
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
      if (!isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    audio.onloadedmetadata = () => {
      if (!isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    audio.onended = () => {
      setIsPlaying(false);
      setActivePlayingId(null);
      // Auto play next chapter in reader mode
      if (activeTab === 'reader' && currentChapterIndex < ebook.bab.length - 1) {
        const nextIdx = currentChapterIndex + 1;
        setCurrentChapterIndex(nextIdx);
        setTimeout(() => {
          const nextChapter = ebook.bab[nextIdx];
          if (nextChapter?.audio_url) {
            playAudioUrl(nextChapter.audio_url, nextChapter.id);
          }
        }, 600);
      }
    };

    return () => {
      audio.pause();
      browserSpeech.stop();
    };
  }, [currentChapterIndex, activeTab, ebook.bab]);

  // Sync playback speed
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Fetch and deduplicate books from Supabase
  const refreshSavedBooks = async () => {
    if (!isSupabaseConfigured()) {
      setIsSupabaseReady(false);
      return;
    }
    setIsSupabaseReady(true);
    setIsLoadingBooks(true);
    try {
      // fetchBooksList automatically deduplicates same titles to 1 latest book
      const list = await fetchBooksList(true);
      setSavedBooks(list);
    } catch (err) {
      console.error('Failed to fetch books in App:', err);
    } finally {
      setIsLoadingBooks(false);
    }
  };

  // Sync Supabase config from server across devices on mount
  useEffect(() => {
    syncSupabaseConfigFromServer().then((hasConfig) => {
      if (hasConfig || isSupabaseConfigured()) {
        setIsSupabaseReady(true);
        refreshSavedBooks();
      }
    });

    const handleCredUpdate = () => {
      setIsSupabaseReady(isSupabaseConfigured());
      refreshSavedBooks();
    };

    window.addEventListener('supabase_credentials_updated', handleCredUpdate);
    window.addEventListener('supabase_config_synced', handleCredUpdate);
    return () => {
      window.removeEventListener('supabase_credentials_updated', handleCredUpdate);
      window.removeEventListener('supabase_config_synced', handleCredUpdate);
    };
  }, []);

  // Persist current ebook state to Supabase Cloud Database
  const persistEbookToSupabase = async (targetEbook: EbookData): Promise<string | null> => {
    if (!isSupabaseConfigured() || !targetEbook.bab || targetEbook.bab.length === 0) {
      return null;
    }
    setIsSavingToDb(true);
    try {
      const res = await saveEbookToSupabase(targetEbook, targetEbook.id);
      if (res.success && res.bookId) {
        targetEbook.id = res.bookId;
        setEbook((prev) => ({ ...prev, id: res.bookId }));
        setDbSaveSuccess(true);
        setSaveToast(`✓ Buku "${targetEbook.judul || 'Tanpa Judul'}" (${targetEbook.bab.length} bab) tersimpan di Supabase!`);
        refreshSavedBooks();
        setTimeout(() => setDbSaveSuccess(null), 4000);
        setTimeout(() => setSaveToast(null), 4000);
        return res.bookId;
      } else {
        console.warn('Auto-save to Supabase failed:', res.error);
        setDbSaveSuccess(false);
        setTimeout(() => setDbSaveSuccess(null), 4000);
      }
    } catch (err) {
      console.error('Auto-save error:', err);
      setDbSaveSuccess(false);
      setTimeout(() => setDbSaveSuccess(null), 4000);
    } finally {
      setIsSavingToDb(false);
    }
    return null;
  };

  // Direct load a book from navigation without opening Supabase modal
  const handleDirectSelectBook = async (bookId: string) => {
    try {
      setIsLoadingBooks(true);
      const loaded = await loadEbookWithChapters(bookId);
      if (loaded) {
        if (audioRef.current) audioRef.current.pause();
        browserSpeech.stop();
        setIsPlaying(false);
        setActivePlayingId(null);
        setEbook(loaded);
        setBookTitle(loaded.judul);
        setChapterNumber(loaded.bab.length + 1);
        setCurrentChapterIndex(0);
        setActiveTab('reader');
      }
    } catch (err: any) {
      console.error('Failed to load book directly:', err);
      alert('Gagal memuat buku: ' + (err.message || 'Kesalahan koneksi database'));
    } finally {
      setIsLoadingBooks(false);
    }
  };

  const wordCount = inputText.trim().split(/\s+/).filter(Boolean).length;

  // Process a pasted chapter text into parts or segments
  const handleProcessChapter = async (append: boolean = true) => {
    if (!inputText.trim()) return;

    if (splitMode === 'ai') {
      setIsSegmenting(true);
      try {
        const response = await fetch('/api/segment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: inputText,
            titleHint: bookTitle.trim() || undefined,
          }),
        });

        if (!response.ok) {
          throw new Error('Gagal memproses segmentasi AI.');
        }

        const data = await response.json();
        const incomingChapters: ChapterData[] = (data.bab || []).map((ch: any, idx: number) => ({
          id: `chap-${Date.now()}-${idx + 1}`,
          nomor: ch.nomor || idx + 1,
          judul_bab: ch.judul_bab || `Bab ${idx + 1}`,
          ringkasan: ch.ringkasan || '',
          teks: ch.teks || '',
          jumlah_kata: ch.jumlah_kata || ch.teks?.split(/\s+/).filter(Boolean).length || 0,
          audio_status: 'idle',
        }));

        const finalTitle = bookTitle.trim() || data.judul || ebook.judul || 'Buku Narasi Elektronik';
        let updatedEbook: EbookData;

        if (append && ebook.bab.length > 0) {
          const combined = [...ebook.bab, ...incomingChapters].map((ch, i) => ({
            ...ch,
            nomor: i + 1,
          }));
          const targetIndex = ebook.bab.length;
          updatedEbook = {
            ...ebook,
            judul: bookTitle.trim() || ebook.judul || finalTitle,
            total_kata: combined.reduce((acc, c) => acc + c.jumlah_kata, 0),
            bab: combined,
          };
          setEbook(updatedEbook);
          setChapterNumber(combined.length + 1);
          setCurrentChapterIndex(targetIndex);
        } else {
          const renumbered = incomingChapters.map((ch, i) => ({ ...ch, nomor: i + 1 }));
          updatedEbook = {
            judul: finalTitle,
            penulis: data.penulis || 'Penulis',
            deskripsi: data.deskripsi || `Buku elektronik dengan ${renumbered.length} bab.`,
            bahasa: 'id-ID',
            dibuat_pada: new Date().toISOString(),
            total_kata: renumbered.reduce((acc, c) => acc + c.jumlah_kata, 0),
            bab: renumbered,
          };
          setEbook(updatedEbook);
          setChapterNumber(renumbered.length + 1);
          setCurrentChapterIndex(0);
        }

        setInputText('');
        setChapterTitle('');
        setActiveTab('reader');

        // Otomatis simpan ke Supabase jika database siap
        if (isSupabaseConfigured()) {
          await persistEbookToSupabase(updatedEbook);
        }
      } catch (err: any) {
        console.error(err);
        alert(err.message || 'Terjadi kesalahan saat membagi bab.');
      } finally {
        setIsSegmenting(false);
      }
      return;
    }

    // Split locally into parts or single chapter
    setIsSegmenting(true);
    try {
      let targetWords = 350;
      if (splitMode === 'parts_short') targetWords = 250;
      if (splitMode === 'parts_medium') targetWords = 450;
      if (splitMode === 'parts_auto') targetWords = 350;

      const parts = splitChapterIntoParts(inputText, {
        chapterNumber,
        chapterTitle: chapterTitle.trim() || undefined,
        mode: splitMode,
        targetWordsPerPart: targetWords,
      });

      const finalTitle =
        bookTitle.trim() ||
        ebook.judul ||
        (chapterTitle ? `Buku: ${chapterTitle}` : `Buku Narasi Elektronik`);

      let updatedEbook: EbookData;

      if (append && ebook.bab.length > 0) {
        const combined = [...ebook.bab, ...parts].map((ch, i) => ({
          ...ch,
          nomor: i + 1,
        }));
        const targetIndex = ebook.bab.length;
        updatedEbook = {
          ...ebook,
          judul: bookTitle.trim() || ebook.judul || finalTitle,
          total_kata: combined.reduce((acc, c) => acc + c.jumlah_kata, 0),
          bab: combined,
        };
        setEbook(updatedEbook);
        setChapterNumber(combined.length + 1);
        setCurrentChapterIndex(targetIndex);
      } else {
        const renumbered = parts.map((ch, i) => ({ ...ch, nomor: i + 1 }));
        updatedEbook = {
          judul: finalTitle,
          penulis: 'Penulis',
          deskripsi: `Buku elektronik dengan ${renumbered.length} bagian bab.`,
          bahasa: 'id-ID',
          dibuat_pada: new Date().toISOString(),
          total_kata: renumbered.reduce((acc, c) => acc + c.jumlah_kata, 0),
          bab: renumbered,
        };
        setEbook(updatedEbook);
        setChapterNumber(renumbered.length + 1);
        setCurrentChapterIndex(0);
      }

      setInputText('');
      setChapterTitle('');
      setActiveTab('reader');

      // Otomatis simpan ke Supabase jika database siap
      if (isSupabaseConfigured()) {
        await persistEbookToSupabase(updatedEbook);
      }
    } catch (err: any) {
      console.error(err);
      alert('Gagal memproses bab: ' + (err.message || 'Format teks tidak valid.'));
    } finally {
      setIsSegmenting(false);
    }
  };

  // Split an existing chapter into subparts (~350 words per part for audio)
  const handleSplitCurrentChapterIntoParts = (chapterId: string) => {
    const chapterIndex = ebook.bab.findIndex((b) => b.id === chapterId);
    if (chapterIndex === -1) return;
    const targetChapter = ebook.bab[chapterIndex];

    const subparts = splitSingleChapterIntoAudioParts(targetChapter, 350);
    if (subparts.length <= 1) {
      alert('Bab ini sudah cukup ringkas dan tidak perlu dipecah lagi.');
      return;
    }

    const updatedChapters = [
      ...ebook.bab.slice(0, chapterIndex),
      ...subparts,
      ...ebook.bab.slice(chapterIndex + 1),
    ].map((ch, idx) => ({ ...ch, nomor: idx + 1 }));

    const updatedEbook: EbookData = {
      ...ebook,
      bab: updatedChapters,
      total_kata: updatedChapters.reduce((acc, c) => acc + c.jumlah_kata, 0),
    };

    setEbook(updatedEbook);
    setCurrentChapterIndex(chapterIndex);

    if (isSupabaseConfigured()) {
      persistEbookToSupabase(updatedEbook);
    }
  };

  // Triggered when user wants to add next chapter
  const handleAddNewChapter = () => {
    setChapterNumber(ebook.bab.length + 1);
    setChapterTitle('');
    setActiveTab('input');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Reset all to blank/polosan state
  const handleResetAll = () => {
    if (audioRef.current) audioRef.current.pause();
    browserSpeech.stop();
    setIsPlaying(false);
    setActivePlayingId(null);
    setEbook({
      judul: '',
      penulis: 'Penulis',
      deskripsi: '',
      bahasa: 'id-ID',
      dibuat_pada: new Date().toISOString(),
      total_kata: 0,
      bab: [],
    });
    setInputText('');
    setBookTitle('');
    setChapterNumber(1);
    setChapterTitle('');
    setSplitMode('parts_auto');
    setCurrentChapterIndex(0);
    setActiveTab('input');
  };

  // Generate audio for a single chapter
  const handleGenerateAudioForChapter = async (chapterId: string): Promise<void> => {
    const chapter = ebook.bab.find((b) => b.id === chapterId);
    if (!chapter) return;

    if (!chapter.teks || chapter.teks.trim().length === 0) {
      alert('Teks naskah bab ini masih kosong. Silakan tulis atau masukkan naskah terlebih dahulu.');
      return;
    }

    setGeneratingChapterId(chapterId);
    setEbook((prev) => ({
      ...prev,
      bab: prev.bab.map((b) => (b.id === chapterId ? { ...b, audio_status: 'generating' } : b)),
    }));

    try {
      if (ttsConfig.engine === 'browser') {
        // Web Speech mode
        const updatedEbook: EbookData = {
          ...ebook,
          bab: ebook.bab.map((b) =>
            b.id === chapterId
              ? {
                  ...b,
                  audio_status: 'ready',
                  audio_url: `speech:browser-id-ID`,
                  durasi_detik: Math.round(b.jumlah_kata * 0.4),
                }
              : b
          ),
        };
        setEbook(updatedEbook);
        if (isSupabaseConfigured()) {
          persistEbookToSupabase(updatedEbook);
        }
      } else {
        // Gemini TTS API
        const response = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: chapter.teks,
            voice: ttsConfig.voice,
          }),
        });

        const data = await response.json();

        if (response.ok && (data.data_url || data.audio_url)) {
          const finalAudioUrl = data.data_url || data.audio_url;
          const updatedEbook: EbookData = {
            ...ebook,
            bab: ebook.bab.map((b) =>
              b.id === chapterId
                ? {
                    ...b,
                    audio_status: 'ready',
                    audio_url: finalAudioUrl,
                    durasi_detik: data.duration_seconds || Math.round(b.jumlah_kata * 0.4),
                    audio_error: undefined,
                  }
                : b
            ),
          };
          setEbook(updatedEbook);
          if (isSupabaseConfigured()) {
            persistEbookToSupabase(updatedEbook);
          }
        } else if (data.canUseBrowserTTS || data.fallbackToBrowser) {
          // Graceful fallback to browser speech synthesis
          const updatedEbook: EbookData = {
            ...ebook,
            bab: ebook.bab.map((b) =>
              b.id === chapterId
                ? {
                    ...b,
                    audio_status: 'ready',
                    audio_url: `speech:browser-id-ID`,
                    durasi_detik: Math.round(b.jumlah_kata * 0.4),
                    audio_error: undefined,
                  }
                : b
            ),
          };
          setEbook(updatedEbook);
          if (isSupabaseConfigured()) {
            persistEbookToSupabase(updatedEbook);
          }
        } else {
          throw new Error(data.error || 'Gagal menghasilkan audio untuk bab ini.');
        }
      }
    } catch (err: any) {
      console.error(err);
      setEbook((prev) => ({
        ...prev,
        bab: prev.bab.map((b) =>
          b.id === chapterId
            ? {
                ...b,
                audio_status: 'error',
                audio_error: err.message || 'Gagal membuat audio.',
              }
            : b
        ),
      }));
    } finally {
      setGeneratingChapterId(null);
    }
  };

  // Generate audio for all chapters sequentially
  const handleGenerateAllAudio = async (): Promise<void> => {
    const ungenerated = ebook.bab.filter((b) => !b.audio_url || b.audio_status !== 'ready');
    if (ungenerated.length === 0) return;

    setIsBatchGenerating(true);
    setBatchProgress({ current: 0, total: ungenerated.length });

    for (let i = 0; i < ungenerated.length; i++) {
      setBatchProgress({ current: i + 1, total: ungenerated.length });
      await handleGenerateAudioForChapter(ungenerated[i].id);
      // Small pause between chapters to avoid rate spikes
      await new Promise((r) => setTimeout(r, 600));
    }

    setIsBatchGenerating(false);
    setBatchProgress({ current: 0, total: 0 });

    if (isSupabaseConfigured()) {
      setEbook((current) => {
        persistEbookToSupabase(current);
        return current;
      });
    }
  };

  // Play / Pause logic
  const playAudioUrl = (url: string, chapterId: string) => {
    if (!audioRef.current) return;

    browserSpeech.stop();

    if (url.startsWith('speech:')) {
      // Browser Speech
      const chapter = ebook.bab.find((b) => b.id === chapterId);
      if (chapter) {
        setIsPlaying(true);
        setActivePlayingId(chapterId);
        browserSpeech.speak(chapter.teks, {
          rate: playbackSpeed,
          onEnd: () => {
            setIsPlaying(false);
            setActivePlayingId(null);
          },
          onError: () => {
            setIsPlaying(false);
            setActivePlayingId(null);
          },
        });
      }
      return;
    }

    audioRef.current.src = url;
    audioRef.current.playbackRate = playbackSpeed;
    audioRef.current
      .play()
      .then(() => {
        setIsPlaying(true);
        setActivePlayingId(chapterId);
      })
      .catch((err) => {
        console.error('Audio play error:', err);
        setIsPlaying(false);
      });
  };

  const handleTogglePlayCurrent = () => {
    const currentChapter = ebook.bab[currentChapterIndex];
    if (!currentChapter) return;

    if (isPlaying) {
      if (audioRef.current && !audioRef.current.paused) {
        audioRef.current.pause();
      }
      browserSpeech.stop();
      setIsPlaying(false);
      setActivePlayingId(null);
    } else {
      if (currentChapter.audio_url) {
        playAudioUrl(currentChapter.audio_url, currentChapter.id);
      } else {
        // Fallback: Speak via browser speech
        setIsPlaying(true);
        setActivePlayingId(currentChapter.id);
        browserSpeech.speak(currentChapter.teks, {
          rate: playbackSpeed,
          onEnd: () => {
            setIsPlaying(false);
            setActivePlayingId(null);
          },
          onError: () => {
            setIsPlaying(false);
            setActivePlayingId(null);
          },
        });
      }
    }
  };

  const handleTogglePlayPreview = (chapter: ChapterData) => {
    if (isPlaying && activePlayingId === chapter.id) {
      if (audioRef.current) audioRef.current.pause();
      browserSpeech.stop();
      setIsPlaying(false);
      setActivePlayingId(null);
    } else {
      const idx = ebook.bab.findIndex((b) => b.id === chapter.id);
      if (idx !== -1) setCurrentChapterIndex(idx);
      if (chapter.audio_url) {
        playAudioUrl(chapter.audio_url, chapter.id);
      }
    }
  };

  const handleSeek = (seconds: number) => {
    if (audioRef.current && !isNaN(seconds)) {
      audioRef.current.currentTime = seconds;
      setCurrentTime(seconds);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 flex flex-col antialiased">
      {/* Top Header Navbar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        hasChapters={ebook.bab.length > 0}
        totalChapters={ebook.bab.length}
        totalWords={ebook.total_kata}
        onOpenExport={() => setIsExportModalOpen(true)}
        onOpenJson={() => setIsJsonModalOpen(true)}
        onOpenSettings={() => setIsSettingsModalOpen(true)}
        onOpenSupabase={() => setIsSupabaseModalOpen(true)}
        isSupabaseConnected={isSupabaseReady}
        isProcessing={isSegmenting || isBatchGenerating}
        isSavingToDb={isSavingToDb}
        dbSaveSuccess={dbSaveSuccess}
        onSaveToDatabase={() => persistEbookToSupabase(ebook)}
      />

      {/* Main View Area */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {activeTab === 'input' ? (
          <div className="space-y-8">
            <TextInputView
              inputText={inputText}
              setInputText={setInputText}
              bookTitle={bookTitle}
              setBookTitle={setBookTitle}
              chapterNumber={chapterNumber}
              setChapterNumber={setChapterNumber}
              chapterTitle={chapterTitle}
              setChapterTitle={setChapterTitle}
              splitMode={splitMode}
              setSplitMode={setSplitMode}
              onProcessChapter={handleProcessChapter}
              isProcessing={isSegmenting}
              wordCount={wordCount}
              hasExistingChapters={ebook.bab.length > 0}
              existingChaptersCount={ebook.bab.length}
              onResetAll={handleResetAll}
              isSupabaseConnected={isSupabaseReady}
              isSavingToDb={isSavingToDb}
              onOpenSupabase={() => setIsSupabaseModalOpen(true)}
            />

            {ebook.bab.length > 0 && (
              <ChapterManager
                ebook={ebook}
                setEbook={setEbook}
                onGenerateAudioForChapter={handleGenerateAudioForChapter}
                onGenerateAllAudio={handleGenerateAllAudio}
                isBatchGenerating={isBatchGenerating}
                batchProgress={batchProgress}
                onOpenReaderAtChapter={(idx) => {
                  setCurrentChapterIndex(idx);
                  setActiveTab('reader');
                }}
                activePlayingId={activePlayingId}
                onTogglePlayPreview={handleTogglePlayPreview}
                ttsConfig={ttsConfig}
                onAddNewChapter={handleAddNewChapter}
                onResetBook={handleResetAll}
                onSplitChapterIntoParts={handleSplitCurrentChapterIntoParts}
                onPersistToDb={persistEbookToSupabase}
                isSupabaseConnected={isSupabaseReady}
                isSavingToDb={isSavingToDb}
                dbSaveSuccess={dbSaveSuccess}
                onSaveToDatabase={() => persistEbookToSupabase(ebook)}
              />
            )}
          </div>
        ) : (
          <EbookReaderView
            ebook={ebook}
            currentChapterIndex={currentChapterIndex}
            setCurrentChapterIndex={(idx) => {
              setCurrentChapterIndex(idx);
              // Stop previous audio
              if (audioRef.current) audioRef.current.pause();
              browserSpeech.stop();
              setIsPlaying(false);
              setActivePlayingId(null);
            }}
            isPlaying={isPlaying}
            onTogglePlay={handleTogglePlayCurrent}
            currentTime={currentTime}
            duration={duration}
            onSeek={handleSeek}
            playbackSpeed={playbackSpeed}
            setPlaybackSpeed={setPlaybackSpeed}
            onGenerateAudioForChapter={handleGenerateAudioForChapter}
            isGeneratingAudio={generatingChapterId === ebook.bab[currentChapterIndex]?.id}
            onAddNewChapter={handleAddNewChapter}
            onSplitChapterIntoParts={handleSplitCurrentChapterIntoParts}
            onGenerateAllAudio={handleGenerateAllAudio}
            isBatchGenerating={isBatchGenerating}
            batchProgress={batchProgress}
            savedBooks={savedBooks}
            isLoadingBooks={isLoadingBooks}
            onSelectBook={handleDirectSelectBook}
            onRefreshBooks={refreshSavedBooks}
            onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
            isSupabaseConnected={isSupabaseReady}
            isSavingToDb={isSavingToDb}
            dbSaveSuccess={dbSaveSuccess}
            onSaveToDatabase={() => persistEbookToSupabase(ebook)}
          />
        )}
      </div>

      {/* Floating Supabase Auto-Save Notification */}
      {saveToast && (
        <div
          id="supabase-save-toast"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-neutral-900/95 text-white rounded-xl shadow-xl border border-neutral-700 text-xs sm:text-sm font-medium animate-in fade-in slide-in-from-bottom-3 duration-200"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{saveToast}</span>
        </div>
      )}

      {/* Modals */}
      <JsonOutputModal
        isOpen={isJsonModalOpen}
        onClose={() => setIsJsonModalOpen(false)}
        ebook={ebook}
      />

      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        ebook={ebook}
      />

      <AudioSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        ttsConfig={ttsConfig}
        setTtsConfig={setTtsConfig}
      />

      <SupabaseModal
        isOpen={isSupabaseModalOpen}
        onClose={() => {
          setIsSupabaseModalOpen(false);
          refreshSavedBooks();
        }}
        ebook={ebook}
        onLoadEbook={(loaded) => {
          setEbook(loaded);
          setCurrentChapterIndex(0);
          setActiveTab('reader');
          refreshSavedBooks();
        }}
      />
    </div>
  );
}
