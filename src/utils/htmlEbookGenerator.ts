import { EbookData } from '../types';

export function generateStandaloneHtmlEbook(ebook: EbookData): string {
  const chaptersJson = JSON.stringify(ebook.bab);
  const titleEscaped = escapeHtml(ebook.judul);
  const authorEscaped = escapeHtml(ebook.penulis || 'Penulis');
  const descEscaped = escapeHtml(ebook.deskripsi || '');

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titleEscaped} - Buku Elektronik & Narasi Audio</title>
  <meta name="description" content="${descEscaped}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400..700;1,400..700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg-color: #fcfbf9;
      --text-color: #242220;
      --sidebar-bg: #f4f1ea;
      --border-color: #e5dfd5;
      --accent-color: #b45309;
      --accent-hover: #92400e;
      --card-bg: #ffffff;
      --player-bg: #1c1917;
      --player-text: #f5f5f4;
      --font-size: 18px;
      --line-height: 1.75;
    }

    [data-theme="dark"] {
      --bg-color: #18181b;
      --text-color: #f4f4f5;
      --sidebar-bg: #09090b;
      --border-color: #27272a;
      --accent-color: #f59e0b;
      --accent-hover: #fbbf24;
      --card-bg: #27272a;
      --player-bg: #09090b;
      --player-text: #fafafa;
    }

    [data-theme="sepia"] {
      --bg-color: #fbf0d9;
      --text-color: #3f311c;
      --sidebar-bg: #f3e2be;
      --border-color: #e4cc9e;
      --accent-color: #8f3d05;
      --accent-hover: #6e2f03;
      --card-bg: #fff8eb;
      --player-bg: #382c1e;
      --player-text: #fcefd6;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      background-color: var(--bg-color);
      color: var(--text-color);
      transition: background-color 0.2s, color 0.2s;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* Layout */
    .app-container {
      display: flex;
      min-height: 100vh;
      width: 100%;
    }

    /* Sidebar */
    .sidebar {
      width: 320px;
      background-color: var(--sidebar-bg);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      position: sticky;
      top: 0;
      height: 100vh;
      overflow-y: auto;
      transition: transform 0.3s ease;
    }

    .sidebar-header {
      padding: 24px 20px;
      border-bottom: 1px solid var(--border-color);
    }

    .book-title {
      font-family: 'Lora', Georgia, serif;
      font-size: 20px;
      font-weight: 700;
      line-height: 1.3;
      margin-bottom: 6px;
      color: var(--text-color);
    }

    .book-meta {
      font-size: 13px;
      opacity: 0.75;
    }

    .toc-title {
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 16px 20px 8px;
      opacity: 0.6;
    }

    .chapter-nav {
      list-style: none;
      padding: 0 12px;
    }

    .chapter-nav-item {
      margin-bottom: 4px;
    }

    .chapter-nav-btn {
      width: 100%;
      text-align: left;
      background: none;
      border: none;
      padding: 10px 12px;
      border-radius: 8px;
      font-size: 14px;
      color: var(--text-color);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      transition: background-color 0.15s;
    }

    .chapter-nav-btn:hover {
      background-color: rgba(0,0,0,0.05);
    }

    [data-theme="dark"] .chapter-nav-btn:hover {
      background-color: rgba(255,255,255,0.05);
    }

    .chapter-nav-btn.active {
      background-color: var(--card-bg);
      font-weight: 600;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08);
      color: var(--accent-color);
    }

    .audio-badge {
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 9999px;
      background-color: rgba(180, 83, 9, 0.15);
      color: var(--accent-color);
      font-weight: 600;
    }

    /* Main Content */
    .main-content {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
    }

    /* Topbar */
    .topbar {
      padding: 14px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid var(--border-color);
      position: sticky;
      top: 0;
      background-color: var(--bg-color);
      z-index: 10;
      backdrop-filter: blur(8px);
    }

    .mobile-menu-btn {
      display: none;
      background: none;
      border: 1px solid var(--border-color);
      border-radius: 6px;
      padding: 6px 12px;
      font-size: 14px;
      cursor: pointer;
      color: var(--text-color);
    }

    .controls-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .ctrl-btn {
      background: var(--card-bg);
      border: 1px solid var(--border-color);
      color: var(--text-color);
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .ctrl-btn:hover {
      border-color: var(--accent-color);
    }

    /* Reader Container */
    .reader-area {
      flex: 1;
      padding: 48px 24px 120px;
      max-width: 780px;
      margin: 0 auto;
      width: 100%;
    }

    .chapter-header {
      margin-bottom: 36px;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--border-color);
    }

    .chapter-number-label {
      font-size: 14px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--accent-color);
      margin-bottom: 8px;
    }

    .chapter-heading {
      font-family: 'Lora', Georgia, serif;
      font-size: 32px;
      font-weight: 700;
      line-height: 1.25;
      margin-bottom: 16px;
    }

    .chapter-meta-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-top: 16px;
    }

    .chapter-play-btn {
      background-color: var(--accent-color);
      color: #ffffff;
      border: none;
      padding: 10px 20px;
      border-radius: 9999px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
      transition: background-color 0.15s, transform 0.1s;
    }

    .chapter-play-btn:hover {
      background-color: var(--accent-hover);
      transform: translateY(-1px);
    }

    /* Book text body */
    .book-text {
      font-family: 'Lora', Georgia, serif;
      font-size: var(--font-size);
      line-height: var(--line-height);
      letter-spacing: 0.01em;
    }

    .book-text p {
      margin-bottom: 1.6em;
      text-align: justify;
      text-justify: inter-word;
      text-indent: 1.5em;
    }

    .book-text p:first-of-type {
      text-indent: 0;
    }

    .chapter-nav-bottom {
      display: flex;
      justify-content: space-between;
      margin-top: 60px;
      padding-top: 24px;
      border-top: 1px solid var(--border-color);
    }

    /* Audio Player Sticky Bar */
    .audio-player-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background-color: var(--player-bg);
      color: var(--player-text);
      padding: 12px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
      z-index: 100;
      box-shadow: 0 -4px 20px rgba(0,0,0,0.25);
    }

    .player-track-info {
      display: flex;
      flex-direction: column;
      max-width: 260px;
    }

    .track-title {
      font-weight: 600;
      font-size: 14px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .track-sub {
      font-size: 12px;
      opacity: 0.7;
    }

    .player-controls {
      display: flex;
      align-items: center;
      gap: 16px;
      flex: 1;
      max-width: 540px;
    }

    .p-btn {
      background: none;
      border: none;
      color: inherit;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 6px;
      border-radius: 50%;
    }

    .p-btn-play {
      background-color: #ffffff;
      color: #000000;
      width: 40px;
      height: 40px;
      border-radius: 50%;
    }

    .timeline-container {
      display: flex;
      align-items: center;
      gap: 10px;
      flex: 1;
    }

    .seek-slider {
      flex: 1;
      accent-color: var(--accent-color);
      cursor: pointer;
    }

    .time-txt {
      font-size: 12px;
      font-family: monospace;
      min-width: 42px;
      text-align: center;
    }

    @media (max-width: 768px) {
      .sidebar {
        position: fixed;
        left: 0;
        top: 0;
        bottom: 0;
        z-index: 50;
        transform: translateX(-100%);
      }
      .sidebar.open {
        transform: translateX(0);
      }
      .mobile-menu-btn {
        display: block;
      }
      .audio-player-bar {
        flex-direction: column;
        gap: 10px;
        padding: 12px;
      }
      .player-track-info {
        max-width: 100%;
        text-align: center;
      }
    }
  </style>
</head>
<body data-theme="light">
  <div class="app-container">
    <!-- Sidebar -->
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-header">
        <h1 class="book-title">${titleEscaped}</h1>
        <div class="book-meta">Oleh ${authorEscaped} • ${ebook.bab.length} Bab</div>
      </div>
      <div class="toc-title">Daftar Isi Bab</div>
      <ul class="chapter-nav" id="chapterNav"></ul>
    </aside>

    <!-- Main Content -->
    <main class="main-content">
      <header class="topbar">
        <button class="mobile-menu-btn" id="menuToggle">☰ Daftar Isi</button>
        <div class="controls-group">
          <button class="ctrl-btn" id="themeBtn">🎨 Tema</button>
          <button class="ctrl-btn" id="fontDecBtn">A-</button>
          <button class="ctrl-btn" id="fontIncBtn">A+</button>
        </div>
      </header>

      <section class="reader-area">
        <div class="chapter-header">
          <div class="chapter-number-label" id="chapNumberLabel">Bab 1</div>
          <h2 class="chapter-heading" id="chapHeading">Memuat...</h2>
          <div class="chapter-meta-bar">
            <span id="chapWordCount" style="font-size: 13px; opacity: 0.7;">0 kata</span>
            <button class="chapter-play-btn" id="chapPlayBtn">
              <span id="chapPlayIcon">▶</span>
              <span id="chapPlayLabel">Putar Narasi Bab Ini</span>
            </button>
          </div>
        </div>

        <article class="book-text" id="bookTextBody"></article>

        <div class="chapter-nav-bottom">
          <button class="ctrl-btn" id="prevChapBtn">← Bab Sebelumnya</button>
          <button class="ctrl-btn" id="nextChapBtn">Bab Selanjutnya →</button>
        </div>
      </section>
    </main>
  </div>

  <!-- Audio Player Bar -->
  <div class="audio-player-bar" id="playerBar">
    <div class="player-track-info">
      <span class="track-title" id="pTrackTitle">${titleEscaped}</span>
      <span class="track-sub" id="pTrackSub">Pilih bab untuk mulai mendengarkan</span>
    </div>

    <div class="player-controls">
      <button class="p-btn" id="pPrevBtn" title="Bab Sebelumnya">⏮</button>
      <button class="p-btn p-btn-play" id="pPlayBtn" title="Putar/Jeda">▶</button>
      <button class="p-btn" id="pNextBtn" title="Bab Selanjutnya">⏭</button>

      <div class="timeline-container">
        <span class="time-txt" id="pCurrentTime">0:00</span>
        <input type="range" class="seek-slider" id="pSeek" min="0" max="100" value="0">
        <span class="time-txt" id="pDuration">0:00</span>
      </div>
    </div>

    <div style="display: flex; align-items: center; gap: 8px;">
      <button class="ctrl-btn" id="pSpeedBtn" style="background: rgba(255,255,255,0.1); color: #fff; border: none; font-size: 12px;">1.0x</button>
    </div>
  </div>

  <audio id="audioElement" preload="metadata"></audio>

  <script>
    const chapters = ${chaptersJson};
    let currentChapterIndex = 0;
    let isPlaying = false;
    let playbackSpeed = 1.0;
    const themes = ['light', 'sepia', 'dark'];
    let currentThemeIndex = 0;
    let fontSize = 18;

    const audioEl = document.getElementById('audioElement');
    const sidebar = document.getElementById('sidebar');
    const chapterNav = document.getElementById('chapterNav');
    const chapHeading = document.getElementById('chapHeading');
    const chapNumberLabel = document.getElementById('chapNumberLabel');
    const chapWordCount = document.getElementById('chapWordCount');
    const bookTextBody = document.getElementById('bookTextBody');
    const chapPlayBtn = document.getElementById('chapPlayBtn');
    const chapPlayIcon = document.getElementById('chapPlayIcon');
    const chapPlayLabel = document.getElementById('chapPlayLabel');
    const pPlayBtn = document.getElementById('pPlayBtn');
    const pTrackTitle = document.getElementById('pTrackTitle');
    const pTrackSub = document.getElementById('pTrackSub');
    const pCurrentTime = document.getElementById('pCurrentTime');
    const pDuration = document.getElementById('pDuration');
    const pSeek = document.getElementById('pSeek');
    const pSpeedBtn = document.getElementById('pSpeedBtn');

    function renderToc() {
      chapterNav.innerHTML = '';
      chapters.forEach((ch, idx) => {
        const li = document.createElement('li');
        li.className = 'chapter-nav-item';
        const btn = document.createElement('button');
        btn.className = 'chapter-nav-btn' + (idx === currentChapterIndex ? ' active' : '');
        btn.innerHTML = '<span>' + (ch.judul_bab || ('Bab ' + (idx + 1))) + '</span>' +
          (ch.audio_url ? '<span class="audio-badge">Audio</span>' : '');
        btn.onclick = () => {
          selectChapter(idx);
          if (window.innerWidth <= 768) sidebar.classList.remove('open');
        };
        li.appendChild(btn);
        chapterNav.appendChild(li);
      });
    }

    function selectChapter(idx) {
      currentChapterIndex = idx;
      const ch = chapters[idx];
      chapNumberLabel.textContent = 'Bab ' + (idx + 1);
      chapHeading.textContent = ch.judul_bab || ('Bab ' + (idx + 1));
      chapWordCount.textContent = (ch.jumlah_kata || 0) + ' kata' + (ch.ringkasan ? ' • ' + ch.ringkasan : '');

      // Render text paragraphs
      bookTextBody.innerHTML = '';
      const paras = ch.teks.split(/\\n\\s*\\n/).map(p => p.trim()).filter(Boolean);
      paras.forEach(p => {
        const pEl = document.createElement('p');
        pEl.textContent = p;
        bookTextBody.appendChild(pEl);
      });

      renderToc();
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Update Audio
      pTrackTitle.textContent = ch.judul_bab || ('Bab ' + (idx + 1));
      pTrackSub.textContent = 'Bab ' + (idx + 1) + ' dari ' + chapters.length;

      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }

      const isSpeechUri = ch.audio_url && ch.audio_url.startsWith('speech:');
      const isDirectAudio = ch.audio_url && !isSpeechUri;

      if (isDirectAudio) {
        audioEl.src = ch.audio_url;
        chapPlayLabel.textContent = 'Putar Narasi Bab Ini';
        chapPlayBtn.disabled = false;
      } else {
        audioEl.removeAttribute('src');
        chapPlayLabel.textContent = 'Putar Narasi Suara (Web Speech)';
        chapPlayBtn.disabled = false;
      }
      updatePlayState(false);
    }

    function togglePlay() {
      const ch = chapters[currentChapterIndex];
      const isSpeechUri = !ch.audio_url || ch.audio_url.startsWith('speech:');

      if (isSpeechUri) {
        // Fallback to Web Speech API
        if ('speechSynthesis' in window) {
          if (window.speechSynthesis.speaking) {
            window.speechSynthesis.cancel();
            updatePlayState(false);
          } else {
            const utt = new SpeechSynthesisUtterance(ch.teks);
            utt.lang = 'id-ID';
            utt.rate = playbackSpeed;
            utt.onend = () => updatePlayState(false);
            utt.onerror = () => updatePlayState(false);
            window.speechSynthesis.speak(utt);
            updatePlayState(true);
          }
        } else {
          alert('Peramban tidak mendukung Web Speech synthesis.');
        }
        return;
      }

      if (audioEl.paused) {
        audioEl.play().then(() => updatePlayState(true)).catch(err => console.error(err));
      } else {
        audioEl.pause();
        updatePlayState(false);
      }
    }

    function updatePlayState(playing) {
      isPlaying = playing;
      pPlayBtn.textContent = playing ? '⏸' : '▶';
      chapPlayIcon.textContent = playing ? '⏸' : '▶';
      chapPlayLabel.textContent = playing ? 'Jeda Narasi' : 'Putar Narasi Bab Ini';
    }

    // Event listeners
    chapPlayBtn.onclick = togglePlay;
    pPlayBtn.onclick = togglePlay;

    audioEl.ontimeupdate = () => {
      if (!isNaN(audioEl.duration)) {
        pCurrentTime.textContent = formatTime(audioEl.currentTime);
        pDuration.textContent = formatTime(audioEl.duration);
        pSeek.value = (audioEl.currentTime / audioEl.duration) * 100;
      }
    };

    audioEl.onended = () => {
      updatePlayState(false);
      // Auto play next chapter
      if (currentChapterIndex < chapters.length - 1) {
        selectChapter(currentChapterIndex + 1);
        setTimeout(() => togglePlay(), 500);
      }
    };

    pSeek.oninput = () => {
      if (!isNaN(audioEl.duration)) {
        audioEl.currentTime = (pSeek.value / 100) * audioEl.duration;
      }
    };

    document.getElementById('prevChapBtn').onclick = () => {
      if (currentChapterIndex > 0) selectChapter(currentChapterIndex - 1);
    };
    document.getElementById('nextChapBtn').onclick = () => {
      if (currentChapterIndex < chapters.length - 1) selectChapter(currentChapterIndex + 1);
    };
    document.getElementById('pPrevBtn').onclick = () => {
      if (currentChapterIndex > 0) selectChapter(currentChapterIndex - 1);
    };
    document.getElementById('pNextBtn').onclick = () => {
      if (currentChapterIndex < chapters.length - 1) selectChapter(currentChapterIndex + 1);
    };

    pSpeedBtn.onclick = () => {
      const speeds = [0.8, 1.0, 1.25, 1.5, 2.0];
      const curIdx = speeds.indexOf(playbackSpeed);
      playbackSpeed = speeds[(curIdx + 1) % speeds.length];
      pSpeedBtn.textContent = playbackSpeed + 'x';
      audioEl.playbackRate = playbackSpeed;
    };

    document.getElementById('themeBtn').onclick = () => {
      currentThemeIndex = (currentThemeIndex + 1) % themes.length;
      document.body.setAttribute('data-theme', themes[currentThemeIndex]);
    };

    document.getElementById('fontIncBtn').onclick = () => {
      if (fontSize < 28) {
        fontSize += 2;
        document.documentElement.style.setProperty('--font-size', fontSize + 'px');
      }
    };

    document.getElementById('fontDecBtn').onclick = () => {
      if (fontSize > 14) {
        fontSize -= 2;
        document.documentElement.style.setProperty('--font-size', fontSize + 'px');
      }
    };

    document.getElementById('menuToggle').onclick = () => {
      sidebar.classList.toggle('open');
    };

    function formatTime(secs) {
      if (isNaN(secs)) return '0:00';
      const m = Math.floor(secs / 60);
      const s = Math.floor(secs % 60);
      return m + ':' + (s < 10 ? '0' : '') + s;
    }

    // Init
    if (chapters.length > 0) {
      selectChapter(0);
    }
  </script>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
