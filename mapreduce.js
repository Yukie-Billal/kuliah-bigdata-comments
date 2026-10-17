/**
 * MapReduce Engine untuk Analisis Komentar YouTube Pidato Presiden
 * Proyek: "Analisis Komentar YouTube Dengan MapReduce Dalam Menerjemahkan 
 *          Respon Netizen Pidato Presiden Menjadi Evaluasi Kebijakan"
 */

class MapReduceEngine {
  constructor(mapFn, reduceFn) {
    this.mapFn = mapFn;
    this.reduceFn = reduceFn;
  }

  run(dataset) {
    const startTime = performance.now();

    // ----------------------------------------------------
    // TAHAP 1: MAP PHASE
    // ----------------------------------------------------
    const intermediate = [];
    const emit = (key, value) => {
      const cleanKey = typeof key === 'string' ? key.trim() : key;
      if (cleanKey !== undefined && cleanKey !== null && cleanKey !== '') {
        intermediate.push({ key: cleanKey, value });
      }
    };

    for (let i = 0; i < dataset.length; i++) {
      this.mapFn(dataset[i], emit, i);
    }

    // ----------------------------------------------------
    // TAHAP 2: SHUFFLE & SORT / GROUPING PHASE
    // ----------------------------------------------------
    const grouped = {};
    for (let i = 0; i < intermediate.length; i++) {
      const { key, value } = intermediate[i];
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(value);
    }

    // ----------------------------------------------------
    // TAHAP 3: REDUCE PHASE
    // ----------------------------------------------------
    const finalResult = [];
    const keys = Object.keys(grouped);

    for (let i = 0; i < keys.length; i++) {
      const key = keys[i];
      const reducedValue = this.reduceFn(key, grouped[key]);
      finalResult.push({ key, value: reducedValue });
    }

    const durationMs = (performance.now() - startTime).toFixed(2);

    return {
      inputCount: dataset.length,
      intermediateCount: intermediate.length,
      uniqueKeysCount: keys.length,
      durationMs,
      intermediate,
      grouped,
      finalResult
    };
  }
}

// ========================================================
// NILAI DEFAULT LEKSIKON & KATA KUNCI KEBIJAKAN
// ========================================================

const DEFAULT_STOP_WORDS = [
  'dan', 'di', 'ke', 'dari', 'yang', 'ini', 'itu', 'untuk', 'dengan', 'pada', 
  'adalah', 'sebagai', 'atau', 'karena', 'bisa', 'akan', 'kita', 'saya', 'kamu',
  'dia', 'mereka', 'oleh', 'saat', 'dalam', 'setelah', 'sudah', 'hanya', 'ada',
  'tidak', 'bukan', 'lagi', 'pun', 'juga', 'bagaimana', 'apa', 'siapa', 'kenapa',
  'pak', 'presiden', 'pidato', 'sangat', 'terlalu', 'masih', 'cuma', 'banyak',
  'kalau', 'bila', 'agar', 'supaya', 'secara', 'harus', 'mohon', 'tolong', 'jangan'
];

const DEFAULT_LEXICON_POSITIF = [
  'semoga', 'bagus', 'optimis', 'membakar', 'semangat', 'berharap', 'keren', 
  'swasembada', 'setuju', 'alhamdulillah', 'berlanjut', 'kompeten', 'berintegritas',
  'terharu', 'bangga', 'disegani', 'kunci', 'nyata', 'mantap', 'hebat', 'tegas', 'maju'
];

const DEFAULT_LEXICON_NEGATIF = [
  'korupsi', 'antrean', 'panjang', 'kosong', 'sulit', 'janji', 'manis', 'dinaikkan',
  'turun', 'drastis', 'susah', 'kecewa', 'bocor', 'kebocoran', 'pungli', 'pungutan',
  'liar', 'berbelit', 'mencekik', 'darurat', 'merusak', 'miskin', 'mahal', 'ilegal'
];

const DEFAULT_POLICY_CATEGORIES = {
  'Ekonomi & Kesejahteraan Rakyat': ['beras', 'telur', 'minyak', 'murah', 'pajak', 'ppn', 'kemiskinan', 'subsidi', 'pupuk', 'umkm', 'daya beli', 'pensiunan'],
  'Pendidikan & Kesejahteraan Guru': ['sekolah', 'guru', 'honorer', 'pendidikan', 'makan bergizi', 'nutrisi'],
  'Kesehatan & Penurunan Stunting': ['kesehatan', 'puskesmas', 'bpjs', 'obat', 'stunting', 'posyandu', 'hamil', 'rumah sakit'],
  'Ketenagakerjaan & Lapangan Kerja': ['lapangan kerja', 'kerja', 'smk', 'sarjana', 'gaji', 'upah', 'pengangguran'],
  'Hukum, Anti Korupsi & Keamanan': ['korupsi', 'hukum', 'transparansi', 'pungutan', 'pungli', 'polisi', 'kepolisian', 'judi', 'siber', 'kebocoran'],
  'Infrastruktur & Pangan': ['infrastruktur', 'transportasi', 'kereta', 'jalan', 'logistik', 'swasembada', 'pangan', 'energi'],
  'Diplomasi & Luar Negeri': ['diplomasi', 'perdamaian', 'dunia', 'bangsa', 'internasional']
};

// Objek kata kunci aktif (dapat diubah dinamis oleh pengguna & disimpan di localStorage)
let StopWordsIndo = new Set(DEFAULT_STOP_WORDS);
let LexiconPositif = new Set(DEFAULT_LEXICON_POSITIF);
let LexiconNegatif = new Set(DEFAULT_LEXICON_NEGATIF);
let PolicyCategories = JSON.parse(JSON.stringify(DEFAULT_POLICY_CATEGORIES));

function initKeywordsFromStorage() {
  try {
    if (typeof localStorage !== 'undefined') {
      const savedPolicy = localStorage.getItem('mr_custom_policy');
      if (savedPolicy) {
        PolicyCategories = JSON.parse(savedPolicy);
      }
      const savedPos = localStorage.getItem('mr_custom_pos');
      if (savedPos) {
        LexiconPositif = new Set(JSON.parse(savedPos));
      }
      const savedNeg = localStorage.getItem('mr_custom_neg');
      if (savedNeg) {
        LexiconNegatif = new Set(JSON.parse(savedNeg));
      }
      const savedStop = localStorage.getItem('mr_custom_stopwords');
      if (savedStop) {
        StopWordsIndo = new Set(JSON.parse(savedStop));
      }
    }
  } catch (e) {
    console.error('Error memuat kata kunci dari localStorage:', e);
  }
}

function saveKeywordsToStorage() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('mr_custom_policy', JSON.stringify(PolicyCategories));
      localStorage.setItem('mr_custom_pos', JSON.stringify(Array.from(LexiconPositif)));
      localStorage.setItem('mr_custom_neg', JSON.stringify(Array.from(LexiconNegatif)));
      localStorage.setItem('mr_custom_stopwords', JSON.stringify(Array.from(StopWordsIndo)));
    }
  } catch (e) {
    console.error('Error menyimpan kata kunci ke localStorage:', e);
  }
}

function resetKeywordsToDefault() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('mr_custom_policy');
      localStorage.removeItem('mr_custom_pos');
      localStorage.removeItem('mr_custom_neg');
      localStorage.removeItem('mr_custom_stopwords');
    }
    StopWordsIndo = new Set(DEFAULT_STOP_WORDS);
    LexiconPositif = new Set(DEFAULT_LEXICON_POSITIF);
    LexiconNegatif = new Set(DEFAULT_LEXICON_NEGATIF);
    PolicyCategories = JSON.parse(JSON.stringify(DEFAULT_POLICY_CATEGORIES));
  } catch (e) {
    console.error('Error mereset kata kunci:', e);
  }
}

// Inisialisasi saat script dimuat
initKeywordsFromStorage();

// ========================================================
// DEFINISI JOBS / TUGAS MAPREDUCE
// ========================================================

const MapReduceJobs = {
  /**
   * JOB 1: Pemetaan Sektor Evaluasi Kebijakan Publik (FOKUS UTAMA)
   */
  policyEvaluation: {
    name: 'Pemetaan Sektor Evaluasi Kebijakan Publik',
    description: 'Mengelompokkan respon netizen pidato presiden ke sektor-sektor kebijakan pemerintah berdasarkan kata kunci leksikon.',
    metricLabel: 'Frekuensi Aspirasi',

    // MAPPER
    map: (commentItem, emit) => {
      const snippet = commentItem.snippet?.topLevelComment?.snippet || {};
      const text = (snippet.textDisplay || '').toLowerCase();
      const likes = parseInt(snippet.likeCount || '0', 10);

      let matched = false;

      for (const [sector, keywords] of Object.entries(PolicyCategories)) {
        const hasKeyword = keywords.some(k => text.includes(k.toLowerCase()));
        if (hasKeyword) {
          emit(sector, { count: 1, likes: likes });
          matched = true;
        }
      }

      if (!matched) {
        emit('Sektor Kebijakan Lainnya', { count: 1, likes: likes });
      }
    },

    // REDUCER
    reduce: (key, values) => {
      return values.reduce(
        (acc, curr) => ({
          count: acc.count + curr.count,
          likes: acc.likes + curr.likes
        }),
        { count: 0, likes: 0 }
      );
    }
  },

  /**
   * JOB 2: Klasifikasi Sentimen Respon Netizen (Positif, Negatif, Netral)
   */
  sentimentAnalysis: {
    name: 'Analisis Sentimen Respon Netizen',
    description: 'Mengklasifikasikan komentar publik menjadi Positif, Negatif, atau Netral beserta pembobotan Likes dukungan netizen.',
    metricLabel: 'Total Komentar',

    // MAPPER
    map: (commentItem, emit) => {
      const snippet = commentItem.snippet?.topLevelComment?.snippet || {};
      const text = (snippet.textDisplay || '').toLowerCase();
      const likes = parseInt(snippet.likeCount || '0', 10);

      const words = text.replace(/[^\w\s]/g, ' ').split(/\s+/);

      let posCount = 0;
      let negCount = 0;

      words.forEach(w => {
        if (LexiconPositif.has(w)) posCount++;
        if (LexiconNegatif.has(w)) negCount++;
      });

      let sentiment = 'Netral';
      if (posCount > negCount) {
        sentiment = 'Sentimen Positif (Apresiasi & Harapan)';
      } else if (negCount > posCount) {
        sentiment = 'Sentimen Negatif (Kritik & Keluhan)';
      }

      emit(sentiment, { count: 1, likes: likes });
    },

    // REDUCER
    reduce: (key, values) => {
      return values.reduce(
        (acc, curr) => ({
          count: acc.count + curr.count,
          likes: acc.likes + curr.likes
        }),
        { count: 0, likes: 0 }
      );
    }
  },

  /**
   * JOB 3: Word Count Kata Kunci Evaluasi & Aspirasi Netizen
   */
  aspirasiWordCount: {
    name: 'Ekstraksi Kata Kunci Tuntutan Publik (Word Count)',
    description: 'Menemukan kata-kata evaluasi, tuntutan, atau masalah spesifik yang paling sering diulang di kolom komentar.',
    metricLabel: 'Frekuensi Kata',

    // MAPPER
    map: (commentItem, emit) => {
      const snippet = commentItem.snippet?.topLevelComment?.snippet || {};
      const text = (snippet.textDisplay || '').toLowerCase();

      const words = text
        .replace(/[^\w\s\u00C0-\u017F]/g, ' ')
        .split(/\s+/);

      words.forEach(word => {
        if (word.length > 3 && !StopWordsIndo.has(word) && !/^\d+$/.test(word)) {
          emit(word, 1);
        }
      });
    },

    // REDUCER
    reduce: (key, values) => {
      return values.reduce((acc, curr) => acc + curr, 0);
    }
  }
};

// Global Browser Exports
if (typeof window !== 'undefined') {
  window.DEFAULT_STOP_WORDS = DEFAULT_STOP_WORDS;
  window.DEFAULT_LEXICON_POSITIF = DEFAULT_LEXICON_POSITIF;
  window.DEFAULT_LEXICON_NEGATIF = DEFAULT_LEXICON_NEGATIF;
  window.DEFAULT_POLICY_CATEGORIES = DEFAULT_POLICY_CATEGORIES;

  window.getStopWordsIndo = () => StopWordsIndo;
  window.getLexiconPositif = () => LexiconPositif;
  window.getLexiconNegatif = () => LexiconNegatif;
  window.getPolicyCategories = () => PolicyCategories;

  window.setPolicyCategories = (val) => { PolicyCategories = val; saveKeywordsToStorage(); };
  window.setLexiconPositif = (val) => { LexiconPositif = val; saveKeywordsToStorage(); };
  window.setLexiconNegatif = (val) => { LexiconNegatif = val; saveKeywordsToStorage(); };
  window.setStopWordsIndo = (val) => { StopWordsIndo = val; saveKeywordsToStorage(); };

  window.saveKeywordsToStorage = saveKeywordsToStorage;
  window.resetKeywordsToDefault = resetKeywordsToDefault;

  // Backward compatibility
  window.StopWordsIndo = StopWordsIndo;
  window.LexiconPositif = LexiconPositif;
  window.LexiconNegatif = LexiconNegatif;
  window.PolicyCategories = PolicyCategories;
  window.MapReduceJobs = MapReduceJobs;
}
