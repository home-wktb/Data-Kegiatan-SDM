import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Cloud,
  Copy,
  Download,
  RefreshCw,
  RotateCcw,
  Upload,
  X,
} from 'lucide-react';
import {
  DEFAULT_GAS_URL,
  type CloudSyncState,
  type Kegiatan,
  type Peserta,
  type SheetHealth,
} from '../types/sdm';

interface SyncSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  gasUrl: string;
  onUpdateGasUrl: (url: string) => void;
  syncState: CloudSyncState;
  sheetHealth: SheetHealth | null;
  onReloadFromSheets: () => Promise<void>;
  onForcePushToSheets: () => Promise<void>;
  daftarKegiatan: Kegiatan[];
  dataPeserta: Peserta[];
  onRestoreBackup: (kegiatan: Kegiatan[], peserta: Peserta[]) => void;
}

const RECOMMENDED_CODE_GS = `function doGet(e) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sPeserta = ss.getSheetByName("peserta") || ss.insertSheet("peserta");
  var sKegiatan = ss.getSheetByName("kegiatan") || ss.insertSheet("kegiatan");

  var hPeserta = ["tahun","kegiatan","nik","nama","jk","kecamatan","alamat","telp","pendidikan","pekerjaan","lembaga"];
  var hKegiatan = ["tahun","jenis","nama"];

  if (sPeserta.getLastRow() === 0) sPeserta.appendRow(hPeserta);
  if (sKegiatan.getLastRow() === 0) sKegiatan.appendRow(hKegiatan);

  function readRows(sheet, expectedHeaders) {
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];
    var values = sheet.getRange(2, 1, lastRow - 1, expectedHeaders.length).getValues();
    return values.map(function(row) {
      var obj = {};
      expectedHeaders.forEach(function(key, idx) {
        obj[key] = row[idx] !== undefined && row[idx] !== null ? String(row[idx]) : "-";
      });
      return obj;
    });
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    peserta: readRows(sPeserta, hPeserta),
    kegiatan: readRows(sKegiatan, hKegiatan)
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var payload = JSON.parse(e.postData.contents);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sPeserta = ss.getSheetByName("peserta") || ss.insertSheet("peserta");
  var sKegiatan = ss.getSheetByName("kegiatan") || ss.insertSheet("kegiatan");

  var hPeserta = ["tahun","kegiatan","nik","nama","jk","kecamatan","alamat","telp","pendidikan","pekerjaan","lembaga"];
  var hKegiatan = ["tahun","jenis","nama"];

  sPeserta.clearContents();
  sPeserta.appendRow(hPeserta);
  if (payload.peserta && payload.peserta.length > 0) {
    var rowsP = payload.peserta.map(function(p) {
      return hPeserta.map(function(k) {
        var v = p[k] || "-";
        if ((k === "nik" || k === "telp") && v !== "-") return "'" + String(v).replace(/^'/, "");
        return String(v);
      });
    });
    sPeserta.getRange(2, 1, rowsP.length, hPeserta.length).setValues(rowsP);
  }

  sKegiatan.clearContents();
  sKegiatan.appendRow(hKegiatan);
  if (payload.kegiatan && payload.kegiatan.length > 0) {
    var rowsK = payload.kegiatan.map(function(k) {
      return [String(k.tahun || "2026"), String(k.jenis || "Pelatihan"), String(k.nama || "-")];
    });
    sKegiatan.getRange(2, 1, rowsK.length, hKegiatan.length).setValues(rowsK);
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: "success",
    pesertaCount: (payload.peserta || []).length,
    kegiatanCount: (payload.kegiatan || []).length
  })).setMimeType(ContentService.MimeType.JSON);
}`;

export const SyncSettingsModal: React.FC<SyncSettingsModalProps> = ({
  isOpen,
  onClose,
  gasUrl,
  onUpdateGasUrl,
  syncState,
  sheetHealth,
  onReloadFromSheets,
  onForcePushToSheets,
  daftarKegiatan,
  dataPeserta,
  onRestoreBackup,
}) => {
  const [urlInput, setUrlInput] = useState(gasUrl);
  const [copiedCode, setCopiedCode] = useState(false);
  const [restoreError, setRestoreError] = useState('');
  const restoreRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleSaveUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim().startsWith('https://script.google.com/')) return;
    onUpdateGasUrl(urlInput.trim());
  };

  const handleDownloadBackup = () => {
    const paket = {
      tanggalBackup: new Date().toISOString(),
      kegiatan: daftarKegiatan,
      peserta: dataPeserta,
    };
    const blob = new Blob([JSON.stringify(paket, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Database_SDM_Wakatobi_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRestoreFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRestoreError('');
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(String(ev.target?.result || '{}'));
        if (Array.isArray(json.kegiatan) && Array.isArray(json.peserta)) {
          onRestoreBackup(json.kegiatan, json.peserta);
        } else {
          setRestoreError('Struktur file JSON backup tidak sesuai.');
        }
      } catch {
        setRestoreError('Gagal membaca file JSON backup.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const copyCodeGs = async () => {
    await navigator.clipboard.writeText(RECOMMENDED_CODE_GS);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2500);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-[#0F4C81]/10 text-[#0F4C81] flex items-center justify-center">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Sinkronisasi Google Drive / Sheets & Backup
              </h3>
              <p className="text-xs text-slate-500">
                Database terpusat agar tim dari PC mana saja mengakses data yang sama
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Cloud URL Config */}
          <form onSubmit={handleSaveUrl} className="space-y-3">
            <label className="block text-xs font-semibold text-slate-700">
              URL Web App Google Apps Script
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                required
                className="flex-1 px-3 py-2 text-xs font-mono-tabular bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/20 focus:border-[#0F4C81]"
              />
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium text-white bg-[#0F4C81] rounded-lg hover:bg-[#0c3d68] whitespace-nowrap shrink-0"
              >
                Simpan URL
              </button>
              <button
                type="button"
                onClick={() => setUrlInput(DEFAULT_GAS_URL)}
                className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap shrink-0"
                title="Kembalikan ke URL awal"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Default
              </button>
            </div>
          </form>

          {/* Manual Sync Actions */}
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              type="button"
              disabled={syncState === 'loading' || syncState === 'saving'}
              onClick={() => void onReloadFromSheets()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${syncState === 'loading' ? 'animate-spin' : ''}`}
              />
              Muat Ulang dari Google Sheets
            </button>
            <button
              type="button"
              disabled={syncState === 'loading' || syncState === 'saving'}
              onClick={() => void onForcePushToSheets()}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-[#0D9488] rounded-lg hover:bg-[#0f766e] disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
              Kirim & Timpa ke Google Sheets Sekarang
            </button>
          </div>

          {/* Sheet Health Diagnostic */}
          {sheetHealth && !sheetHealth.isHealthy && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-900 space-y-1">
                  <p className="font-semibold">
                    Peringatan Struktur Header Google Sheets ({sheetHealth.rawPesertaColumns} dari 11 kolom terbaca)
                  </p>
                  {sheetHealth.issues.map((issue, idx) => (
                    <p key={idx}>{issue}</p>
                  ))}
                  <p className="pt-1">
                    Aplikasi tetap menormalkan data yang ada, namun agar kolom <strong>Kecamatan, Alamat, Telepon, Pendidikan, Pekerjaan, dan Lembaga</strong> tersimpan penuh di Google Drive, perbarui skrip Google Apps Script Anda dengan kode resmi berikut:
                  </p>
                </div>
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => void copyCodeGs()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-amber-300 text-amber-900 rounded-md hover:bg-amber-100 transition-colors"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedCode ? 'Kode Code.gs Tersalin' : 'Salin Kode Code.gs Lengkap'}
                </button>
              </div>
            </div>
          )}

          {/* JSON Backup & Restore */}
          <div className="border-t border-slate-200 pt-5 space-y-3">
            <h4 className="text-xs font-semibold text-slate-800">
              Cadangan Lokal (Backup & Restore JSON)
            </h4>
            <p className="text-xs text-slate-500">
              Unduh arsip database lengkap ke komputer atau pulihkan kembali dari file backup .json.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleDownloadBackup}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                <Download className="w-3.5 h-3.5" />
                Unduh Backup (.json)
              </button>
              <button
                type="button"
                onClick={() => restoreRef.current?.click()}
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-800 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
              >
                <Upload className="w-3.5 h-3.5" />
                Restore dari File (.json)
              </button>
              <input
                ref={restoreRef}
                type="file"
                accept=".json"
                onChange={handleRestoreFile}
                className="hidden"
              />
            </div>
            {restoreError && <p className="text-xs text-red-600">{restoreError}</p>}
          </div>
        </div>

        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
