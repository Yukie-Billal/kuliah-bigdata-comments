/**
 * Dataset Komentar YouTube Pidato Presiden untuk Evaluasi Kebijakan Publik
 * Format data sesuai output resmi Google YouTube Data API v3 (endpoint: commentThreads)
 * 
 * Topik Proyek:
 * "Analisis Komentar YouTube Dengan MapReduce Dalam Menerjemahkan 
 *  Respon Netizen Pidato Presiden Menjadi Evaluasi Kebijakan"
 */

const SAMPLE_YOUTUBE_COMMENTS = [
  {
    id: "c101",
    snippet: {
      topLevelComment: {
        snippet: {
          authorDisplayName: "@BudiSantoso_ID",
          textDisplay: "Semoga program makan bergizi gratis benar-benar tepat sasaran untuk anak-anak sekolah di pelosok desa, jangan sampai ada korupsi pengadaan bahan makanan.",
          likeCount: 428,
          publishedAt: "2024-10-21T04:15:00Z"
        }
      }
    }
  },
  {
    id: "c102",
    snippet: {
      topLevelComment: {
        snippet: {
          authorDisplayName: "@RinaWulandari",
          textDisplay: "Pidato yang sangat optimis dan membakar semangat. Kami rakyat kecil hanya berharap harga beras, telur, dan minyak goreng bisa stabil murah dan terjangkau.",
          likeCount: 615,
          publishedAt: "2024-10-21T04:30:00Z"
        }
      }
    }
  },
  {
    id: "c103",
    snippet: {
      topLevelComment: {
        snippet: {
          authorDisplayName: "@AhmadFauzi_Tech",
          textDisplay: "Pemberantasan korupsi harus tegas tanpa pandang bulu seperti yang disampaikan dalam pidato. Penegakan hukum dan transparansi anggaran adalah kunci utama.",
          likeCount: 389,
          publishedAt: "2024-10-21T05:00:00Z"
        }
      }
    }
  },
  {
    id: "c104",
    snippet: {
      topLevelComment: {
        snippet: {
          authorDisplayName: "@SitiRahmawati",
          textDisplay: "Fasilitas kesehatan di puskesmas daerah tolong ditingkatkan pak presiden. Antrean BPJS masih panjang dan obat-obatan sering kosong di rumah sakit.",
          likeCount: 512,
          publishedAt: "2024-10-21T05:22:00Z"
        }
      }
    }
  },
  {
    id: "c105",
    snippet: {
      topLevelComment: {
        snippet: {
          authorDisplayName: "@DediKurniawan88",
          textDisplay: "Paling penting buka lapangan kerja seluas-luasnya untuk lulusan SMK dan sarjana baru. Cari kerja sekarang sangat sulit dan banyak syarat batas umur.",
          likeCount: 840,
          publishedAt: "2024-10-21T05:45:00Z"
        }
      }
    }
  },
  {
    id: "c106",
    snippet: {
      topLevelComment: {
        snippet: {
          authorDisplayName: "@EkaPratama_Jkt",
          textDisplay: "Keren sekali arah kebijakan swasembada pangan dan energi nasional. Semoga terealisasi nyata dalam 5 tahun ke depan demi masa depan Indonesia.",
          likeCount: 275,
          publishedAt: "2024-10-21T06:10:00Z"
        }
      }
    }
  },
  {
    id: "c107",
    snippet: {
      topLevelComment: {
        snippet: {
          authorDisplayName: "@MayaAnggraini",
          textDisplay: "Tolong perhatikan nasib guru honorer dan gaji guru di pedalaman. Kesejahteraan guru adalah pondasi utama kemajuan pendidikan bangsa.",
          likeCount: 720,
          publishedAt: "2024-10-21T06:35:00Z"
        }
      }
    }
  },
  {
    id: "c108",
    snippet: {
      topLevelComment: {
        snippet: {
          authorDisplayName: "@HendraGunawan",
          textDisplay: "Jangan cuma janji manis pidato politik saja pak. Tarif pajak PPN jangan dinaikkan, daya beli masyarakat saat ini sedang turun drastis dan susah.",
          likeCount: 934,
          publishedAt: "2024-10-21T07:05:00Z"
        }
      }
    }
  },
  {
    id: "c109",
    snippet: {
      topLevelComment: {
        snippet: {
          authorDisplayName: "@LestariNingsih",
          textDisplay: "Alhamdulillah sangat setuju dengan fokus penurunan angka kemiskinan dan subsidi pupuk bagi para petani kecil di desa.",
          likeCount: 310,
          publishedAt: "2024-10-21T07:40:00Z"
        }
      }
    }
  },
  {
    id: "c110",
    snippet: {
      topLevelComment: {
        snippet: {
          authorDisplayName: "@RizkyRamadhan",
          textDisplay: "Pembangunan infrastruktur transportasi publik kereta dan jalan antar provinsi harus terus berlanjut agar logistik barang murah dan merata.",
          likeCount: 195,
          publishedAt: "2024-10-21T08:15:00Z"
        }
      }
    }
  },
  {
    id: "c111",
    snippet: {
      topLevelComment: {
        snippet: {
          authorDisplayName: "@TriWahyu_Solo",
          textDisplay: "Kami kecewa masalah kebocoran data pribadi dan keamanan siber tidak disinggung secara tegas dalam pidato tersebut.",
          likeCount: 260,
          publishedAt: "2024-10-21T08:50:00Z"
        }
      }
    }
  },
  {
    id: "c112",
    snippet: {
      topLevelComment: {
        snippet: {
          authorDisplayName: "@DewiKartika_Bdg",
          textDisplay: "Semoga para menteri dan pejabat kabinet yang dipilih benar-benar orang yang kompeten dan berintegritas tinggi, bukan sekadar bagi-bagi kekuasaan.",
          likeCount: 680,
          publishedAt: "2024-10-21T09:20:00Z"
        }
      }
    }
  },
  {
    id: "c113",
    snippet: {
      topLevelComment: {
        snippet: {
          authorDisplayName: "@AgusSetiawan_Plg",
          textDisplay: "Program penurunan stunting anak dan bantuan nutrisi ibu hamil sangat bagus. Harus dikawal ketat sampai ke tingkat posyandu desa.",
          likeCount: 345,
          publishedAt: "2024-10-21T09:55:00Z"
        }
      }
    }
  },
  {
    id: "c114",
    snippet: {
      topLevelComment: {
        snippet: {
          authorDisplayName: "@FarhanMaulana",
          textDisplay: "Birokrasi perizinan usaha kecil UMKM masih sangat berbelit-belit dan lambat. Mohon disederhanakan agar ekonomi rakyat berkembang.",
          likeCount: 470,
          publishedAt: "2024-10-21T10:30:00Z"
        }
      }
    }
  },
  {
    id: "c115",
    snippet: {
      topLevelComment: {
        snippet: {
          authorDisplayName: "@IndahPermata",
          textDisplay: "Terharu dan bangga melihat komitmen perdamaian dunia serta sikap diplomasi internasional Indonesia yang disegani bangsa luar.",
          likeCount: 220,
          publishedAt: "2024-10-21T11:00:00Z"
        }
      }
    }
  },
  {
    id: "c116",
    snippet: {
      topLevelComment: {
        snippet: {
          authorDisplayName: "@Yanto_Surabaya",
          textDisplay: "Hentikan pungutan liar aparat penegak hukum di lapangan. Mau lapor kehilangan saja masih dimintai uang, tolong benahi reformasi kepolisian.",
          likeCount: 885,
          publishedAt: "2024-10-21T11:45:00Z"
        }
      }
    }
  },
  {
    id: "c117",
    snippet: {
      topLevelComment: {
        snippet: {
          authorDisplayName: "@SriWahyuningsih",
          textDisplay: "Kenaikan gaji pensiunan PNS dan guru tolong jangan ditunda lagi pak presiden, biaya kebutuhan pokok semakin hari semakin mencekik.",
          likeCount: 540,
          publishedAt: "2024-10-21T12:10:00Z"
        }
      }
    }
  },
  {
    id: "c118",
    snippet: {
      topLevelComment: {
        snippet: {
          authorDisplayName: "@IlhamBintang",
          textDisplay: "Pemberantasan judi online dan pinjaman online ilegal harus masuk prioritas darurat nasional karena sudah merusak jutaan keluarga miskin.",
          likeCount: 910,
          publishedAt: "2024-10-21T12:40:00Z"
        }
      }
    }
  }
];
