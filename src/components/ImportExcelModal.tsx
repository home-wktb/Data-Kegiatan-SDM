import React, { useRef, useState } from 'react';
import { CheckCircle2, FileSpreadsheet, Upload, X, AlertCircle } from 'lucide-react';
import { TAHUN_OPTIONS, type Kegiatan, type Peserta } from '../types/sdm';
import {
  downloadEmptyTemplateCsv,
  downloadEmptyTemplateXlsx,
  parseSpreadsheetFile,
  type ParsedSpreadsheetResult,
} from '../utils/sheetsParser';

interface ImportExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  daftarKegiatan: Kegiatan[];
  existingPeserta: Peserta[];
  defaultTahun: string;
  onImport: (rows: Peserta[], skipDuplicates: boolean) => void;
}

export const ImportExcelModal: React.FC<ImportExcelModalProps> = ({
  isOpen,
  onClose,
  daftarKegiatan,
  existingPeserta,
  defaultTahun,
  onImport,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedSpreadsheetResult | null>(null);
  const [fallbackTahun, setFallbackTahun] = useState(
    defaultTahun === 'ALL' ? '2026' : defaultTahun
  );
  const [fallbackKegiatan, setFallbackKegiatan] = useState(daftarKegiatan[0]?.nama || '');
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  if (!isOpen) return null;

  const processFile = async (file: File, sheetName?: string) => {
    setError('');
    setLoading(true);
    try {
      const result = await parseSpreadsheetFile(file, {
        sheetName,
        defaultTahun: fallbackTahun,
        defaultKegiatan: fallbackKegiatan || '-',
      });
      setSelectedFile(file);
      setParsed(result);
      if (result.rows.length === 0) {
        setError(
          'File terbaca, namun tidak ditemukan baris peserta yang memiliki Nama atau NIK. Periksa kembali isi sheet Excel Anda.'
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Format file tidak dapat dibaca';
      setError(`Gagal membaca file Excel/CSV: ${msg}`);
      setParsed(null);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void processFile(file);
    }
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void processFile(file);
    }
  };

  const handleSheetChange = (sheetName: string) => {
    if (selectedFile) {
      void processFile(selectedFile, sheetName);
    }
  };

  const applyFallbackRows = (rows: Peserta[]): Peserta[] =>
    rows.map((r) => ({
      ...r,
      tahun: r.tahun || fallbackTahun,
      kegiatan: r.kegiatan && r.kegiatan !== '-' ? r.kegiatan : fallbackKegiatan || '-',
    }));

  const readyRows = parsed ? applyFallbackRows(parsed.rows) : [];

  const duplicateCount = readyRows.filter((row) =>
    existingPeserta.some(
      (ex) =>
        ex.tahun === row.tahun &&
        ex.kegiatan.toLowerCase() === row.kegiatan.toLowerCase() &&
        ((row.nik !== '-' && ex.nik === row.nik) ||
          (row.nama !== '-' && ex.nama.toLowerCase() === row.nama.toLowerCase()))
    )
  ).length;

  const finalImportCount = skipDuplicates
    ? Math.max(0, readyRows.length - duplicateCount)
    : readyRows.length;

  const handleConfirmImport = () => {
    if (readyRows.length === 0) return;
    onImport(readyRows, skipDuplicates);
    setSelectedFile(null);
    setParsed(null);
    setError('');
    onClose();
  };

  const handleClose = () => {
    setSelectedFile(null);
    setParsed(null);
    setError('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-4xl bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#0F4C81]/10 text-[#0F4C81] flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Upload Data Peserta dari Excel / CSV
              </h3>
              <p className="text-xs text-slate-500">
                Mendukung format .xlsx, .xls, dan .csv (pemisah koma atau titik koma)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {/* Template download helper & default fallback */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
            <div className="text-xs text-slate-600">
              Belum punya format tabelnya? Unduh template resmi agar semua 11 kolom terbaca otomatis.
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={downloadEmptyTemplateXlsx}
                className="px-3 py-1.5 text-xs font-medium text-[#0F4C81] bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Unduh Template (.xlsx)
              </button>
              <button
                type="button"
                onClick={downloadEmptyTemplateCsv}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Unduh Template (.csv)
              </button>
            </div>
          </div>

          {/* Dropzone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              dragOver
                ? 'border-[#0F4C81] bg-[#0F4C81]/5'
                : 'border-slate-300 hover:border-[#0F4C81] hover:bg-slate-50/70'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <Upload className="w-8 h-8 text-[#0F4C81] mx-auto mb-2" />
            <p className="text-sm font-medium text-slate-900">
              {selectedFile
                ? `File terpilih: ${selectedFile.name}`
                : 'Klik untuk memilih file Excel/CSV atau seret file ke sini'}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Otomatis mendeteksi kolom Tahun, Nama Kegiatan, NIK, Nama Lengkap, JK, Kecamatan, Alamat, Telp, Pendidikan, Pekerjaan, Lembaga
            </p>
          </div>

          {/* Fallback defaults when Excel lacks Tahun or Kegiatan column */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Tahun Default (jika kolom Tahun kosong di Excel)
              </label>
              <select
                value={fallbackTahun}
                onChange={(e) => {
                  setFallbackTahun(e.target.value);
                  if (selectedFile) void processFile(selectedFile, parsed?.activeSheet);
                }}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/20 focus:border-[#0F4C81]"
              >
                {TAHUN_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Kegiatan Default (jika kolom Kegiatan kosong di Excel)
              </label>
              <select
                value={fallbackKegiatan}
                onChange={(e) => setFallbackKegiatan(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/20 focus:border-[#0F4C81]"
              >
                <option value="">-- Gunakan isi kolom dari Excel --</option>
                {daftarKegiatan.map((k, idx) => (
                  <option key={`${k.tahun}-${k.nama}-${idx}`} value={k.nama}>
                    [{k.tahun}] {k.nama}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading && (
            <div className="p-4 text-center text-sm text-slate-600 bg-slate-50 rounded-lg border border-slate-200">
              Sedang memproses isi file Excel...
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {parsed && parsed.rows.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-emerald-700 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    Berhasil membaca {readyRows.length} baris peserta
                    {parsed.usedHeaderMapping
                      ? ' (pencocokan header otomatis)'
                      : ' (urutan kolom standar)'}
                  </span>
                </div>

                {parsed.sheetNames.length > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600">Sheet Excel:</span>
                    <select
                      value={parsed.activeSheet}
                      onChange={(e) => handleSheetChange(e.target.value)}
                      className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-md"
                    >
                      {parsed.sheetNames.map((name) => (
                        <option key={name} value={name}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={skipDuplicates}
                  onChange={(e) => setSkipDuplicates(e.target.checked)}
                  className="rounded border-slate-300 text-[#0F4C81] focus:ring-[#0F4C81]"
                />
                <span>
                  Lewati data duplikat yang sudah ada ({duplicateCount} baris terdeteksi sama)
                </span>
              </label>

              <div className="border border-slate-200 rounded-lg overflow-x-auto max-h-64">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 text-slate-600 sticky top-0 border-b border-slate-200">
                    <tr>
                      <th className="px-3 py-2 font-semibold">#</th>
                      <th className="px-3 py-2 font-semibold">Tahun</th>
                      <th className="px-3 py-2 font-semibold">Kegiatan</th>
                      <th className="px-3 py-2 font-semibold">NIK</th>
                      <th className="px-3 py-2 font-semibold">Nama Lengkap</th>
                      <th className="px-3 py-2 font-semibold">Kecamatan</th>
                      <th className="px-3 py-2 font-semibold">Lembaga</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {readyRows.slice(0, 50).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-mono-tabular text-slate-400">{idx + 1}</td>
                        <td className="px-3 py-2 font-mono-tabular font-medium">{row.tahun}</td>
                        <td className="px-3 py-2 max-w-[200px] truncate">{row.kegiatan}</td>
                        <td className="px-3 py-2 font-mono-tabular">{row.nik}</td>
                        <td className="px-3 py-2 font-medium text-slate-900">{row.nama}</td>
                        <td className="px-3 py-2">{row.kecamatan}</td>
                        <td className="px-3 py-2">{row.lembaga}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {readyRows.length > 50 && (
                  <div className="px-3 py-2 text-xs text-slate-500 bg-slate-50 border-t border-slate-200">
                    Menampilkan 50 dari {readyRows.length} baris pratinjau...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            Data baru akan langsung tampil di tabel & tersinkron ke Google Drive.
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="button"
              disabled={!parsed || finalImportCount === 0}
              onClick={handleConfirmImport}
              className="px-4 py-2 text-sm font-medium text-white bg-[#0F4C81] rounded-lg hover:bg-[#0c3d68] disabled:opacity-50 transition-colors"
            >
              Impor {finalImportCount > 0 ? `${finalImportCount} Data` : ''} & Simpan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
