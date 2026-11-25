import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_GAS_URL =
  'https://script.google.com/macros/s/AKfycby6NzzB8U-roNZ-CxQTh8IUQ5tvPO4DtxV7koOW3gY-VNyCaAzogkQv-iGijmRuLtfJUQ/exec';

const ALLOWED_GAS_PREFIX = 'https://script.google.com/';

function cleanCell(val: unknown, fallback = '-'): string {
  if (val === null || val === undefined) return fallback;
  const s = String(val).trim();
  if (!s || s.toLowerCase() === 'undefined' || s.toLowerCase() === 'null') return fallback;
  return s.replace(/^'/, '');
}

function normalizePesertaRow(raw: Record<string, unknown>): {
  row: Record<string, string>;
  wasMalformed: boolean;
  colCount: number;
} {
  const keys = Object.keys(raw);
  const hasStandardKeys =
    keys.includes('nama') &&
    keys.includes('tahun') &&
    keys.includes('kegiatan') &&
    !keys.some((k) => k.includes(','));

  if (hasStandardKeys) {
    return {
      row: {
        tahun: cleanCell(raw.tahun, '2026'),
        kegiatan: cleanCell(raw.kegiatan, '-'),
        nik: cleanCell(raw.nik, '-'),
        nama: cleanCell(raw.nama, '-'),
        jk: cleanCell(raw.jk, '-'),
        kecamatan: cleanCell(raw.kecamatan, '-'),
        alamat: cleanCell(raw.alamat, '-'),
        telp: cleanCell(raw.telp, '-'),
        pendidikan: cleanCell(raw.pendidikan, '-'),
        pekerjaan: cleanCell(raw.pekerjaan, '-'),
        lembaga: cleanCell(raw.lembaga, '-'),
      },
      wasMalformed: false,
      colCount: keys.length,
    };
  }

  // Fallback for sheets with malformed/positional header row (e.g., CSV string in Row 1)
  const values = Object.values(raw);
  return {
    row: {
      tahun: cleanCell(raw.tahun ?? values[0], '2026'),
      kegiatan: cleanCell(raw.kegiatan ?? values[1], '-'),
      nik: cleanCell(raw.nik ?? values[2], '-'),
      nama: cleanCell(raw.nama ?? values[3], '-'),
      jk: cleanCell(raw.jk ?? values[4], '-'),
      kecamatan: cleanCell(raw.kecamatan ?? values[5], '-'),
      alamat: cleanCell(raw.alamat ?? values[6], '-'),
      telp: cleanCell(raw.telp ?? values[7], '-'),
      pendidikan: cleanCell(raw.pendidikan ?? values[8], '-'),
      pekerjaan: cleanCell(raw.pekerjaan ?? values[9], '-'),
      lembaga: cleanCell(raw.lembaga ?? values[10], '-'),
    },
    wasMalformed: true,
    colCount: keys.length,
  };
}

function normalizeKegiatanRow(raw: Record<string, unknown>): {
  row: { tahun: string; jenis: 'Pelatihan' | 'Sertifikasi LSP'; nama: string };
  wasMalformed: boolean;
  colCount: number;
} {
  const keys = Object.keys(raw);
  const hasStandardKeys =
    keys.includes('tahun') &&
    keys.includes('jenis') &&
    keys.includes('nama') &&
    !keys.some((k) => k.includes(','));

  const rawValues = Object.values(raw);
  const tahun = cleanCell(hasStandardKeys ? raw.tahun : raw.tahun ?? rawValues[0], '2026');
  const jenisRaw = cleanCell(hasStandardKeys ? raw.jenis : raw.jenis ?? rawValues[1], 'Pelatihan');
  const nama = cleanCell(hasStandardKeys ? raw.nama : raw.nama ?? rawValues[2], '-');
  const isLsp =
    jenisRaw.toLowerCase().includes('lsp') ||
    jenisRaw.toLowerCase().includes('sertifikasi') ||
    nama.toLowerCase().includes('lsp');

  return {
    row: {
      tahun,
      jenis: isLsp ? 'Sertifikasi LSP' : 'Pelatihan',
      nama,
    },
    wasMalformed: !hasStandardKeys,
    colCount: keys.length,
  };
}

function validateGasUrl(inputUrl: unknown): string {
  if (typeof inputUrl === 'string' && inputUrl.trim().startsWith(ALLOWED_GAS_PREFIX)) {
    return inputUrl.trim();
  }
  return DEFAULT_GAS_URL;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '15mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Admin credential verification endpoint
  app.post('/api/auth/login', (req, res) => {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password.trim() : '';

    // Primary team credentials + optional env override
    const validUsers: Array<{ user: string; pass: string; role: string; label: string }> = [
      {
        user: process.env.ADMIN_USERNAME || 'sdmdispar',
        pass: process.env.ADMIN_PASSWORD || 'sdmdispar123',
        role: 'admin',
        label: 'Admin Bidang SDM',
      },
    ];

    const matched = validUsers.find((u) => u.user === username && u.pass === password);
    if (!matched) {
      res.status(401).json({
        status: 'error',
        message: 'Username atau password salah. Hubungi admin Bidang SDM jika lupa akses.',
      });
      return;
    }

    res.json({
      status: 'success',
      user: {
        username: matched.user,
        role: matched.role,
        label: matched.label,
      },
    });
  });

  // Proxy GET from Google Apps Script (solves CORS & normalizes legacy sheet structures)
  app.get('/api/sheets/load', async (req, res) => {
    const gasUrl = validateGasUrl(req.query.url);
    try {
      const response = await fetch(gasUrl, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(20000),
      });

      const text = await response.text();
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(text) as Record<string, unknown>;
      } catch {
        res.status(502).json({
          status: 'error',
          message:
            'Respon Google Apps Script bukan JSON valid. Pastikan Web App di-deploy dengan akses "Anyone".',
        });
        return;
      }

      const rawPeserta = Array.isArray(parsed.peserta)
        ? (parsed.peserta as Record<string, unknown>[])
        : [];
      const rawKegiatan = Array.isArray(parsed.kegiatan)
        ? (parsed.kegiatan as Record<string, unknown>[])
        : [];

      const issues: string[] = [];
      let pesertaMalformed = false;
      let rawPesertaCols = 11;
      let rawKegiatanCols = 3;

      const peserta = rawPeserta
        .map((item) => {
          const norm = normalizePesertaRow(item);
          if (norm.wasMalformed) pesertaMalformed = true;
          rawPesertaCols = norm.colCount;
          return norm.row;
        })
        .filter((p) => p.nama !== '-' || p.kegiatan !== '-' || p.nik !== '-');

      let kegiatanMalformed = false;
      const kegiatan = rawKegiatan
        .map((item) => {
          const norm = normalizeKegiatanRow(item);
          if (norm.wasMalformed) kegiatanMalformed = true;
          rawKegiatanCols = norm.colCount;
          return norm.row;
        })
        .filter((k) => k.nama !== '-');

      if (pesertaMalformed || rawPesertaCols < 11) {
        issues.push(
          `Header tab "peserta" di Google Sheets terdeteksi belum sesuai (${rawPesertaCols} kolom). Kolom ke-6 s/d ke-11 (kecamatan, alamat, telp, pendidikan, pekerjaan, lembaga) tidak terbaca penuh dari Google Sheets sampai Baris 1 diperbaiki.`
        );
      }
      if (kegiatanMalformed) {
        issues.push(
          'Header tab "kegiatan" di Google Sheets terdeteksi masih berupa teks gabungan koma di Baris 1.'
        );
      }

      res.json({
        status: 'success',
        kegiatan,
        peserta,
        sheetHealth: {
          isHealthy: issues.length === 0,
          issues,
          rawPesertaColumns: rawPesertaCols,
          rawKegiatanColumns: rawKegiatanCols,
        },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Gagal menghubungi Google Apps Script';
      res.status(502).json({
        status: 'error',
        message: `Koneksi ke Google Drive/Sheets gagal: ${msg}`,
      });
    }
  });

  // Proxy POST to Google Apps Script (eliminates browser no-cors blind writes)
  app.post('/api/sheets/save', async (req, res) => {
    const gasUrl = validateGasUrl(req.body?.url);
    const kegiatan = Array.isArray(req.body?.kegiatan) ? req.body.kegiatan : [];
    const peserta = Array.isArray(req.body?.peserta) ? req.body.peserta : [];

    try {
      const response = await fetch(gasUrl, {
        method: 'POST',
        redirect: 'follow',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ kegiatan, peserta }),
        signal: AbortSignal.timeout(25000),
      });

      const text = await response.text();
      let parsed: Record<string, unknown> | null = null;
      try {
        parsed = JSON.parse(text) as Record<string, unknown>;
      } catch {
        parsed = null;
      }

      if (!response.ok) {
        res.status(502).json({
          status: 'error',
          message: `Google Apps Script merespon HTTP ${response.status}`,
        });
        return;
      }

      if (parsed && parsed.status === 'error') {
        res.status(502).json({
          status: 'error',
          message: String(parsed.message || 'Google Apps Script menolak penyimpanan data'),
        });
        return;
      }

      res.json({
        status: 'success',
        savedCount: {
          kegiatan: kegiatan.length,
          peserta: peserta.length,
        },
        remoteResponse: parsed ?? { raw: text.slice(0, 200) },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Timeout atau jaringan terputus';
      res.status(502).json({
        status: 'error',
        message: `Gagal menyimpan ke Google Drive/Sheets: ${msg}`,
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SIM-SDM Pariwisata Wakatobi server running on http://localhost:${PORT}`);
  });
}

startServer();
