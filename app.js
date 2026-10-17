/**
 * Controller Dashboard Evaluasi Kebijakan Pidato Presiden (MapReduce Komentar YouTube)
 * Mendukung Data CSV Offline (data/), Caching Video Otomatis, Kustomisasi Kata Kunci (CRUD), dan Tabs Navigasi.
 */

let currentDataset = [];
let currentResult = null;
let activeChart = null;
let currentAbortController = null;
let currentActiveJob = 'policyEvaluation'; // Default utama: Pemetaan Sektor Evaluasi Kebijakan Publik
let showAllComments = false;

document.addEventListener('DOMContentLoaded', () => {
  setupEventListeners();
  setupTabs();
  setupViewPills();
  setupKeywordsCrud();
  loadOfflineCsvData(); // Otomatis muat data dari direktori data/ saat pertama kali dibuka
});

function setupEventListeners() {
  const btnFetch = document.getElementById('btn-fetch');
  const btnStop = document.getElementById('btn-stop');
  const btnLoadCsv = document.getElementById('btn-load-csv');
  const btnUploadCsv = document.getElementById('btn-upload-csv');
  const csvFileInput = document.getElementById('csv-file-input');
  const btnExportCsv = document.getElementById('btn-export-csv');
  const btnRunMR = document.getElementById('btn-run-mr');
  const btnToggleComments = document.getElementById('btn-toggle-all-comments');

  if (btnFetch) btnFetch.addEventListener('click', handleFetchYouTubeComments);
  if (btnStop) btnStop.addEventListener('click', handleStopFetching);
  if (btnLoadCsv) btnLoadCsv.addEventListener('click', loadOfflineCsvData);
  
  if (btnUploadCsv && csvFileInput) {
    btnUploadCsv.addEventListener('click', () => csvFileInput.click());
    csvFileInput.addEventListener('change', handleFileUploadCsv);
  }

  if (btnExportCsv) btnExportCsv.addEventListener('click', handleExportCsv);
  if (btnRunMR) btnRunMR.addEventListener('click', runMapReducePipeline);

  if (btnToggleComments) {
    btnToggleComments.addEventListener('click', () => {
      showAllComments = !showAllComments;
      renderRawCommentsPreview(currentDataset);
    });
  }

  updateJobExplanation();
}

/**
 * Setup Navigasi Antara Tab Dashboard dan Tab Kelola Kata Kunci
 */
function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add('active');
      }

      if (targetId === 'tab-keywords') {
        renderKeywordsCrudUI();
      }
    });
  });
}

/**
 * Setup Sub-Pills Tampilan Evaluasi di Dalam Dashboard
 */
function setupViewPills() {
  const pillBtns = document.querySelectorAll('.view-pill-btn');
  pillBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      pillBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentActiveJob = btn.getAttribute('data-job') || 'policyEvaluation';
      
      updateJobExplanation();
      if (currentDataset && currentDataset.length > 0) {
        runMapReducePipeline();
      }
    });
  });
}

/**
 * Ekstraksi Video ID dari URL YouTube atau ID langsung
 */
function extractVideoId(input) {
  if (!input) return null;
  const trimmed = input.trim();
  
  const urlMatch = trimmed.match(/[?&]v=([^&]+)/);
  if (urlMatch) return urlMatch[1];

  const shortMatch = trimmed.match(/youtu\.be\/([^?&]+)/);
  if (shortMatch) return shortMatch[1];

  const embedMatch = trimmed.match(/embed\/([^?&]+)/);
  if (embedMatch) return embedMatch[1];

  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  return trimmed;
}

/**
 * Parser File CSV Fleksibel untuk Membaca Komentar Netizen
 */
function parseCSV(csvText) {
  const lines = [];
  let row = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(current.trim());
      current = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(current.trim());
      if (row.some(cell => cell.length > 0)) {
        lines.push(row);
      }
      row = [];
      current = '';
    } else {
      current += char;
    }
  }
  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    if (row.some(cell => cell.length > 0)) {
      lines.push(row);
    }
  }

  if (lines.length < 2) return [];

  const headers = lines[0].map(h => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const idIdx = headers.findIndex(h => h.includes('id'));
  const authorIdx = headers.findIndex(h => h.includes('author') || h.includes('user') || h.includes('nama'));
  const textIdx = headers.findIndex(h => h.includes('text') || h.includes('comment') || h.includes('komentar') || h.includes('isi'));
  const likesIdx = headers.findIndex(h => h.includes('like') || h.includes('suka'));
  const dateIdx = headers.findIndex(h => h.includes('date') || h.includes('publish') || h.includes('tanggal') || h.includes('time'));

  const comments = [];
  for (let i = 1; i < lines.length; i++) {
    const r = lines[i];
    const text = textIdx !== -1 && r[textIdx] !== undefined ? r[textIdx] : (r[2] || r[1] || r[0] || '');
    if (!text) continue;

    comments.push({
      id: idIdx !== -1 && r[idIdx] ? r[idIdx] : `csv_${i}`,
      snippet: {
        topLevelComment: {
          snippet: {
            authorDisplayName: authorIdx !== -1 && r[authorIdx] ? r[authorIdx] : `@WargaNet_${i}`,
            textDisplay: text,
            likeCount: likesIdx !== -1 && r[likesIdx] ? parseInt(r[likesIdx], 10) || 0 : 0,
            publishedAt: dateIdx !== -1 && r[dateIdx] ? r[dateIdx] : new Date().toISOString()
          }
        }
      }
    });
  }

  return comments;
}

/**
 * Muat Data Offline dari Direktori data/pidato_presiden_evaluasi.csv
 */
async function loadOfflineCsvData() {
  const statusEl = document.getElementById('api-status');
  const sourceLabel = document.getElementById('data-source-label');
  const progressBox = document.getElementById('progress-box');
  if (progressBox) progressBox.style.display = 'none';

  try {
    const response = await fetch('data/pidato_presiden_evaluasi.csv');
    if (!response.ok) {
      throw new Error(`Gagal memuat file CSV: HTTP ${response.status}`);
    }
    const csvText = await response.text();
    const parsed = parseCSV(csvText);

    if (parsed.length > 0) {
      currentDataset = parsed;
      if (statusEl) {
        statusEl.className = 'status-badge success';
        statusEl.textContent = `Sukses memuat ${currentDataset.length} komentar dari direktori data/pidato_presiden_evaluasi.csv (Offline).`;
      }
      if (sourceLabel) {
        sourceLabel.textContent = `File CSV: data/pidato_presiden_evaluasi.csv (${currentDataset.length} Komentar)`;
      }
      renderRawCommentsPreview(currentDataset);
      runMapReducePipeline();
      return;
    }
  } catch (err) {
    console.warn('Fetch CSV lokal gagal (mungkin protokol file:///), fallback ke sample-data.js:', err);
  }

  // Fallback ke sample data jika fetch CSV tidak diizinkan oleh browser
  if (typeof SAMPLE_YOUTUBE_COMMENTS !== 'undefined') {
    currentDataset = [...SAMPLE_YOUTUBE_COMMENTS];
  } else {
    currentDataset = [];
  }

  if (statusEl) {
    statusEl.className = 'status-badge info';
    statusEl.textContent = `Menggunakan ${currentDataset.length} sample komentar pidato presiden dari direktori lokal.`;
  }
  if (sourceLabel) {
    sourceLabel.textContent = `Data Offline (${currentDataset.length} Komentar Warga)`;
  }

  renderRawCommentsPreview(currentDataset);
  runMapReducePipeline();
}

/**
 * Handler Unggah File CSV Lokal Kustom
 */
function handleFileUploadCsv(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const csvText = event.target.result;
      const parsed = parseCSV(csvText);
      if (parsed.length === 0) {
        alert('File CSV kosong atau format kolom tidak terbaca!');
        return;
      }

      currentDataset = parsed;
      const statusEl = document.getElementById('api-status');
      const sourceLabel = document.getElementById('data-source-label');

      if (statusEl) {
        statusEl.className = 'status-badge success';
        statusEl.textContent = `Sukses memuat ${parsed.length} komentar dari file "${file.name}".`;
      }
      if (sourceLabel) {
        sourceLabel.textContent = `File CSV: ${file.name} (${parsed.length} Komentar)`;
      }

      renderRawCommentsPreview(currentDataset);
      runMapReducePipeline();

    } catch (err) {
      alert(`Gagal memproses file CSV: ${err.message}`);
    }
  };
  reader.readAsText(file);
}

/**
 * Unduh Dataset Aktif ke File CSV
 */
function handleExportCsv() {
  if (!currentDataset || currentDataset.length === 0) {
    alert('Dataset komentar kosong, tidak ada yang dapat diunduh!');
    return;
  }

  let csvContent = 'id,authorDisplayName,textDisplay,likeCount,publishedAt\r\n';
  currentDataset.forEach((item, idx) => {
    const s = item.snippet?.topLevelComment?.snippet || {};
    const id = item.id || `c_${idx + 1}`;
    const author = (s.authorDisplayName || '').replace(/"/g, '""');
    const text = (s.textDisplay || '').replace(/"/g, '""');
    const likes = s.likeCount || 0;
    const date = s.publishedAt || '';
    csvContent += `"${id}","${author}","${text}",${likes},"${date}"\r\n`;
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `komentar_youtube_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * MENGAMBIL SELURUH KOMENTAR DENGAN MEKANISME PAGINATION (nextPageToken)
 */
async function fetchAllYouTubeComments({ apiKey, videoId, targetLimit, onProgress, signal }) {
  let allComments = [];
  let nextPageToken = null;
  let pageCount = 0;
  const isFetchAll = targetLimit === 'all' || targetLimit === 0;
  const numericLimit = isFetchAll ? Infinity : parseInt(targetLimit, 10);

  do {
    const url = new URL('https://www.googleapis.com/youtube/v3/commentThreads');
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('videoId', videoId);
    
    const batchSize = Math.min(100, isFetchAll ? 100 : (numericLimit - allComments.length));
    url.searchParams.set('maxResults', batchSize.toString());
    url.searchParams.set('order', 'relevance'); // Default urutan paling relevan
    url.searchParams.set('textFormat', 'plainText');
    url.searchParams.set('key', apiKey);

    if (nextPageToken) {
      url.searchParams.set('pageToken', nextPageToken);
    }

    const response = await fetch(url.toString(), { signal });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(`Error API YouTube (Hal ${pageCount + 1}): ${message}`);
    }

    const data = await response.json();
    const items = data.items || [];
    allComments = allComments.concat(items);

    pageCount++;
    nextPageToken = data.nextPageToken || null;

    if (onProgress) {
      onProgress({
        loaded: allComments.length,
        pages: pageCount,
        hasMore: !!nextPageToken,
        isFetchAll
      });
    }

    if (!isFetchAll && allComments.length >= numericLimit) {
      allComments = allComments.slice(0, numericLimit);
      break;
    }

  } while (nextPageToken && (!signal || !signal.aborted));

  return allComments;
}

/**
 * Handler saat tombol "Ambil Komentar YouTube API" ditekan
 * Dilengkapi Caching Lokal: Jika URL/Video ID sudah pernah ditarik, tidak memanggil API lagi!
 */
async function handleFetchYouTubeComments() {
  const apiKeyEl = document.getElementById('api-key');
  const videoInputEl = document.getElementById('video-input');
  const limitSelectEl = document.getElementById('limit-select');

  const apiKey = apiKeyEl ? apiKeyEl.value.trim() : '';
  const rawVideoInput = videoInputEl ? videoInputEl.value.trim() : '';
  const targetLimit = limitSelectEl ? limitSelectEl.value : '150';
  
  const statusEl = document.getElementById('api-status');
  const btnFetch = document.getElementById('btn-fetch');
  const btnStop = document.getElementById('btn-stop');
  const progressBox = document.getElementById('progress-box');
  const progressFill = document.getElementById('progress-bar-fill');
  const progressStatus = document.getElementById('progress-status-text');
  const progressCounter = document.getElementById('progress-counter-text');
  const sourceLabel = document.getElementById('data-source-label');

  const videoId = extractVideoId(rawVideoInput);
  if (!videoId) {
    alert('Masukkan URL Video YouTube atau Video ID pidato yang valid!');
    return;
  }

  // ----------------------------------------------------
  // CEK CACHE DATA LOKAL TERLEBIH DAHULU:
  // Jika URL/ID sama, langsung gunakan data lokal tanpa memanggil API
  // ----------------------------------------------------
  try {
    const cachedData = localStorage.getItem(`mr_cache_video_${videoId}`);
    if (cachedData) {
      const parsedCache = JSON.parse(cachedData);
      if (Array.isArray(parsedCache) && parsedCache.length > 0) {
        currentDataset = parsedCache;
        if (statusEl) {
          statusEl.className = 'status-badge info';
          statusEl.textContent = `Data Video ID "${videoId}" ditemukan di cache lokal (${currentDataset.length.toLocaleString('id-ID')} komentar). Memuat langsung tanpa kuota API.`;
        }
        if (sourceLabel) {
          sourceLabel.textContent = `Cache Lokal (${currentDataset.length.toLocaleString('id-ID')} Komentar - ID: ${videoId})`;
        }
        renderRawCommentsPreview(currentDataset);
        runMapReducePipeline();
        return;
      }
    }
  } catch (e) {
    console.warn('Gagal membaca cache lokal:', e);
  }

  // Jika belum ada di cache, periksa API Key
  if (!apiKey) {
    alert('Data untuk video ini belum ada di cache lokal. Masukkan Google YouTube API Key Anda, atau klik "Gunakan Data Offline (CSV)"!');
    return;
  }

  currentAbortController = new AbortController();
  if (btnFetch) btnFetch.style.display = 'none';
  if (btnStop) btnStop.style.display = 'inline-flex';
  if (progressBox) progressBox.style.display = 'block';
  if (progressFill) progressFill.style.width = '10%';
  if (progressStatus) progressStatus.textContent = 'Menghubungi server YouTube API...';
  if (progressCounter) progressCounter.textContent = '0 komentar';

  if (statusEl) {
    statusEl.className = 'status-badge info';
    statusEl.textContent = `Memulai penarikan data dari video: "${videoId}"...`;
  }

  try {
    const comments = await fetchAllYouTubeComments({
      apiKey,
      videoId,
      targetLimit,
      signal: currentAbortController.signal,
      onProgress: ({ loaded, pages, hasMore, isFetchAll }) => {
        if (progressStatus) {
          progressStatus.textContent = `Mengambil batch ke-${pages} ${hasMore ? '(Ada halaman lanjutan)' : '(Komentar habis)'}`;
        }
        if (progressCounter) {
          progressCounter.textContent = `${loaded.toLocaleString('id-ID')} komentar`;
        }
        
        if (progressFill) {
          if (!isFetchAll) {
            const targetNum = parseInt(targetLimit, 10);
            const pct = Math.min(100, Math.round((loaded / targetNum) * 100));
            progressFill.style.width = `${pct}%`;
          } else {
            progressFill.style.width = `${(pages * 15) % 100}%`;
          }
        }
      }
    });

    if (comments.length === 0) {
      if (statusEl) {
        statusEl.className = 'status-badge warning';
        statusEl.textContent = 'Tidak ada komentar ditemukan atau kolom komentar dinonaktifkan pada video ini.';
      }
      return;
    }

    currentDataset = comments;

    // Simpan ke Cache Lokal agar pemanggilan berikutnya instan
    try {
      localStorage.setItem(`mr_cache_video_${videoId}`, JSON.stringify(comments));
    } catch (e) {
      console.warn('Kapasitas localStorage penuh untuk cache video:', e);
    }

    if (statusEl) {
      statusEl.className = 'status-badge success';
      statusEl.textContent = `Sukses! Total ${comments.length.toLocaleString('id-ID')} komentar berhasil diunduh via Pagination API & tersimpan ke cache lokal.`;
    }

    if (progressFill) progressFill.style.width = '100%';
    if (progressStatus) progressStatus.textContent = 'Selesai mengambil komentar!';
    if (progressCounter) progressCounter.textContent = `${comments.length.toLocaleString('id-ID')} komentar`;

    if (sourceLabel) {
      sourceLabel.textContent = `Live YouTube API (${comments.length.toLocaleString('id-ID')} Komentar - ID: ${videoId})`;
    }

    renderRawCommentsPreview(currentDataset);
    runMapReducePipeline();

  } catch (err) {
    if (err.name === 'AbortError') {
      if (statusEl) {
        statusEl.className = 'status-badge warning';
        statusEl.textContent = `Penarikan dihentikan pengguna. Berhasil menyimpan ${currentDataset.length} komentar yang sudah terambil.`;
      }
    } else {
      console.error(err);
      if (statusEl) {
        statusEl.className = 'status-badge error';
        statusEl.textContent = `Error: ${err.message}`;
      }
      alert(`Gagal mengambil komentar:\n${err.message}\n\nPastikan API Key benar dan video memiliki komentar aktif.`);
    }
  } finally {
    if (btnFetch) btnFetch.style.display = 'inline-flex';
    if (btnStop) btnStop.style.display = 'none';
    currentAbortController = null;
  }
}

function handleStopFetching() {
  if (currentAbortController) {
    currentAbortController.abort();
  }
}

/**
 * Eksekusi Pipeline MapReduce
 */
function runMapReducePipeline() {
  if (!currentDataset || currentDataset.length === 0) {
    alert('Dataset komentar kosong! Klik "Gunakan Data Offline (CSV)" atau ambil dari YouTube API terlebih dahulu.');
    return;
  }

  const selectedJobKey = currentActiveJob;
  const job = (typeof MapReduceJobs !== 'undefined') ? MapReduceJobs[selectedJobKey] : null;
  if (!job) return;

  const engine = new MapReduceEngine(job.map, job.reduce);
  const result = engine.run(currentDataset);
  currentResult = result;

  // Update Metrik
  const elInputCount = document.getElementById('metric-input-count');
  const elIntermediateCount = document.getElementById('metric-intermediate-count');
  const elUniqueKeys = document.getElementById('metric-unique-keys');
  const elDuration = document.getElementById('metric-duration');

  if (elInputCount) elInputCount.textContent = result.inputCount.toLocaleString('id-ID');
  if (elIntermediateCount) elIntermediateCount.textContent = result.intermediateCount.toLocaleString('id-ID');
  if (elUniqueKeys) elUniqueKeys.textContent = result.uniqueKeysCount.toLocaleString('id-ID');
  if (elDuration) elDuration.textContent = `${result.durationMs} ms`;

  // Render Visualisasi Tiap Tahapan MapReduce
  renderMapStage(result.intermediate);
  renderShuffleStage(result.grouped);
  renderReduceStage(result.finalResult, job, selectedJobKey);
  renderChart(result.finalResult, job, selectedJobKey);
  renderRawCommentsPreview(currentDataset);
}

function updateJobExplanation() {
  const selectedJobKey = currentActiveJob;
  const job = (typeof MapReduceJobs !== 'undefined') ? MapReduceJobs[selectedJobKey] : null;
  if (!job) return;

  const jobTitle = document.getElementById('job-title');
  const jobDesc = document.getElementById('job-desc');
  const chartTitle = document.getElementById('chart-title');
  const codeMap = document.getElementById('code-map');
  const codeReduce = document.getElementById('code-reduce');

  if (jobTitle) jobTitle.textContent = job.name;
  if (jobDesc) jobDesc.textContent = job.description;
  if (chartTitle) chartTitle.textContent = `Visualisasi: ${job.name}`;
  if (codeMap) codeMap.textContent = job.map.toString();
  if (codeReduce) codeReduce.textContent = job.reduce.toString();
}

/**
 * Deteksi kata kunci pada tiap komentar untuk visualisasi proses Mapper
 */
function getCommentDetectedKeywords(text, jobKey) {
  if (!text) return null;
  const lower = text.toLowerCase();

  const activePolicy = (typeof window.getPolicyCategories === 'function') ? window.getPolicyCategories() : (window.PolicyCategories || {});
  const activePos = (typeof window.getLexiconPositif === 'function') ? window.getLexiconPositif() : (window.LexiconPositif || new Set());
  const activeNeg = (typeof window.getLexiconNegatif === 'function') ? window.getLexiconNegatif() : (window.LexiconNegatif || new Set());
  const activeStop = (typeof window.getStopWordsIndo === 'function') ? window.getStopWordsIndo() : (window.StopWordsIndo || new Set());

  if (jobKey === 'sentimentAnalysis') {
    const words = lower.replace(/[^\w\s]/g, ' ').split(/\s+/);
    const pos = [];
    const neg = [];
    words.forEach(w => {
      if (activePos.has(w) && !pos.includes(w)) pos.push(w);
      if (activeNeg.has(w) && !neg.includes(w)) neg.push(w);
    });

    let sentiment = 'Netral';
    if (pos.length > neg.length) sentiment = 'Positif';
    else if (neg.length > pos.length) sentiment = 'Negatif';

    return { type: 'sentiment', pos, neg, sentiment };

  } else if (jobKey === 'policyEvaluation') {
    const matched = [];
    for (const [sector, keywords] of Object.entries(activePolicy)) {
      const found = keywords.filter(k => lower.includes(k.toLowerCase()));
      if (found.length > 0) {
        matched.push({ sector, found });
      }
    }
    return { type: 'policy', matched };

  } else if (jobKey === 'aspirasiWordCount') {
    const words = lower.replace(/[^\w\s\u00C0-\u017F]/g, ' ').split(/\s+/);
    const passed = [];
    words.forEach(w => {
      if (w.length > 3 && !activeStop.has(w) && !/^\d+$/.test(w) && !passed.includes(w)) {
        passed.push(w);
      }
    });
    return { type: 'words', words: passed };
  }

  return null;
}

/**
 * Preview Komentar Mentah Beserta Penandaan Kata Kunci Terdeteksi
 * Memberikan kepastian bahwa seluruh komentar telah selesai diproses oleh MapReduce.
 */
function renderRawCommentsPreview(data) {
  const container = document.getElementById('raw-data-preview');
  if (!container) return;
  container.innerHTML = '';

  const selectedJobKey = currentActiveJob;
  const totalComments = data.length;
  const displayItems = showAllComments ? data : data.slice(0, 5);

  displayItems.forEach((item, idx) => {
    const snippet = item.snippet?.topLevelComment?.snippet || {};
    const text = snippet.textDisplay || '';
    const detection = getCommentDetectedKeywords(text, selectedJobKey);

    let detectionHtml = '';
    if (detection) {
      if (detection.type === 'sentiment') {
        const posTags = detection.pos.map(w => `<span class="word-pill pos">+${escapeHtml(w)}</span>`).join(' ');
        const negTags = detection.neg.map(w => `<span class="word-pill neg">-${escapeHtml(w)}</span>`).join(' ');
        const hasWords = detection.pos.length > 0 || detection.neg.length > 0;
        
        detectionHtml = `
          <div class="comment-detected-box">
            <span class="detected-label">Kata Kunci Leksikon Terdeteksi:</span>
            ${hasWords ? `${posTags} ${negTags}` : '<span style="color: #64748b; font-style: italic;">Tidak ada leksikon spesifik (Netral)</span>'}
            <span style="margin-left: auto; font-weight: 700; color: ${detection.sentiment === 'Positif' ? '#166534' : detection.sentiment === 'Negatif' ? '#991b1b' : '#475569'};">
              &rarr; Map: ${detection.sentiment}
            </span>
          </div>
        `;
      } else if (detection.type === 'policy') {
        if (detection.matched.length > 0) {
          const sectorPills = detection.matched.map(m => 
            `<span class="word-pill sector-item"><strong>${escapeHtml(m.sector)}</strong>: [${m.found.map(escapeHtml).join(', ')}]</span>`
          ).join(' ');
          detectionHtml = `
            <div class="comment-detected-box">
              <span class="detected-label">Kata Kunci Sektor Terdeteksi:</span>
              ${sectorPills}
            </div>
          `;
        } else {
          detectionHtml = `
            <div class="comment-detected-box">
              <span class="detected-label">Kata Kunci Sektor:</span>
              <span style="color: #64748b; font-style: italic;">Tidak cocok kata kunci sektor spesifik &rarr; Map ke "Sektor Kebijakan Lainnya"</span>
            </div>
          `;
        }
      } else if (detection.type === 'words') {
        const wordPills = detection.words.slice(0, 8).map(w => `<span class="word-pill sector-item">${escapeHtml(w)}</span>`).join(' ');
        detectionHtml = `
          <div class="comment-detected-box">
            <span class="detected-label">Kata Bermakna Di-emit (Non-Stopwords):</span>
            ${wordPills || '<span style="color: #64748b;">Semua kata terfilter</span>'}
          </div>
        `;
      }
    }

    const card = document.createElement('div');
    card.className = 'raw-item-card';
    card.innerHTML = `
      <div class="raw-item-header">
        <span class="badge" style="background: #000; color: #fff;">#${idx + 1}</span>
        <strong>${escapeHtml(snippet.authorDisplayName || 'Netizen')}</strong>
        <span style="margin-left: auto; color: #334155; font-size: 0.78rem; font-weight: 600;">Suka: ${Number(snippet.likeCount || 0).toLocaleString('id-ID')}</span>
      </div>
      <p style="font-size: 0.88rem; color: #1e293b; margin: 0.35rem 0;">"${escapeHtml(text)}"</p>
      ${detectionHtml}
      <div class="raw-item-meta">
        <span>Tanggal: ${snippet.publishedAt ? snippet.publishedAt.substring(0, 10) : '-'}</span>
      </div>
    `;
    container.appendChild(card);
  });

  // Perbaikan status pagination notice: Menghilangkan kesan proses yang sedang menggantung
  const noticeEl = document.getElementById('comments-count-notice');
  const btnToggle = document.getElementById('btn-toggle-all-comments');

  if (noticeEl) {
    if (totalComments <= 5) {
      noticeEl.textContent = `Menampilkan seluruh ${totalComments} komentar yang telah selesai diproses oleh MapReduce.`;
      if (btnToggle) btnToggle.style.display = 'none';
    } else {
      if (showAllComments) {
        noticeEl.textContent = `Menampilkan seluruh ${totalComments} komentar yang telah selesai diproses oleh MapReduce.`;
        if (btnToggle) {
          btnToggle.style.display = 'inline-block';
          btnToggle.textContent = 'Tampilkan 5 Sampel Saja';
        }
      } else {
        noticeEl.textContent = `Selesai memproses ${totalComments} komentar. Menampilkan 5 sampel teratas:`;
        if (btnToggle) {
          btnToggle.style.display = 'inline-block';
          btnToggle.textContent = `Tampilkan Seluruh Komentar (${totalComments})`;
        }
      }
    }
  }
}

/**
 * Preview Pasangan [K, V] dari Map Phase
 */
function renderMapStage(intermediate) {
  const container = document.getElementById('map-output-preview');
  const noticeEl = document.getElementById('map-chip-notice');
  if (!container) return;
  container.innerHTML = '';

  const sampleItems = intermediate.slice(0, 18);
  sampleItems.forEach(item => {
    const chip = document.createElement('div');
    chip.className = 'kv-chip';

    let displayVal = item.value;
    if (typeof item.value === 'object') {
      displayVal = `cnt:${item.value.count}, lk:${item.value.likes}`;
    }

    chip.innerHTML = `<span class="k">${escapeHtml(String(item.key))}</span><span class="sep">:</span><span class="v">${escapeHtml(String(displayVal))}</span>`;
    container.appendChild(chip);
  });

  if (noticeEl) {
    if (intermediate.length > 18) {
      noticeEl.textContent = `Menampilkan 18 sampel chip dari total ${intermediate.length.toLocaleString('id-ID')} pasangan [Key, Value] yang selesai dipetakan oleh Mapper.`;
    } else {
      noticeEl.textContent = `Total ${intermediate.length.toLocaleString('id-ID')} pasangan [Key, Value] selesai dipetakan oleh Mapper.`;
    }
  }
}

/**
 * Preview Grouping Shuffle Phase
 */
function renderShuffleStage(grouped) {
  const container = document.getElementById('shuffle-output-preview');
  if (!container) return;
  container.innerHTML = '';

  const keys = Object.keys(grouped).slice(0, 8);
  keys.forEach(key => {
    const row = document.createElement('div');
    row.className = 'shuffle-row';

    const vals = grouped[key];
    const previewVals = vals.slice(0, 4).map(v => typeof v === 'object' ? `[c:${v.count}, l:${v.likes}]` : v).join(', ');
    const extra = vals.length > 4 ? `, ... (+${vals.length - 4})` : '';

    row.innerHTML = `
      <div class="shuffle-key"><strong>${escapeHtml(key)}</strong> <span class="badge" style="background:#e2e8f0; color:#0f172a;">${vals.length} item</span></div>
      <div class="shuffle-values">[ ${escapeHtml(previewVals)}${extra} ]</div>
    `;
    container.appendChild(row);
  });

  const totalKeys = Object.keys(grouped).length;
  if (totalKeys > 8) {
    const more = document.createElement('div');
    more.className = 'more-notice';
    more.textContent = `... dan ${totalKeys - 8} kelompok key lainnya selesai dikelompokkan oleh framework.`;
    container.appendChild(more);
  }
}

/**
 * Render Tabel Hasil Reduce Phase
 */
function renderReduceStage(finalResult, job, jobKey) {
  const tbody = document.getElementById('reduce-table-body');
  if (!tbody) return;
  tbody.innerHTML = '';

  const sorted = [...finalResult].sort((a, b) => {
    const valA = typeof a.value === 'object' ? a.value.count || 0 : a.value;
    const valB = typeof b.value === 'object' ? b.value.count || 0 : b.value;
    return valB - valA;
  });

  sorted.slice(0, 15).forEach((item, index) => {
    const tr = document.createElement('tr');

    let formattedVal = '';
    if (typeof item.value === 'object') {
      formattedVal = `<strong>${item.value.count.toLocaleString('id-ID')} Komentar</strong> &nbsp;<span style="color: #334155; font-weight: 600;">(Dukungan: ${item.value.likes.toLocaleString('id-ID')} likes)</span>`;
    } else {
      formattedVal = `<strong>${Number(item.value).toLocaleString('id-ID')} kali muncul</strong>`;
    }

    tr.innerHTML = `
      <td>#${index + 1}</td>
      <td><strong>${escapeHtml(item.key)}</strong></td>
      <td>${formattedVal}</td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Render Visualisasi Chart
 */
function renderChart(finalResult, job, jobKey) {
  const canvas = document.getElementById('result-chart');
  if (!canvas || typeof Chart === 'undefined') return;

  const ctx = canvas.getContext('2d');
  if (activeChart) {
    activeChart.destroy();
  }

  const sorted = [...finalResult].sort((a, b) => {
    const valA = typeof a.value === 'object' ? a.value.count || 0 : a.value;
    const valB = typeof b.value === 'object' ? b.value.count || 0 : b.value;
    return valB - valA;
  });

  const isSentiment = jobKey === 'sentimentAnalysis';
  const displayItems = isSentiment ? sorted : sorted.slice(0, 10);

  const labels = displayItems.map(item => item.key);
  const dataValues = displayItems.map(item => typeof item.value === 'object' ? item.value.count : item.value);

  const textColor = '#0f172a';
  const gridColor = 'rgba(0, 0, 0, 0.08)';

  if (isSentiment) {
    activeChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: dataValues,
          backgroundColor: [
            'rgba(22, 163, 74, 0.85)',
            'rgba(220, 38, 38, 0.85)',
            'rgba(100, 116, 139, 0.85)'
          ],
          borderColor: ['#16a34a', '#dc2626', '#64748b'],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: textColor, font: { weight: 'bold', size: 12 } }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const val = context.raw;
                const pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
                return ` ${context.label}: ${val.toLocaleString('id-ID')} komentar (${pct}%)`;
              }
            }
          }
        }
      }
    });
  } else {
    activeChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: job.metricLabel,
          data: dataValues,
          backgroundColor: 'rgba(37, 99, 235, 0.85)',
          borderColor: '#1d4ed8',
          borderWidth: 2,
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: { color: textColor, font: { weight: 'bold' } }
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return ` ${job.metricLabel}: ${context.raw.toLocaleString('id-ID')}`;
              }
            }
          }
        },
        scales: {
          x: {
            ticks: { color: textColor, maxRotation: 35, minRotation: 0, font: { weight: '600' } },
            grid: { color: gridColor }
          },
          y: {
            beginAtZero: true,
            ticks: {
              color: textColor,
              precision: 0,
              callback: function(val) {
                return val.toLocaleString('id-ID');
              }
            },
            grid: { color: gridColor }
          }
        }
      }
    });
  }
}

/**
 * ========================================================
 * LOGIKA MANAJEMEN KATA KUNCI & LEKSIKON (TAB 2)
 * Kustomisasi Kata: Tambah, Hapus & Reset secara Lokal (Tanpa Emoji)
 * ========================================================
 */
function setupKeywordsCrud() {
  const btnReset = document.getElementById('btn-reset-keywords');
  const btnApplyAndRun = document.getElementById('btn-apply-and-run');
  const btnAddSectorWord = document.getElementById('btn-add-sector-word');
  const btnAddPos = document.getElementById('btn-add-pos-word');
  const btnAddNeg = document.getElementById('btn-add-neg-word');
  const btnAddStopword = document.getElementById('btn-add-stopword');

  if (btnReset) {
    btnReset.addEventListener('click', () => {
      if (confirm('Kembalikan seluruh kata kunci, leksikon, dan stop words ke nilai default bawaan sistem?')) {
        if (typeof window.resetKeywordsToDefault === 'function') {
          window.resetKeywordsToDefault();
        }
        renderKeywordsCrudUI();
        showToast('Kata kunci dan leksikon berhasil di-reset ke nilai default bawaan.');
        if (currentDataset && currentDataset.length > 0) {
          runMapReducePipeline();
        }
      }
    });
  }

  if (btnApplyAndRun) {
    btnApplyAndRun.addEventListener('click', () => {
      const dashBtn = document.getElementById('tab-btn-dashboard');
      if (dashBtn) dashBtn.click();
      runMapReducePipeline();
      showToast('Perubahan kata kunci diterapkan dan MapReduce berhasil dieksekusi.');
    });
  }

  // Tambah kata kunci ke sektor
  if (btnAddSectorWord) {
    btnAddSectorWord.addEventListener('click', () => {
      const sectorSelect = document.getElementById('crud-sector-select');
      const wordInput = document.getElementById('crud-sector-word-input');
      const sector = sectorSelect ? sectorSelect.value : '';
      const word = wordInput ? wordInput.value.trim().toLowerCase() : '';

      if (!sector || !word) {
        alert('Pilih sektor dan masukkan kata kunci terlebih dahulu!');
        return;
      }

      const policy = (typeof window.getPolicyCategories === 'function') ? window.getPolicyCategories() : window.PolicyCategories;
      if (policy && policy[sector]) {
        if (!policy[sector].includes(word)) {
          policy[sector].push(word);
          if (typeof window.setPolicyCategories === 'function') {
            window.setPolicyCategories(policy);
          }
          wordInput.value = '';
          renderKeywordsCrudUI();
          showToast(`Kata "${word}" berhasil ditambahkan ke sektor "${sector}".`);
          if (currentDataset && currentDataset.length > 0) runMapReducePipeline();
        } else {
          alert(`Kata "${word}" sudah ada di sektor tersebut.`);
        }
      }
    });
  }

  // Tambah kata positif
  if (btnAddPos) {
    btnAddPos.addEventListener('click', () => {
      const input = document.getElementById('crud-pos-input');
      const word = input ? input.value.trim().toLowerCase() : '';
      if (!word) return;

      const posSet = (typeof window.getLexiconPositif === 'function') ? window.getLexiconPositif() : window.LexiconPositif;
      posSet.add(word);
      if (typeof window.setLexiconPositif === 'function') {
        window.setLexiconPositif(posSet);
      }
      input.value = '';
      renderKeywordsCrudUI();
      showToast(`Kata positif "${word}" berhasil ditambahkan.`);
      if (currentDataset && currentDataset.length > 0) runMapReducePipeline();
    });
  }

  // Tambah kata negatif
  if (btnAddNeg) {
    btnAddNeg.addEventListener('click', () => {
      const input = document.getElementById('crud-neg-input');
      const word = input ? input.value.trim().toLowerCase() : '';
      if (!word) return;

      const negSet = (typeof window.getLexiconNegatif === 'function') ? window.getLexiconNegatif() : window.LexiconNegatif;
      negSet.add(word);
      if (typeof window.setLexiconNegatif === 'function') {
        window.setLexiconNegatif(negSet);
      }
      input.value = '';
      renderKeywordsCrudUI();
      showToast(`Kata negatif "${word}" berhasil ditambahkan.`);
      if (currentDataset && currentDataset.length > 0) runMapReducePipeline();
    });
  }

  // Tambah stopword
  if (btnAddStopword) {
    btnAddStopword.addEventListener('click', () => {
      const input = document.getElementById('crud-stopword-input');
      const word = input ? input.value.trim().toLowerCase() : '';
      if (!word) return;

      const stopSet = (typeof window.getStopWordsIndo === 'function') ? window.getStopWordsIndo() : window.StopWordsIndo;
      stopSet.add(word);
      if (typeof window.setStopWordsIndo === 'function') {
        window.setStopWordsIndo(stopSet);
      }
      input.value = '';
      renderKeywordsCrudUI();
      showToast(`Stopword "${word}" berhasil ditambahkan ke filter eliminasi.`);
      if (currentDataset && currentDataset.length > 0) runMapReducePipeline();
    });
  }
}

function showToast(message) {
  const toast = document.getElementById('toast-msg');
  if (!toast) return;
  toast.innerHTML = `&#10003; ${escapeHtml(message)}`;
  toast.style.display = 'block';
  setTimeout(() => {
    toast.style.display = 'none';
  }, 4000);
}

/**
 * Render Tampilan Manajemen Kata Kunci di Tab 2 (Bebas Emoji)
 */
function renderKeywordsCrudUI() {
  const policy = (typeof window.getPolicyCategories === 'function') ? window.getPolicyCategories() : (window.PolicyCategories || {});
  const posSet = (typeof window.getLexiconPositif === 'function') ? window.getLexiconPositif() : (window.LexiconPositif || new Set());
  const negSet = (typeof window.getLexiconNegatif === 'function') ? window.getLexiconNegatif() : (window.LexiconNegatif || new Set());
  const stopSet = (typeof window.getStopWordsIndo === 'function') ? window.getStopWordsIndo() : (window.StopWordsIndo || new Set());

  // 1. Dropdown Sektor
  const sectorSelect = document.getElementById('crud-sector-select');
  if (sectorSelect) {
    const currentVal = sectorSelect.value;
    sectorSelect.innerHTML = Object.keys(policy).map(s => 
      `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`
    ).join('');
    if (currentVal && policy[currentVal]) sectorSelect.value = currentVal;
  }

  // 2. Grid Sektor
  const sectorsContainer = document.getElementById('crud-sectors-container');
  if (sectorsContainer) {
    sectorsContainer.innerHTML = Object.entries(policy).map(([sectorName, keywords]) => `
      <div class="sector-card">
        <div class="sector-card-header">
          <span>${escapeHtml(sectorName)}</span>
          <span class="badge" style="background:#eff6ff; color:#1d4ed8; border-color:#bfdbfe;">${keywords.length} kata</span>
        </div>
        <div class="sector-card-keywords">
          ${keywords.map(kw => `
            <span class="word-pill-crud sector-item">
              <span>${escapeHtml(kw)}</span>
              <button class="pill-del-btn" data-action="del-sector-word" data-sector="${escapeHtml(sectorName)}" data-word="${escapeHtml(kw)}" title="Hapus kata">&times;</button>
            </span>
          `).join('')}
        </div>
      </div>
    `).join('');
  }

  // 3. Positif Leksikon
  const posContainer = document.getElementById('crud-pos-container');
  const posCountBadge = document.getElementById('crud-pos-count');
  const posArr = Array.from(posSet);
  if (posCountBadge) posCountBadge.textContent = `${posArr.length} Kata`;
  if (posContainer) {
    posContainer.innerHTML = posArr.map(kw => `
      <span class="word-pill-crud pos">
        <span>${escapeHtml(kw)}</span>
        <button class="pill-del-btn" data-action="del-pos-word" data-word="${escapeHtml(kw)}" title="Hapus kata">&times;</button>
      </span>
    `).join('');
  }

  // 4. Negatif Leksikon
  const negContainer = document.getElementById('crud-neg-container');
  const negCountBadge = document.getElementById('crud-neg-count');
  const negArr = Array.from(negSet);
  if (negCountBadge) negCountBadge.textContent = `${negArr.length} Kata`;
  if (negContainer) {
    negContainer.innerHTML = negArr.map(kw => `
      <span class="word-pill-crud neg">
        <span>${escapeHtml(kw)}</span>
        <button class="pill-del-btn" data-action="del-neg-word" data-word="${escapeHtml(kw)}" title="Hapus kata">&times;</button>
      </span>
    `).join('');
  }

  // 5. Stopwords
  const stopContainer = document.getElementById('crud-stopwords-container');
  const stopCountBadge = document.getElementById('crud-stopwords-count');
  const stopArr = Array.from(stopSet);
  if (stopCountBadge) stopCountBadge.textContent = `${stopArr.length} Kata`;
  if (stopContainer) {
    stopContainer.innerHTML = stopArr.map(kw => `
      <span class="word-pill-crud stopword">
        <span>${escapeHtml(kw)}</span>
        <button class="pill-del-btn" data-action="del-stop-word" data-word="${escapeHtml(kw)}" title="Hapus stopword">&times;</button>
      </span>
    `).join('');
  }

  setupDeleteButtons();
}

function setupDeleteButtons() {
  document.querySelectorAll('.pill-del-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      const action = btn.getAttribute('data-action');
      const word = btn.getAttribute('data-word');

      if (action === 'del-sector-word') {
        const sector = btn.getAttribute('data-sector');
        const policy = (typeof window.getPolicyCategories === 'function') ? window.getPolicyCategories() : window.PolicyCategories;
        if (policy && policy[sector]) {
          policy[sector] = policy[sector].filter(w => w !== word);
          if (typeof window.setPolicyCategories === 'function') {
            window.setPolicyCategories(policy);
          }
          renderKeywordsCrudUI();
          showToast(`Kata "${word}" dihapus dari sektor "${sector}".`);
          if (currentDataset && currentDataset.length > 0) runMapReducePipeline();
        }
      } else if (action === 'del-pos-word') {
        const posSet = (typeof window.getLexiconPositif === 'function') ? window.getLexiconPositif() : window.LexiconPositif;
        posSet.delete(word);
        if (typeof window.setLexiconPositif === 'function') {
          window.setLexiconPositif(posSet);
        }
        renderKeywordsCrudUI();
        showToast(`Kata positif "${word}" dihapus.`);
        if (currentDataset && currentDataset.length > 0) runMapReducePipeline();
      } else if (action === 'del-neg-word') {
        const negSet = (typeof window.getLexiconNegatif === 'function') ? window.getLexiconNegatif() : window.LexiconNegatif;
        negSet.delete(word);
        if (typeof window.setLexiconNegatif === 'function') {
          window.setLexiconNegatif(negSet);
        }
        renderKeywordsCrudUI();
        showToast(`Kata negatif "${word}" dihapus.`);
        if (currentDataset && currentDataset.length > 0) runMapReducePipeline();
      } else if (action === 'del-stop-word') {
        const stopSet = (typeof window.getStopWordsIndo === 'function') ? window.getStopWordsIndo() : window.StopWordsIndo;
        stopSet.delete(word);
        if (typeof window.setStopWordsIndo === 'function') {
          window.setStopWordsIndo(stopSet);
        }
        renderKeywordsCrudUI();
        showToast(`Stopword "${word}" dihapus dari filter.`);
        if (currentDataset && currentDataset.length > 0) runMapReducePipeline();
      }
    };
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
