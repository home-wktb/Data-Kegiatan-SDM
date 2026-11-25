import React from 'react';
import { Award, BookOpen, MapPin, Phone, User, X } from 'lucide-react';
import type { Kegiatan, Peserta } from '../types/sdm';
import { isKegiatanLsp } from '../utils/sheetsParser';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: { nik: string; nama: string } | null;
  dataPeserta: Peserta[];
  daftarKegiatan: Kegiatan[];
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  target,
  dataPeserta,
  daftarKegiatan,
}) => {
  if (!isOpen || !target) return null;

  const riwayat = dataPeserta
    .filter(
      (p) =>
        (target.nik && target.nik !== '-' && p.nik === target.nik) ||
        (target.nama &&
          target.nama !== '-' &&
          p.nama.trim().toLowerCase() === target.nama.trim().toLowerCase())
    )
    .sort((a, b) => Number(b.tahun || 0) - Number(a.tahun || 0));

  const latest = riwayat[0];
  const lspCount = riwayat.filter((r) => isKegiatanLsp(r.kegiatan, daftarKegiatan)).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Riwayat Pelatihan & Sertifikasi SDM
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Rekam jejak partisipasi berdasarkan NIK / Nama Lengkap KTP
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5">
          {latest ? (
            <>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-[#0F4C81]/10 text-[#0F4C81] flex items-center justify-center shrink-0">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">
                        {latest.nama || target.nama}
                      </h4>
                      <p className="text-xs text-slate-500 font-mono-tabular">
                        NIK: {latest.nik || target.nik || '-'} · {latest.jk || '-'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-semibold text-[#0F4C81] font-mono-tabular">
                      {riwayat.length} Kali Keikutsertaan
                    </span>
                    {lspCount > 0 && (
                      <p className="text-[11px] font-medium text-amber-700">
                        {lspCount} Sertifikasi LSP
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-2 border-t border-slate-200/80 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    Kec. {latest.kecamatan || '-'} · {latest.alamat || '-'}
                  </span>
                  <span className="inline-flex items-center gap-1 font-mono-tabular">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {latest.telp || '-'}
                  </span>
                </div>
              </div>

              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                {riwayat.map((item, idx) => {
                  const isLsp = isKegiatanLsp(item.kegiatan, daftarKegiatan);
                  return (
                    <div key={`${item.tahun}-${item.kegiatan}-${idx}`} className="p-3.5 flex gap-3">
                      <div className="mt-0.5 shrink-0">
                        {isLsp ? (
                          <Award className="w-4 h-4 text-amber-600" />
                        ) : (
                          <BookOpen className="w-4 h-4 text-[#0F4C81]" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-semibold font-mono-tabular text-slate-500">
                            Tahun {item.tahun || '-'}
                          </span>
                          {isLsp && (
                            <span className="text-[11px] font-semibold text-amber-700">
                              Tersertifikasi LSP
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium text-slate-900 mt-0.5">
                          {item.kegiatan || '-'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Lembaga: {item.lembaga || '-'} · Pekerjaan: {item.pekerjaan || '-'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-500 text-center py-6">
              Data riwayat peserta tidak ditemukan.
            </p>
          )}
        </div>

        <div className="px-6 py-3.5 border-t border-slate-200 bg-slate-50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
