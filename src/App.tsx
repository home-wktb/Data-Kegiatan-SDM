import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Award,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudOff,
  Download,
  FileSpreadsheet,
  FolderCog,
  History,
  LayoutDashboard,
  Lock,
  LogOut,
  Menu,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { ConfirmModal } from './components/ConfirmModal';
import { DonutChart } from './components/DonutChart';
import { HistoryModal } from './components/HistoryModal';
import { ImportExcelModal } from './components/ImportExcelModal';
import { KecamatanChart } from './components/KecamatanChart';
import { KegiatanModal } from './components/KegiatanModal';
import { LoginModal } from './components/LoginModal';
import { PesertaModal } from './components/PesertaModal';
import { SyncSettingsModal } from './components/SyncSettingsModal';
import {
  DEFAULT_GAS_URL,
  DEFAULT_KEGIATAN,
  DEFAULT_PESERTA,
  KECAMATAN_WAKATOBI,
  TAHUN_OPTIONS,
  type CloudSyncState,
  type Kegiatan,
  type Peserta,
  type SheetHealth,
  type ToastItem,
} from './types/sdm';
import {
  downloadEmptyTemplateXlsx,
  exportRekapXlsx,
  isKegiatanLsp,
} from './utils/sheetsParser';

type NavTab = 'dashboard' | 'peserta' | 'lsp';

const STORAGE_KEYS = {
  KEGIATAN: 'sim_sdm_kegiatan',
  PESERTA: 'sim_sdm_peserta',
  GAS_URL: 'sim_sdm_gas_url',
  AUTH: 'sdmdispar_auth',
  USER_LABEL: 'sdmdispar_user',
};

function readInitialJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  // Auth & Navigation
  const [isAdmin, setIsAdmin] = useState<boolean>(
    () => sessionStorage.getItem(STORAGE_KEYS.AUTH) === 'true'
  );
  const [adminUser, setAdminUser] = useState<string>(
    () => sessionStorage.getItem(STORAGE_KEYS.USER_LABEL) || 'sdmdispar'
  );
  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Core Data
  const [daftarKegiatan, setDaftarKegiatan] = useState<Kegiatan[]>(() =>
    readInitialJson<Kegiatan[]>(STORAGE_KEYS.KEGIATAN, DEFAULT_KEGIATAN)
  );
  const [dataPeserta, setDataPeserta] = useState<Peserta[]>(() =>
    readInitialJson<Peserta[]>(STORAGE_KEYS.PESERTA, DEFAULT_PESERTA)
  );

  // Cloud Sync State
  const [gasUrl, setGasUrl] = useState<string>(
    () => localStorage.getItem(STORAGE_KEYS.GAS_URL) || DEFAULT_GAS_URL
  );
  const [syncState, setSyncState] = useState<CloudSyncState>('idle');
  const [sheetHealth, setSheetHealth] = useState<SheetHealth | null>(null);
  const [dismissHealthBanner, setDismissHealthBanner] = useState(false);

  // Filters & Pagination
  const [filterTahun, setFilterTahun] = useState<string>('2026');
  const [filterJenis, setFilterJenis] = useState<'ALL' | 'Pelatihan' | 'LSP'>('ALL');
  const [filterKegiatan, setFilterKegiatan] = useState<string>('');
  const [filterKecamatan, setFilterKecamatan] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);

  // Modals
  const [loginOpen, setLoginOpen] = useState(false);
  const [pesertaModalOpen, setPesertaModalOpen] = useState(false);
  const [editingPeserta, setEditingPeserta] = useState<{ index: number; data: Peserta } | null>(
    null
  );
  const [kegiatanModalOpen, setKegiatanModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<{ nik: string; nama: string } | null>(null);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Toasts
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = useCallback(
    (type: ToastItem['type'], title: string, description?: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-2), { id, type, title, description }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  // Save to localStorage + Google Apps Script via backend proxy
  const saveToCloud = useCallback(
    async (nextKegiatan: Kegiatan[], nextPeserta: Peserta[], customUrl?: string) => {
      localStorage.setItem(STORAGE_KEYS.KEGIATAN, JSON.stringify(nextKegiatan));
      localStorage.setItem(STORAGE_KEYS.PESERTA, JSON.stringify(nextPeserta));

      const targetUrl = customUrl || gasUrl;
      if (!targetUrl.startsWith('https://script.google.com/')) {
        setSyncState('offline');
        return;
      }

      setSyncState('saving');
      try {
        const res = await fetch('/api/sheets/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: targetUrl,
            kegiatan: nextKegiatan,
            peserta: nextPeserta,
          }),
        });
        const data = await res.json();
        if (!res.ok || data.status !== 'success') {
          setSyncState('error');
          pushToast(
            'warning',
            'Tersimpan lokal, gagal sinkron ke Google Drive',
            data.message || 'Periksa koneksi internet atau konfigurasi Apps Script.'
          );
          return;
        }
        setSyncState('synced');
        pushToast('success', 'Data berhasil disinkronkan ke Google Drive / Sheets');
      } catch {
        setSyncState('error');
        pushToast(
          'warning',
          'Mode Offline — Data tersimpan di browser',
          'Gunakan tombol Sinkronisasi untuk mengirim ulang saat online.'
        );
      }
    },
    [gasUrl, pushToast]
  );

  // Load from Google Apps Script via backend proxy
  const loadFromGoogleSheets = useCallback(
    async (customUrl?: string, showSuccessToast = false) => {
      const targetUrl = customUrl || gasUrl;
      if (!targetUrl.startsWith('https://script.google.com/')) {
        setSyncState('offline');
        return;
      }

      setSyncState('loading');
      try {
        const res = await fetch(`/api/sheets/load?url=${encodeURIComponent(targetUrl)}`);
        const data = await res.json();
        if (!res.ok || data.status !== 'success') {
          setSyncState('offline');
          if (showSuccessToast) {
            pushToast('error', 'Gagal memuat dari Google Sheets', data.message);
          }
          return;
        }

        const remoteKegiatan: Kegiatan[] = Array.isArray(data.kegiatan) ? data.kegiatan : [];
        const remotePeserta: Peserta[] = Array.isArray(data.peserta) ? data.peserta : [];

        if (remoteKegiatan.length > 0) {
          setDaftarKegiatan(remoteKegiatan);
          localStorage.setItem(STORAGE_KEYS.KEGIATAN, JSON.stringify(remoteKegiatan));
        }
        if (remotePeserta.length > 0) {
          setDataPeserta(remotePeserta);
          localStorage.setItem(STORAGE_KEYS.PESERTA, JSON.stringify(remotePeserta));
        }
        if (data.sheetHealth) {
          setSheetHealth(data.sheetHealth);
        }

        setSyncState('synced');
        if (showSuccessToast) {
          pushToast(
            'success',
            'Data berhasil dimuat dari Google Drive',
            `${remotePeserta.length} peserta dan ${remoteKegiatan.length} kegiatan.`
          );
        }
      } catch {
        setSyncState('offline');
        if (showSuccessToast) {
          pushToast('warning', 'Offline — Menampilkan data terakhir di browser');
        }
      }
    },
    [gasUrl, pushToast]
  );

  useEffect(() => {
    void loadFromGoogleSheets(undefined, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset pagination when filters change
  useEffect(() => {
    setPage(1);
  }, [filterTahun, filterJenis, filterKegiatan, filterKecamatan, searchQuery, activeTab]);

  // Derived data for active year
  const dataTahunIni = useMemo(
    () => dataPeserta.filter((p) => filterTahun === 'ALL' || p.tahun === filterTahun),
    [dataPeserta, filterTahun]
  );

  const uniqueKegiatanTahun = useMemo(() => {
    const master = daftarKegiatan
      .filter((k) => filterTahun === 'ALL' || k.tahun === filterTahun)
      .map((k) => k.nama);
    const fromPeserta = dataTahunIni.map((p) => p.kegiatan);
    return Array.from(new Set([...master, ...fromPeserta])).filter((n) => n && n !== '-');
  }, [daftarKegiatan, dataTahunIni, filterTahun]);

  const pesertaLspTahunIni = useMemo(
    () => dataTahunIni.filter((p) => isKegiatanLsp(p.kegiatan, daftarKegiatan)),
    [dataTahunIni, daftarKegiatan]
  );

  const uniqueLembagaCount = useMemo(() => {
    const set = new Set(
      dataTahunIni
        .map((p) => p.lembaga?.trim())
        .filter((l) => Boolean(l) && l !== '-')
    );
    return set.size;
  }, [dataTahunIni]);

  // Filtered rows with original index preserved for Edit/Delete
  const filteredRows = useMemo(() => {
    const kw = searchQuery.trim().toLowerCase();
    return dataPeserta
      .map((item, idx) => ({ item, originalIndex: idx }))
      .filter(({ item }) => {
        if (filterTahun !== 'ALL' && item.tahun !== filterTahun) return false;
        const lsp = isKegiatanLsp(item.kegiatan, daftarKegiatan);
        if (activeTab === 'lsp' && !lsp) return false;
        if (filterJenis === 'LSP' && !lsp) return false;
        if (filterJenis === 'Pelatihan' && lsp) return false;
        if (filterKegiatan && item.kegiatan !== filterKegiatan) return false;
        if (filterKecamatan && item.kecamatan !== filterKecamatan) return false;
        if (kw) {
          const hay = [
            item.nama,
            item.nik,
            item.kecamatan,
            item.alamat,
            item.telp,
            item.pendidikan,
            item.pekerjaan,
            item.lembaga,
            item.kegiatan,
            item.tahun,
          ]
            .join(' ')
            .toLowerCase();
          if (!hay.includes(kw)) return false;
        }
        return true;
      });
  }, [
    dataPeserta,
    daftarKegiatan,
    filterTahun,
    filterJenis,
    filterKegiatan,
    filterKecamatan,
    searchQuery,
    activeTab,
  ]);

  // Pagination slice
  const totalRows = filteredRows.length;
  const totalPages = pageSize === 0 ? 1 : Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedRows = useMemo(() => {
    if (pageSize === 0) return filteredRows;
    const start = (safePage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, safePage, pageSize]);

  // Helper to count participation history
  const getParticipationCount = useCallback(
    (row: Peserta) =>
      dataPeserta.filter(
        (p) =>
          (row.nik && row.nik !== '-' && p.nik === row.nik) ||
          (row.nama &&
            row.nama !== '-' &&
            p.nama.trim().toLowerCase() === row.nama.trim().toLowerCase())
      ).length,
    [dataPeserta]
  );

  // Auth handlers
  const handleLoginSuccess = (user: { username: string; label: string }) => {
    setIsAdmin(true);
    setAdminUser(user.username);
    sessionStorage.setItem(STORAGE_KEYS.AUTH, 'true');
    sessionStorage.setItem(STORAGE_KEYS.USER_LABEL, user.username);
    pushToast('success', `Selamat datang, ${user.username}`, 'Seluruh fitur admin telah aktif.');
  };

  const handleLogout = () => {
    setIsAdmin(false);
    sessionStorage.removeItem(STORAGE_KEYS.AUTH);
    sessionStorage.removeItem(STORAGE_KEYS.USER_LABEL);
    pushToast('info', 'Anda telah keluar dari mode Admin');
  };

  // CRUD Peserta
  const handleSavePeserta = (peserta: Peserta, editIndex: number | null) => {
    let nextPeserta: Peserta[];
    if (editIndex !== null && editIndex >= 0) {
      nextPeserta = dataPeserta.map((item, idx) => (idx === editIndex ? peserta : item));
    } else {
      nextPeserta = [peserta, ...dataPeserta];
    }

    // Auto-register new custom kegiatan if not yet in master list
    let nextKegiatan = daftarKegiatan;
    if (
      peserta.kegiatan &&
      peserta.kegiatan !== '-' &&
      !daftarKegiatan.some(
        (k) => k.nama.trim().toLowerCase() === peserta.kegiatan.trim().toLowerCase()
      )
    ) {
      const autoJenis = isKegiatanLsp(peserta.kegiatan, []) ? 'Sertifikasi LSP' : 'Pelatihan';
      nextKegiatan = [
        ...daftarKegiatan,
        { tahun: peserta.tahun || '2026', jenis: autoJenis, nama: peserta.kegiatan },
      ];
      setDaftarKegiatan(nextKegiatan);
    }

    setDataPeserta(nextPeserta);
    void saveToCloud(nextKegiatan, nextPeserta);
  };

  const handleRequestDeletePeserta = (index: number) => {
    const target = dataPeserta[index];
    if (!target) return;
    setConfirmState({
      isOpen: true,
      title: 'Hapus Data Peserta',
      message: `Yakin ingin menghapus data peserta "${target.nama}" (${target.kegiatan})? Tindakan ini juga akan memperbarui database Google Drive.`,
      onConfirm: () => {
        const nextPeserta = dataPeserta.filter((_, idx) => idx !== index);
        setDataPeserta(nextPeserta);
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
        void saveToCloud(daftarKegiatan, nextPeserta);
      },
    });
  };

  // CRUD Kegiatan
  const handleAddKegiatan = (keg: Kegiatan) => {
    const exists = daftarKegiatan.some(
      (k) =>
        k.tahun === keg.tahun && k.nama.trim().toLowerCase() === keg.nama.trim().toLowerCase()
    );
    if (exists) {
      pushToast('warning', 'Kegiatan dengan nama dan tahun tersebut sudah terdaftar');
      return;
    }
    const nextKegiatan = [...daftarKegiatan, keg];
    setDaftarKegiatan(nextKegiatan);
    void saveToCloud(nextKegiatan, dataPeserta);
  };

  const handleUpdateKegiatan = (index: number, updated: Kegiatan, oldNama: string) => {
    const nextKegiatan = daftarKegiatan.map((k, idx) => (idx === index ? updated : k));
    let nextPeserta = dataPeserta;
    if (oldNama !== updated.nama) {
      nextPeserta = dataPeserta.map((p) =>
        p.kegiatan === oldNama ? { ...p, kegiatan: updated.nama } : p
      );
      setDataPeserta(nextPeserta);
    }
    setDaftarKegiatan(nextKegiatan);
    void saveToCloud(nextKegiatan, nextPeserta);
  };

  const handleDeleteKegiatan = (index: number) => {
    const target = daftarKegiatan[index];
    if (!target) return;
    setConfirmState({
      isOpen: true,
      title: 'Hapus Master Kegiatan',
      message: `Hapus kegiatan "${target.nama}" (${target.tahun}) dari daftar master? Data peserta yang sudah ada tetap dipertahankan.`,
      onConfirm: () => {
        const nextKegiatan = daftarKegiatan.filter((_, idx) => idx !== index);
        setDaftarKegiatan(nextKegiatan);
        setConfirmState((prev) => ({ ...prev, isOpen: false }));
        void saveToCloud(nextKegiatan, dataPeserta);
      },
    });
  };

  // Excel / CSV Import
  const handleImportExcel = (rows: Peserta[], skipDuplicates: boolean) => {
    const rowsToInsert = skipDuplicates
      ? rows.filter(
          (row) =>
            !dataPeserta.some(
              (ex) =>
                ex.tahun === row.tahun &&
                ex.kegiatan.toLowerCase() === row.kegiatan.toLowerCase() &&
                ((row.nik !== '-' && ex.nik === row.nik) ||
                  (row.nama !== '-' && ex.nama.toLowerCase() === row.nama.toLowerCase()))
            )
        )
      : rows;

    if (rowsToInsert.length === 0) {
      pushToast('info', 'Semua baris dalam file sudah ada di database');
      return;
    }

    // Auto-register any new Kegiatan discovered in imported rows
    const nextKegiatan = [...daftarKegiatan];
    rowsToInsert.forEach((row) => {
      if (
        row.kegiatan &&
        row.kegiatan !== '-' &&
        !nextKegiatan.some(
          (k) =>
            k.tahun === row.tahun &&
            k.nama.trim().toLowerCase() === row.kegiatan.trim().toLowerCase()
        )
      ) {
        const jenis = isKegiatanLsp(row.kegiatan, []) ? 'Sertifikasi LSP' : 'Pelatihan';
        nextKegiatan.push({ tahun: row.tahun, jenis, nama: row.kegiatan });
      }
    });

    const nextPeserta = [...rowsToInsert, ...dataPeserta];
    setDaftarKegiatan(nextKegiatan);
    setDataPeserta(nextPeserta);

    // Automatically switch year filter to imported year if current filter would hide all imported rows
    const importedYears = Array.from(new Set(rowsToInsert.map((r) => r.tahun)));
    if (filterTahun !== 'ALL' && !importedYears.includes(filterTahun)) {
      setFilterTahun(importedYears.length === 1 ? importedYears[0] : 'ALL');
    }

    pushToast(
      'success',
      `Berhasil mengimpor ${rowsToInsert.length} data peserta`,
      'Menyimpan perubahan ke Google Drive / Sheets...'
    );
    void saveToCloud(nextKegiatan, nextPeserta);
  };

  // Sync & Backup handlers
  const handleUpdateGasUrl = (newUrl: string) => {
    setGasUrl(newUrl);
    localStorage.setItem(STORAGE_KEYS.GAS_URL, newUrl);
    pushToast('info', 'URL Google Apps Script diperbarui', 'Memuat ulang data dari cloud...');
    void loadFromGoogleSheets(newUrl, true);
  };

  const handleRestoreBackup = (kegiatan: Kegiatan[], peserta: Peserta[]) => {
    setDaftarKegiatan(kegiatan);
    setDataPeserta(peserta);
    setSyncModalOpen(false);
    pushToast('success', `Backup dipulihkan (${peserta.length} peserta)`);
    void saveToCloud(kegiatan, peserta);
  };

  const activeFiltersCount =
    (filterJenis !== 'ALL' ? 1 : 0) +
    (filterKegiatan ? 1 : 0) +
    (filterKecamatan ? 1 : 0) +
    (searchQuery.trim() ? 1 : 0);

  const clearAllFilters = () => {
    setFilterJenis('ALL');
    setFilterKegiatan('');
    setFilterKecamatan('');
    setSearchQuery('');
  };

  const yearLabel = filterTahun === 'ALL' ? 'Semua Tahun' : filterTahun;
  const lspPct =
    dataTahunIni.length > 0
      ? Math.round((pesertaLspTahunIni.length / dataTahunIni.length) * 100)
      : 0;

  return (
    <div className="min-h-screen flex bg-slate-50 text-slate-900">
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Left Sidebar Navigation */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200">
          <div className="min-w-0">
            <span className="text-sm font-bold tracking-tight text-[#0F4C81] whitespace-nowrap block">
              SIM-SDM Wakatobi
            </span>
            <span className="text-[11px] text-slate-500 block truncate">
              Dinas Pariwisata Kab. Wakatobi
            </span>
          </div>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 lg:hidden"
            aria-label="Tutup menu"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
          <div>
            <p className="px-3 text-[11px] font-semibold text-slate-400 mb-2">
              Navigasi Utama
            </p>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('dashboard');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  activeTab === 'dashboard'
                    ? 'bg-[#0F4C81]/10 text-[#0F4C81]'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                Ringkasan & Grafik
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('peserta');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  activeTab === 'peserta'
                    ? 'bg-[#0F4C81]/10 text-[#0F4C81]'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Users className="w-4 h-4 shrink-0" />
                Database Peserta
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('lsp');
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                  activeTab === 'lsp'
                    ? 'bg-amber-50 text-amber-800'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Award className="w-4 h-4 shrink-0" />
                Direktori LSP
              </button>
            </div>
          </div>

          <div>
            <p className="px-3 text-[11px] font-semibold text-slate-400 mb-2">
              Manajemen Data {isAdmin ? '' : '(Perlu Login)'}
            </p>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (!isAdmin) {
                    setLoginOpen(true);
                    return;
                  }
                  setEditingPeserta(null);
                  setPesertaModalOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors whitespace-nowrap"
              >
                <Plus className="w-4 h-4 shrink-0" />
                Input Manual
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (!isAdmin) {
                    setLoginOpen(true);
                    return;
                  }
                  setImportModalOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors whitespace-nowrap"
              >
                <Upload className="w-4 h-4 shrink-0" />
                Upload Excel / CSV
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (!isAdmin) {
                    setLoginOpen(true);
                    return;
                  }
                  setKegiatanModalOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors whitespace-nowrap"
              >
                <FolderCog className="w-4 h-4 shrink-0" />
                Kelola Kegiatan & LSP
              </button>
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (!isAdmin) {
                    setLoginOpen(true);
                    return;
                  }
                  setSyncModalOpen(true);
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 rounded-lg transition-colors whitespace-nowrap"
              >
                <Cloud className="w-4 h-4 shrink-0" />
                Sinkronisasi Drive
              </button>
            </div>
          </div>
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Status Cloud</span>
            <span
              className={`inline-flex items-center gap-1.5 font-medium ${
                syncState === 'synced'
                  ? 'text-emerald-700'
                  : syncState === 'saving' || syncState === 'loading'
                  ? 'text-amber-700'
                  : 'text-red-600'
              }`}
            >
              {syncState === 'offline' || syncState === 'error' ? (
                <CloudOff className="w-3.5 h-3.5" />
              ) : (
                <Cloud className="w-3.5 h-3.5" />
              )}
              {syncState === 'synced' && 'Google Drive Aktif'}
              {syncState === 'loading' && 'Memuat...'}
              {syncState === 'saving' && 'Menyimpan...'}
              {syncState === 'offline' && 'Mode Lokal'}
              {syncState === 'error' && 'Gagal Sinkron'}
              {syncState === 'idle' && 'Siap'}
            </span>
          </div>

          {isAdmin ? (
            <button
              type="button"
              onClick={handleLogout}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout ({adminUser})
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setLoginOpen(true)}
              className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-white bg-[#0F4C81] rounded-lg hover:bg-[#0c3d68] transition-colors whitespace-nowrap"
            >
              <Lock className="w-3.5 h-3.5" />
              Login Admin Tim
            </button>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
              aria-label="Buka menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0 flex items-center gap-2 text-sm">
              <span className="font-semibold text-slate-900 truncate">
                {activeTab === 'dashboard' && 'Ringkasan SDM Pariwisata'}
                {activeTab === 'peserta' && 'Database Peserta Pelatihan'}
                {activeTab === 'lsp' && 'Direktori SDM Tersertifikasi LSP'}
              </span>
              <span className="hidden sm:inline text-slate-300" aria-hidden="true">
                /
              </span>
              <span className="hidden sm:inline text-slate-500 whitespace-nowrap">
                {yearLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-1.5 bg-slate-100 rounded-lg px-2.5 py-1.5">
              <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <select
                aria-label="Filter Tahun"
                value={filterTahun}
                onChange={(e) => setFilterTahun(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value="ALL">Semua Tahun</option>
                {TAHUN_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    Tahun {t}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => void loadFromGoogleSheets(undefined, true)}
              disabled={syncState === 'loading' || syncState === 'saving'}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              title="Muat ulang data terbaru dari Google Drive"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${syncState === 'loading' ? 'animate-spin' : ''}`}
              />
              Sinkronkan
            </button>

            {isAdmin ? (
              <button
                type="button"
                onClick={() => {
                  setEditingPeserta(null);
                  setPesertaModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-[#0F4C81] rounded-lg hover:bg-[#0c3d68] transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                Input Peserta
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-white bg-[#0F4C81] rounded-lg hover:bg-[#0c3d68] transition-colors whitespace-nowrap shrink-0"
              >
                <Lock className="w-3.5 h-3.5" />
                Login Admin
              </button>
            )}
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1400px] w-full mx-auto space-y-6">
          {/* Sheet Health Notice (only when Admin & Google Sheet has legacy malformed headers) */}
          {isAdmin && sheetHealth && !sheetHealth.isHealthy && !dismissHealthBanner && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs text-amber-900">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold">
                    Perhatian Struktur Google Sheets:
                  </span>{' '}
                  Header tab di Google Sheets Anda saat ini hanya membaca{' '}
                  {sheetHealth.rawPesertaColumns} kolom. Agar 11 kolom lengkap tersimpan permanen di
                  Google Drive, perbarui skrip Apps Script melalui menu Sinkronisasi Drive.
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setSyncModalOpen(true)}
                  className="px-3 py-1.5 text-xs font-medium bg-amber-700 text-white rounded-lg hover:bg-amber-800 whitespace-nowrap"
                >
                  Lihat Panduan Perbaikan
                </button>
                <button
                  type="button"
                  onClick={() => setDismissHealthBanner(true)}
                  className="p-1 text-amber-700 hover:text-amber-900"
                  aria-label="Tutup pemberitahuan"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* KPI Strip */}
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Total Kegiatan Bidang</span>
                <Calendar className="w-4 h-4 text-slate-400" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-slate-900 font-mono-tabular">
                  {uniqueKegiatanTahun.length}
                </span>
                <span className="text-xs text-slate-500">{yearLabel}</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Total Kepesertaan</span>
                <Users className="w-4 h-4 text-slate-400" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-[#0F4C81] font-mono-tabular">
                  {dataTahunIni.length}
                </span>
                <span className="text-xs text-slate-500">Peserta terdaftar</span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Tersertifikasi LSP</span>
                <Award className="w-4 h-4 text-amber-600" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-amber-700 font-mono-tabular">
                  {pesertaLspTahunIni.length}
                </span>
                <span className="text-xs text-slate-500 font-mono-tabular">
                  {lspPct}% dari total
                </span>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Lembaga & Usaha Terlibat</span>
                <Building2 className="w-4 h-4 text-slate-400" />
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold text-[#0D9488] font-mono-tabular">
                  {uniqueLembagaCount}
                </span>
                <span className="text-xs text-slate-500">Pokdarwis / Usaha</span>
              </div>
            </div>
          </section>

          {/* Visual Analytics Grid (on Dashboard Tab) */}
          {activeTab === 'dashboard' && (
            <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
              <div className="xl:col-span-7 bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
                <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Distribusi Kegiatan Bidang ({yearLabel})
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Klik item pada grafik atau legenda untuk memfilter tabel peserta
                    </p>
                  </div>
                  {filterKegiatan && (
                    <button
                      type="button"
                      onClick={() => setFilterKegiatan('')}
                      className="text-xs font-medium text-[#0F4C81] hover:underline whitespace-nowrap"
                    >
                      Reset filter kegiatan
                    </button>
                  )}
                </div>
                <div className="pt-5 flex-1 flex flex-col justify-center">
                  <DonutChart
                    daftarKegiatan={daftarKegiatan}
                    dataPeserta={dataPeserta}
                    tahunDipilih={filterTahun}
                    selectedKegiatan={filterKegiatan}
                    onSelectKegiatan={setFilterKegiatan}
                  />
                </div>
              </div>

              <div className="xl:col-span-5 bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
                <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-100">
                  <div>
                    <h2 className="text-sm font-semibold text-slate-900">
                      Sebaran Wilayah Kecamatan ({yearLabel})
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Klik kecamatan untuk melihat daftar peserta wilayah tersebut
                    </p>
                  </div>
                  {filterKecamatan && (
                    <button
                      type="button"
                      onClick={() => setFilterKecamatan('')}
                      className="text-xs font-medium text-[#0F4C81] hover:underline whitespace-nowrap"
                    >
                      Reset wilayah
                    </button>
                  )}
                </div>
                <div className="pt-4 flex-1">
                  <KecamatanChart
                    dataPeserta={dataPeserta}
                    tahunDipilih={filterTahun}
                    selectedKecamatan={filterKecamatan}
                    onSelectKecamatan={setFilterKecamatan}
                  />
                </div>
              </div>
            </section>
          )}

          {/* Data Table Section */}
          <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 sm:p-5 border-b border-slate-200 space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                {/* Search & Filters */}
                <div className="flex flex-wrap items-center gap-2.5 flex-1">
                  <div className="relative flex-1 min-w-[240px]">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Cari Nama, NIK, Kecamatan, Lembaga, Kegiatan..."
                      className="w-full pl-9 pr-3 py-2 text-sm bg-slate-50 border border-slate-300 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/20 focus:border-[#0F4C81]"
                    />
                  </div>

                  {activeTab !== 'lsp' && (
                    <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                      {(['ALL', 'Pelatihan', 'LSP'] as const).map((tab) => (
                        <button
                          key={tab}
                          type="button"
                          onClick={() => setFilterJenis(tab)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                            filterJenis === tab
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {tab === 'ALL' ? 'Semua' : tab === 'LSP' ? 'Sertifikasi LSP' : 'Pelatihan'}
                        </button>
                      ))}
                    </div>
                  )}

                  <select
                    aria-label="Filter Kecamatan"
                    value={filterKecamatan}
                    onChange={(e) => setFilterKecamatan(e.target.value)}
                    className="px-3 py-2 text-xs font-medium bg-white border border-slate-300 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/20"
                  >
                    <option value="">Semua Kecamatan</option>
                    {KECAMATAN_WAKATOBI.map((kec) => (
                      <option key={kec} value={kec}>
                        {kec}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={downloadEmptyTemplateXlsx}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
                    Form Kosong
                  </button>

                  {isAdmin && (
                    <>
                      <button
                        type="button"
                        onClick={() => setImportModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-[#0F4C81] rounded-lg hover:bg-[#0c3d68] transition-colors whitespace-nowrap shrink-0"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        Upload Excel
                      </button>
                      <button
                        type="button"
                        onClick={() => setKegiatanModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                      >
                        <FolderCog className="w-3.5 h-3.5 text-slate-500" />
                        Kelola Kegiatan
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      exportRekapXlsx(
                        filteredRows.map((r) => r.item),
                        daftarKegiatan,
                        filterTahun
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-[#0D9488] rounded-lg hover:bg-[#0f766e] transition-colors whitespace-nowrap shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Export Excel
                  </button>
                </div>
              </div>

              {/* Active Filter Summary */}
              {activeFiltersCount > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>Filter aktif:</span>
                    {filterKegiatan && (
                      <button
                        type="button"
                        onClick={() => setFilterKegiatan('')}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800"
                      >
                        Kegiatan: {filterKegiatan}
                        <X className="w-3 h-3" />
                      </button>
                    )}
                    {filterKecamatan && (
                      <button
                        type="button"
                        onClick={() => setFilterKecamatan('')}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800"
                      >
                        Kec: {filterKecamatan}
                        <X className="w-3 h-3" />
                      </button>
                    )}
                    {filterJenis !== 'ALL' && (
                      <button
                        type="button"
                        onClick={() => setFilterJenis('ALL')}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800"
                      >
                        Kategori: {filterJenis}
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="font-medium text-[#0F4C81] hover:underline"
                  >
                    Bersihkan semua filter
                  </button>
                </div>
              )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                    <th className="px-4 py-3 whitespace-nowrap">Tahun</th>
                    <th className="px-4 py-3 whitespace-nowrap">Kegiatan Bidang</th>
                    <th className="px-4 py-3 whitespace-nowrap">Identitas Peserta (KTP)</th>
                    <th className="px-4 py-3 whitespace-nowrap">Kecamatan & Alamat</th>
                    <th className="px-4 py-3 whitespace-nowrap">Kontak & Profil</th>
                    <th className="px-4 py-3 whitespace-nowrap">Lembaga / Usaha</th>
                    <th className="px-4 py-3 whitespace-nowrap">Riwayat</th>
                    {isAdmin && (
                      <th className="px-4 py-3 text-right whitespace-nowrap">Aksi</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isAdmin ? 8 : 7}
                        className="px-6 py-12 text-center text-slate-500"
                      >
                        <p className="text-sm font-medium text-slate-700">
                          Tidak ada data peserta yang cocok dengan filter saat ini.
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Ubah kata kunci pencarian, pilih tahun lain, atau unggah data Excel baru.
                        </p>
                        <div className="mt-4 flex items-center justify-center gap-2">
                          {activeFiltersCount > 0 && (
                            <button
                              type="button"
                              onClick={clearAllFilters}
                              className="px-3.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
                            >
                              Reset Filter
                            </button>
                          )}
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => setImportModalOpen(true)}
                              className="px-3.5 py-1.5 text-xs font-medium text-white bg-[#0F4C81] rounded-lg hover:bg-[#0c3d68]"
                            >
                              Upload Excel Sekarang
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map(({ item, originalIndex }) => {
                      const isLsp = isKegiatanLsp(item.kegiatan, daftarKegiatan);
                      const totalIkut = getParticipationCount(item);

                      return (
                        <tr
                          key={`${originalIndex}-${item.nik}-${item.nama}`}
                          className="hover:bg-slate-50/80 transition-colors align-top"
                        >
                          <td className="px-4 py-3 font-mono-tabular font-semibold text-slate-900 whitespace-nowrap">
                            {item.tahun || '-'}
                          </td>
                          <td className="px-4 py-3 min-w-[220px] max-w-[300px]">
                            <p className="text-slate-900 font-medium leading-snug">
                              {item.kegiatan || '-'}
                            </p>
                            {isLsp && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 mt-1">
                                <Award className="w-3.5 h-3.5" />
                                Tersertifikasi LSP
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 min-w-[200px]">
                            <p className="font-semibold text-slate-900">
                              {item.nama && item.nama !== '-' ? item.nama : '(Tanpa Nama)'}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5 font-mono-tabular">
                              NIK {item.nik || '-'}
                              <span className="mx-1.5 text-slate-300" aria-hidden="true">
                                ·
                              </span>
                              <span className="font-sans">{item.jk || '-'}</span>
                            </p>
                          </td>
                          <td className="px-4 py-3 min-w-[170px]">
                            <p className="font-medium text-slate-800">
                              {item.kecamatan && item.kecamatan !== '-'
                                ? `Kec. ${item.kecamatan}`
                                : '-'}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">{item.alamat || '-'}</p>
                          </td>
                          <td className="px-4 py-3 min-w-[180px] text-xs text-slate-600 space-y-0.5">
                            <p className="font-mono-tabular text-slate-800">{item.telp || '-'}</p>
                            <p>{item.pendidikan || '-'}</p>
                            <p className="text-slate-500">{item.pekerjaan || '-'}</p>
                          </td>
                          <td className="px-4 py-3 min-w-[150px] text-slate-700">
                            {item.lembaga || '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() =>
                                setHistoryTarget({ nik: item.nik, nama: item.nama })
                              }
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#0F4C81] bg-[#0F4C81]/8 hover:bg-[#0F4C81]/15 rounded-md transition-colors font-mono-tabular"
                            >
                              <History className="w-3.5 h-3.5" />
                              {totalIkut}x Ikut
                            </button>
                          </td>
                          {isAdmin && (
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingPeserta({ index: originalIndex, data: item });
                                    setPesertaModalOpen(true);
                                  }}
                                  className="p-1.5 text-slate-500 hover:text-[#0F4C81] hover:bg-slate-100 rounded-md transition-colors"
                                  title="Edit peserta"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRequestDeletePeserta(originalIndex)}
                                  className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                  title="Hapus peserta"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="px-4 sm:px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
              <div className="flex items-center gap-2">
                <span className="font-mono-tabular">
                  Menampilkan{' '}
                  {totalRows === 0
                    ? 0
                    : pageSize === 0
                    ? `1–${totalRows}`
                    : `${(safePage - 1) * pageSize + 1}–${Math.min(
                        safePage * pageSize,
                        totalRows
                      )}`}{' '}
                  dari {totalRows} peserta
                </span>
                <span className="text-slate-300" aria-hidden="true">
                  |
                </span>
                <label className="inline-flex items-center gap-1.5">
                  <span>Baris:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-mono-tabular"
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={0}>Semua</option>
                  </select>
                </label>
              </div>

              {pageSize !== 0 && totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={safePage <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="p-1.5 rounded-md bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    aria-label="Halaman sebelumnya"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-2 font-mono-tabular font-medium">
                    Hal {safePage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={safePage >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="p-1.5 rounded-md bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                    aria-label="Halaman berikutnya"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </section>
        </main>
      </div>

      {/* Modals */}
      <LoginModal
        isOpen={loginOpen}
        onClose={() => setLoginOpen(false)}
        onSuccess={handleLoginSuccess}
      />

      <PesertaModal
        isOpen={pesertaModalOpen}
        onClose={() => {
          setPesertaModalOpen(false);
          setEditingPeserta(null);
        }}
        editingPeserta={editingPeserta}
        daftarKegiatan={daftarKegiatan}
        defaultTahun={filterTahun}
        onSave={handleSavePeserta}
      />

      <KegiatanModal
        isOpen={kegiatanModalOpen}
        onClose={() => setKegiatanModalOpen(false)}
        daftarKegiatan={daftarKegiatan}
        dataPeserta={dataPeserta}
        defaultTahun={filterTahun}
        onAdd={handleAddKegiatan}
        onUpdate={handleUpdateKegiatan}
        onDelete={handleDeleteKegiatan}
      />

      <ImportExcelModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        daftarKegiatan={daftarKegiatan}
        existingPeserta={dataPeserta}
        defaultTahun={filterTahun}
        onImport={handleImportExcel}
      />

      <SyncSettingsModal
        isOpen={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        gasUrl={gasUrl}
        onUpdateGasUrl={handleUpdateGasUrl}
        syncState={syncState}
        sheetHealth={sheetHealth}
        onReloadFromSheets={() => loadFromGoogleSheets(undefined, true)}
        onForcePushToSheets={() => saveToCloud(daftarKegiatan, dataPeserta)}
        daftarKegiatan={daftarKegiatan}
        dataPeserta={dataPeserta}
        onRestoreBackup={handleRestoreBackup}
      />

      <HistoryModal
        isOpen={Boolean(historyTarget)}
        onClose={() => setHistoryTarget(null)}
        target={historyTarget}
        dataPeserta={dataPeserta}
        daftarKegiatan={daftarKegiatan}
      />

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState((prev) => ({ ...prev, isOpen: false }))}
      />

      {/* Toast Notification Container */}
      {toasts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
          {toasts.map((toast) => (
            <div
              key={toast.id}
              className="pointer-events-auto bg-white border border-slate-200 rounded-xl shadow-lg p-3.5 flex items-start gap-2.5"
            >
              {toast.type === 'success' && (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              )}
              {toast.type === 'error' && (
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              )}
              {toast.type === 'warning' && (
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              )}
              {toast.type === 'info' && (
                <Cloud className="w-4 h-4 text-[#0F4C81] shrink-0 mt-0.5" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-900">{toast.title}</p>
                {toast.description && (
                  <p className="text-xs text-slate-500 mt-0.5">{toast.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() =>
                  setToasts((prev) => prev.filter((t) => t.id !== toast.id))
                }
                className="text-slate-400 hover:text-slate-700 p-0.5"
                aria-label="Tutup notifikasi"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
