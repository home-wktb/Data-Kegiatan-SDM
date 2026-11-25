import React, { useState } from 'react';
import { Award, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  TAHUN_OPTIONS,
  type JenisKegiatan,
  type Kegiatan,
  type Peserta,
} from '../types/sdm';

interface KegiatanModalProps {
  isOpen: boolean;
  onClose: () => void;
  daftarKegiatan: Kegiatan[];
  dataPeserta: Peserta[];
  defaultTahun: string;
  onAdd: (kegiatan: Kegiatan) => void;
  onUpdate: (index: number, updated: Kegiatan, oldNama: string) => void;
  onDelete: (index: number) => void;
}

export const KegiatanModal: React.FC<KegiatanModalProps> = ({
  isOpen,
  onClose,
  daftarKegiatan,
  dataPeserta,
  defaultTahun,
  onAdd,
  onUpdate,
  onDelete,
}) => {
  const [tahun, setTahun] = useState(defaultTahun === 'ALL' ? '2026' : defaultTahun);
  const [jenis, setJenis] = useState<JenisKegiatan>('Pelatihan');
  const [nama, setNama] = useState('');
  const [editIdx, setEditIdx] = useState<number | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNama = nama.trim();
    if (!cleanNama) return;

    if (editIdx !== null) {
      const oldNama = daftarKegiatan[editIdx].nama;
      onUpdate(editIdx, { tahun, jenis, nama: cleanNama }, oldNama);
      setEditIdx(null);
    } else {
      onAdd({ tahun, jenis, nama: cleanNama });
    }
    setNama('');
  };

  const startEdit = (idx: number) => {
    const item = daftarKegiatan[idx];
    setEditIdx(idx);
    setTahun(item.tahun);
    setJenis(item.jenis);
    setNama(item.nama);
  };

  const cancelEdit = () => {
    setEditIdx(null);
    setNama('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Kelola Kegiatan Bidang & Skema LSP
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Tambah, ubah, atau hapus master kegiatan pelatihan dan sertifikasi kompetensi
            </p>
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
          <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">
                {editIdx !== null ? 'Edit Kegiatan Terpilih' : 'Tambah Kegiatan Baru'}
              </span>
              {editIdx !== null && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="text-xs text-slate-500 hover:text-slate-800"
                >
                  Batal Edit
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Tahun Pelaksanaan
                </label>
                <select
                  value={tahun}
                  onChange={(e) => setTahun(e.target.value)}
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
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Kategori Kegiatan
                </label>
                <select
                  value={jenis}
                  onChange={(e) => setJenis(e.target.value as JenisKegiatan)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/20 focus:border-[#0F4C81]"
                >
                  <option value="Pelatihan">Pelatihan / Bimtek Biasa</option>
                  <option value="Sertifikasi LSP">Sertifikasi Kompetensi (LSP)</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                placeholder="Nama kegiatan atau skema sertifikasi LSP..."
                required
                className="flex-1 px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/20 focus:border-[#0F4C81]"
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#0F4C81] rounded-lg hover:bg-[#0c3d68] transition-colors whitespace-nowrap shrink-0"
              >
                <Plus className="w-4 h-4" />
                {editIdx !== null ? 'Simpan Perubahan' : 'Simpan Kegiatan'}
              </button>
            </div>
          </form>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-slate-700">
                Daftar Kegiatan Terdaftar ({daftarKegiatan.length})
              </h4>
            </div>
            <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {daftarKegiatan.length === 0 ? (
                <p className="p-4 text-center text-sm text-slate-500">
                  Belum ada kegiatan terdaftar.
                </p>
              ) : (
                daftarKegiatan.map((k, idx) => {
                  const pesertaCount = dataPeserta.filter(
                    (p) => p.kegiatan === k.nama && p.tahun === k.tahun
                  ).length;
                  return (
                    <div
                      key={`${k.tahun}-${k.nama}-${idx}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-mono-tabular font-semibold text-slate-700">
                            {k.tahun}
                          </span>
                          <span aria-hidden="true">·</span>
                          {k.jenis === 'Sertifikasi LSP' ? (
                            <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                              <Award className="w-3.5 h-3.5" />
                              Sertifikasi LSP
                            </span>
                          ) : (
                            <span>Pelatihan</span>
                          )}
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular">{pesertaCount} peserta</span>
                        </div>
                        <p className="text-sm font-medium text-slate-900 mt-0.5 truncate">
                          {k.nama}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEdit(idx)}
                          className="p-1.5 text-slate-500 hover:text-[#0F4C81] hover:bg-slate-100 rounded-md transition-colors"
                          title="Edit kegiatan"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDelete(idx)}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Hapus kegiatan"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
