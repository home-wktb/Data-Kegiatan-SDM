export type JenisKegiatan = 'Pelatihan' | 'Sertifikasi LSP';

export interface Kegiatan {
  tahun: string;
  jenis: JenisKegiatan;
  nama: string;
}

export interface Peserta {
  id?: string;
  tahun: string;
  kegiatan: string;
  nik: string;
  nama: string;
  jk: string;
  kecamatan: string;
  alamat: string;
  telp: string;
  pendidikan: string;
  pekerjaan: string;
  lembaga: string;
}

export interface SheetHealth {
  isHealthy: boolean;
  issues: string[];
  rawPesertaColumns: number;
  rawKegiatanColumns: number;
}

export type CloudSyncState = 'idle' | 'loading' | 'saving' | 'synced' | 'offline' | 'error';

export interface ToastItem {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  description?: string;
}

export const DEFAULT_GAS_URL =
  'https://script.google.com/macros/s/AKfycby6NzzB8U-roNZ-CxQTh8IUQ5tvPO4DtxV7koOW3gY-VNyCaAzogkQv-iGijmRuLtfJUQ/exec';

export const TAHUN_OPTIONS = ['2031', '2030', '2029', '2028', '2027', '2026', '2025', '2024'];

export const KECAMATAN_WAKATOBI = [
  'Wangi-Wangi',
  'Wangi-Wangi Selatan',
  'Kaledupa',
  'Kaledupa Selatan',
  'Tomia',
  'Tomia Timur',
  'Binongko',
  'Togo Binongko',
  'Luar Wakatobi',
];

export const PENDIDIKAN_OPTIONS = [
  'SD / Sederajat',
  'SMP / Sederajat',
  'SMA / SMK / Sederajat',
  'Diploma (D1/D2/D3)',
  'Sarjana (S1 / D4)',
  'Pascasarjana (S2/S3)',
];

export const DEFAULT_KEGIATAN: Kegiatan[] = [
  { tahun: '2024', jenis: 'Pelatihan', nama: 'Pelatihan Tata Kelola Homestay' },
  { tahun: '2025', jenis: 'Sertifikasi LSP', nama: 'Sertifikasi Kompetensi Pemandu Wisata Alam (LSP)' },
  { tahun: '2025', jenis: 'Pelatihan', nama: 'Bimtek Digital Marketing Desa Wisata' },
  { tahun: '2026', jenis: 'Pelatihan', nama: 'Fasilitasi Pengembangan Kompetensi SDM Ekraf' },
  { tahun: '2026', jenis: 'Sertifikasi LSP', nama: 'Sertifikasi Kompetensi Tata Graha & Front Office Hotel (LSP)' },
];

export const DEFAULT_PESERTA: Peserta[] = [
  {
    tahun: '2024',
    kegiatan: 'Pelatihan Tata Kelola Homestay',
    nik: '7407011205900001',
    nama: 'Wa Ode Siti Rahma',
    jk: 'Perempuan',
    kecamatan: 'Wangi-Wangi',
    alamat: 'Kel. Pongo',
    telp: '081244556677',
    pendidikan: 'Sarjana (S1 / D4)',
    pekerjaan: 'Pengelola Homestay',
    lembaga: 'Homestay Bajo Indah',
  },
  {
    tahun: '2026',
    kegiatan: 'Fasilitasi Pengembangan Kompetensi SDM Ekraf',
    nik: '7407011205900001',
    nama: 'Wa Ode Siti Rahma',
    jk: 'Perempuan',
    kecamatan: 'Wangi-Wangi',
    alamat: 'Kel. Pongo',
    telp: '081244556677',
    pendidikan: 'Sarjana (S1 / D4)',
    pekerjaan: 'Pengelola Homestay',
    lembaga: 'Homestay Bajo Indah',
  },
  {
    tahun: '2026',
    kegiatan: 'Sertifikasi Kompetensi Tata Graha & Front Office Hotel (LSP)',
    nik: '7407051911950003',
    nama: 'Nurul Hidayah',
    jk: 'Perempuan',
    kecamatan: 'Kaledupa',
    alamat: 'Desa Sombano',
    telp: '082199887766',
    pendidikan: 'Diploma (D1/D2/D3)',
    pekerjaan: 'Resepsionis Hotel',
    lembaga: 'Penginapan Kaledupa',
  },
  {
    tahun: '2025',
    kegiatan: 'Sertifikasi Kompetensi Pemandu Wisata Alam (LSP)',
    nik: '7407020508880002',
    nama: 'La Ode Muhamad Yusuf',
    jk: 'Laki-laki',
    kecamatan: 'Wangi-Wangi Selatan',
    alamat: 'Kel. Mandati III',
    telp: '085211223344',
    pendidikan: 'SMA / SMK / Sederajat',
    pekerjaan: 'Pemandu Wisata',
    lembaga: 'HPI Wakatobi',
  },
];
