import * as XLSX from 'xlsx';
import type { Kegiatan, Peserta } from '../types/sdm';

export function isKegiatanLsp(namaKegiatan: string, daftarKegiatan: Kegiatan[]): boolean {
  if (!namaKegiatan) return false;
  const found = daftarKegiatan.find(
    (k) => k.nama.trim().toLowerCase() === namaKegiatan.trim().toLowerCase()
  );
  if (found) {
    return found.jenis === 'Sertifikasi LSP';
  }
  const lower = namaKegiatan.toLowerCase();
  return lower.includes('lsp') || lower.includes('sertifikasi');
}

function cleanText(val: unknown, fallback = '-'): string {
  if (val === null || val === undefined) return fallback;
  const s = String(val).trim();
  if (!s || s.toLowerCase() === 'undefined' || s.toLowerCase() === 'null') return fallback;
  return s.replace(/^'/, '').trim();
}

function normalizeJk(val: unknown): string {
  const s = cleanText(val, '-').toLowerCase();
  if (!s || s === '-') return '-';
  if (s === 'l' || s.includes('laki') || s === 'pria' || s === 'male') return 'Laki-laki';
  if (s === 'p' || s.includes('perempuan') || s.includes('wanita') || s === 'female')
    return 'Perempuan';
  return cleanText(val, '-');
}

function normalizeTahun(val: unknown, defaultTahun: string): string {
  const s = cleanText(val, '');
  const match = s.match(/\b(20\d{2})\b/);
  if (match) return match[1];
  return defaultTahun;
}

export interface ParsedSpreadsheetResult {
  sheetNames: string[];
  activeSheet: string;
  rows: Peserta[];
  detectedColumns: string[];
  usedHeaderMapping: boolean;
}

type FieldKey = keyof Omit<Peserta, 'id'>;

const HEADER_SYNONYMS: Record<FieldKey, string[]> = {
  tahun: ['tahun', 'thn', 'year', 'periode'],
  kegiatan: [
    'nama kegiatan',
    'kegiatan',
    'kegiatan bidang',
    'program',
    'pelatihan',
    'skema',
    'nama pelatihan',
    'judul kegiatan',
  ],
  nik: ['nik', 'no ktp', 'no. ktp', 'ktp', 'nomor induk', 'no nik', 'nomor nik'],
  nama: [
    'nama lengkap (ktp)',
    'nama lengkap',
    'nama peserta',
    'nama',
    'peserta',
    'full name',
  ],
  jk: ['jenis kelamin', 'jk', 'kelamin', 'gender', 'l/p'],
  kecamatan: ['asal kecamatan', 'kecamatan', 'kec', 'wilayah'],
  alamat: ['alamat desa/kel', 'alamat', 'desa', 'kelurahan', 'desa/kelurahan', 'domisili'],
  telp: [
    'no telepon',
    'no. telepon',
    'nomor telepon',
    'telepon',
    'telp',
    'no hp',
    'no. hp',
    'hp',
    'wa',
    'whatsapp',
    'no wa',
    'kontak',
  ],
  pendidikan: ['pendidikan terakhir', 'pendidikan', 'ijazah', 'lulusan'],
  pekerjaan: ['pekerjaan', 'profesi', 'jabatan', 'bidang kerja'],
  lembaga: [
    'nama lembaga',
    'lembaga',
    'lembaga / usaha',
    'usaha',
    'instansi',
    'pokdarwis',
    'organisasi',
    'perusahaan',
    'nama usaha',
  ],
};

function matchHeaderToField(headerCell: string): FieldKey | null {
  const norm = headerCell
    .toLowerCase()
    .replace(/[_.:/()-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!norm) return null;

  // Exact match pass first
  for (const [field, synonyms] of Object.entries(HEADER_SYNONYMS) as [FieldKey, string[]][]) {
    for (const syn of synonyms) {
      const cleanSyn = syn
        .toLowerCase()
        .replace(/[_.:/()-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (norm === cleanSyn) return field;
    }
  }

  // Partial contains pass (excluding 'no' / 'nomor urut' false positives)
  if (norm === 'no' || norm === 'nomor' || norm === 'no urut') return null;
  for (const [field, synonyms] of Object.entries(HEADER_SYNONYMS) as [FieldKey, string[]][]) {
    for (const syn of synonyms) {
      const cleanSyn = syn
        .toLowerCase()
        .replace(/[_.:/()-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (norm.includes(cleanSyn) || (norm.length >= 3 && cleanSyn.includes(norm))) {
        return field;
      }
    }
  }
  return null;
}

/**
 * Parse .xlsx, .xls, or .csv File / ArrayBuffer into normalized Peserta rows
 */
export async function parseSpreadsheetFile(
  file: File,
  options?: {
    sheetName?: string;
    defaultTahun?: string;
    defaultKegiatan?: string;
  }
): Promise<ParsedSpreadsheetResult> {
  const defaultTahun = options?.defaultTahun || '2026';
  const defaultKegiatan = options?.defaultKegiatan || '-';

  const isCsv = file.name.toLowerCase().endsWith('.csv');
  let workbook: XLSX.WorkBook;

  if (isCsv) {
    let text = await file.text();
    // Strip UTF-8 BOM if present
    text = text.replace(/^\uFEFF/, '');
    workbook = XLSX.read(text, { type: 'string', raw: true });
  } else {
    const buffer = await file.arrayBuffer();
    workbook = XLSX.read(buffer, { type: 'array', raw: false });
  }

  const sheetNames = workbook.SheetNames;
  const activeSheet =
    options?.sheetName && sheetNames.includes(options.sheetName)
      ? options.sheetName
      : sheetNames[0];

  const worksheet = workbook.Sheets[activeSheet];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: '',
    raw: false,
  });

  // Filter completely empty rows
  const nonEmptyRows = matrix.filter(
    (row) => Array.isArray(row) && row.some((cell) => String(cell ?? '').trim() !== '')
  );

  if (nonEmptyRows.length === 0) {
    return {
      sheetNames,
      activeSheet,
      rows: [],
      detectedColumns: [],
      usedHeaderMapping: false,
    };
  }

  // Find the header row within the first 5 rows (handles Excel files with title banners at row 1-2)
  let headerRowIdx = 0;
  let bestMatchCount = 0;
  let bestFieldMap: Partial<Record<FieldKey, number>> = {};

  for (let r = 0; r < Math.min(5, nonEmptyRows.length); r++) {
    const candidate = nonEmptyRows[r];
    const currentMap: Partial<Record<FieldKey, number>> = {};
    let hits = 0;
    candidate.forEach((cell, colIdx) => {
      const matched = matchHeaderToField(String(cell ?? ''));
      if (matched && currentMap[matched] === undefined) {
        currentMap[matched] = colIdx;
        hits++;
      }
    });
    if (hits > bestMatchCount) {
      bestMatchCount = hits;
      headerRowIdx = r;
      bestFieldMap = currentMap;
    }
  }

  const usedHeaderMapping = bestMatchCount >= 2;
  const detectedColumns = usedHeaderMapping
    ? nonEmptyRows[headerRowIdx].map((c) => String(c ?? '').trim()).filter(Boolean)
    : [];

  const startDataIdx = usedHeaderMapping ? headerRowIdx + 1 : 0;
  const parsedRows: Peserta[] = [];

  for (let r = startDataIdx; r < nonEmptyRows.length; r++) {
    const cols = nonEmptyRows[r];
    const getByField = (field: FieldKey, positionalIdx: number): string => {
      if (usedHeaderMapping) {
        const idx = bestFieldMap[field];
        if (idx === undefined) return '';
        return cleanText(cols[idx], '');
      }
      return cleanText(cols[positionalIdx], '');
    };

    const nama = getByField('nama', 3);
    const nik = getByField('nik', 2);
    const kegiatan = getByField('kegiatan', 1) || defaultKegiatan;

    // Skip rows that have neither nama nor nik
    if (!nama && !nik) continue;

    // Skip if someone accidentally left the "Contoh Nama Peserta" row or header duplicate
    if (nama.toLowerCase() === 'nama lengkap (ktp)' || nama.toLowerCase() === 'nama lengkap') {
      continue;
    }

    parsedRows.push({
      tahun: normalizeTahun(getByField('tahun', 0), defaultTahun),
      kegiatan: kegiatan || '-',
      nik: nik || '-',
      nama: nama || '-',
      jk: normalizeJk(getByField('jk', 4)),
      kecamatan: getByField('kecamatan', 5) || '-',
      alamat: getByField('alamat', 6) || '-',
      telp: getByField('telp', 7) || '-',
      pendidikan: getByField('pendidikan', 8) || '-',
      pekerjaan: getByField('pekerjaan', 9) || '-',
      lembaga: getByField('lembaga', 10) || '-',
    });
  }

  return {
    sheetNames,
    activeSheet,
    rows: parsedRows,
    detectedColumns,
    usedHeaderMapping,
  };
}

export function downloadEmptyTemplateXlsx(): void {
  const headers = [
    'Tahun',
    'Nama Kegiatan',
    'NIK',
    'Nama Lengkap (KTP)',
    'Jenis Kelamin',
    'Asal Kecamatan',
    'Alamat Desa/Kel',
    'No Telepon',
    'Pendidikan Terakhir',
    'Pekerjaan',
    'Nama Lembaga',
  ];

  const exampleRow = [
    '2026',
    'Sertifikasi Kompetensi Tata Graha & Front Office Hotel (LSP)',
    "'7407010101900001",
    'Contoh Nama Peserta',
    'Laki-laki',
    'Wangi-Wangi',
    'Kel. Pongo',
    "'081234567890",
    'Sarjana (S1 / D4)',
    'Staf Hotel',
    'Hotel Wakatobi',
  ];

  const ws = XLSX.utils.aoa_to_sheet([headers, exampleRow]);
  ws['!cols'] = [
    { wch: 8 },
    { wch: 46 },
    { wch: 20 },
    { wch: 26 },
    { wch: 15 },
    { wch: 20 },
    { wch: 22 },
    { wch: 16 },
    { wch: 22 },
    { wch: 20 },
    { wch: 24 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Template Peserta');
  XLSX.writeFile(wb, 'Form_Kosong_Peserta_SDM_Wakatobi.xlsx');
}

export function downloadEmptyTemplateCsv(): void {
  const header =
    'Tahun;Nama Kegiatan;NIK;Nama Lengkap (KTP);Jenis Kelamin;Asal Kecamatan;Alamat Desa/Kel;No Telepon;Pendidikan Terakhir;Pekerjaan;Nama Lembaga';
  const contoh =
    '2026;Sertifikasi Kompetensi Tata Graha & Front Office Hotel (LSP);7407010101900001;Contoh Nama Peserta;Laki-laki;Wangi-Wangi;Kel. Pongo;081234567890;Sarjana (S1 / D4);Staf Hotel;Hotel Wakatobi';
  const blob = new Blob(['\ufeff' + header + '\n' + contoh + '\n'], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Form_Kosong_Peserta_SDM_Wakatobi.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function exportRekapXlsx(
  pesertaList: Peserta[],
  daftarKegiatan: Kegiatan[],
  labelTahun: string
): void {
  const headers = [
    'No',
    'Tahun',
    'Nama Kegiatan',
    'Status LSP',
    'NIK',
    'Nama Lengkap',
    'Jenis Kelamin',
    'Asal Kecamatan',
    'Alamat',
    'No. Telepon',
    'Pendidikan',
    'Pekerjaan',
    'Nama Lembaga',
  ];

  const rows = pesertaList.map((row, idx) => [
    idx + 1,
    row.tahun || '-',
    row.kegiatan || '-',
    isKegiatanLsp(row.kegiatan, daftarKegiatan) ? 'Tersertifikasi LSP' : 'Pelatihan Biasa',
    row.nik && row.nik !== '-' ? String(row.nik) : '-',
    row.nama || '-',
    row.jk || '-',
    row.kecamatan || '-',
    row.alamat || '-',
    row.telp && row.telp !== '-' ? String(row.telp) : '-',
    row.pendidikan || '-',
    row.pekerjaan || '-',
    row.lembaga || '-',
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [
    { wch: 5 },
    { wch: 8 },
    { wch: 44 },
    { wch: 20 },
    { wch: 20 },
    { wch: 26 },
    { wch: 14 },
    { wch: 20 },
    { wch: 22 },
    { wch: 16 },
    { wch: 22 },
    { wch: 20 },
    { wch: 24 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Rekap SDM Pariwisata');
  XLSX.writeFile(wb, `Rekap_SDM_Pariwisata_Wakatobi_${labelTahun}.xlsx`);
}
