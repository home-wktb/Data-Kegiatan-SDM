import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  KECAMATAN_WAKATOBI,
  PENDIDIKAN_OPTIONS,
  TAHUN_OPTIONS,
  type Kegiatan,
  type Peserta,
} from '../types/sdm';

interface PesertaModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingPeserta: { index: number; data: Peserta } | null;
  daftarKegiatan: Kegiatan[];
  defaultTahun: string;
  onSave: (peserta: Peserta, editIndex: number | null) => void;
}

const emptyForm = (tahun: string, defaultKegiatan: string): Peserta => ({
  tahun,
  kegiatan: defaultKegiatan,
  nik: '',
  nama: '',
  jk: '-',
  kecamatan: '-',
  alamat: '',
  telp: '',
  pendidikan: '-',
  pekerjaan: '',
  lembaga: '',
});

export const PesertaModal: React.FC<PesertaModalProps> = ({
  isOpen,
  onClose,
  editingPeserta,
  daftarKegiatan,
  defaultTahun,
  onSave,
}) => {
  const [form, setForm] = useState<Peserta>(() =>
    emptyForm(
      defaultTahun === 'ALL' ? '2026' : defaultTahun,
      daftarKegiatan[0]?.nama || ''
    )
  );
  const [customKegiatanMode, setCustomKegiatanMode] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (editingPeserta) {
      const p = editingPeserta.data;
      const cleanVal = (v: string) => (v === '-' ? '' : v || '');
      const kegiatanExists = daftarKegiatan.some((k) => k.nama === p.kegiatan);
      setCustomKegiatanMode(Boolean(p.kegiatan && p.kegiatan !== '-' && !kegiatanExists));
      setForm({
        tahun: p.tahun || '2026',
        kegiatan: p.kegiatan === '-' ? daftarKegiatan[0]?.nama || '' : p.kegiatan,
        nik: cleanVal(p.nik),
        nama: cleanVal(p.nama),
        jk: p.jk || '-',
        kecamatan: p.kecamatan || '-',
        alamat: cleanVal(p.alamat),
        telp: cleanVal(p.telp),
        pendidikan: p.pendidikan || '-',
        pekerjaan: cleanVal(p.pekerjaan),
        lembaga: cleanVal(p.lembaga),
      });
    } else {
      setCustomKegiatanMode(daftarKegiatan.length === 0);
      const fallbackYear = defaultTahun === 'ALL' ? '2026' : defaultTahun;
      const yearKeg =
        daftarKegiatan.find((k) => k.tahun === fallbackYear)?.nama ||
        daftarKegiatan[0]?.nama ||
        '';
      setForm(emptyForm(fallbackYear, yearKeg));
    }
  }, [isOpen, editingPeserta, daftarKegiatan, defaultTahun]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned: Peserta = {
      tahun: form.tahun || '2026',
      kegiatan: form.kegiatan.trim() || '-',
      nik: form.nik.trim() || '-',
      nama: form.nama.trim() || '-',
      jk: form.jk || '-',
      kecamatan: form.kecamatan || '-',
      alamat: form.alamat.trim() || '-',
      telp: form.telp.trim() || '-',
      pendidikan: form.pendidikan || '-',
      pekerjaan: form.pekerjaan.trim() || '-',
      lembaga: form.lembaga.trim() || '-',
    };
    onSave(cleaned, editingPeserta ? editingPeserta.index : null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              {editingPeserta ? 'Edit Data Peserta' : 'Input Data Peserta Manual'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Perubahan akan otomatis tersimpan ke database Google Drive / Sheets
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

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Tahun Kegiatan
              </label>
              <select
                value={form.tahun}
                onChange={(e) => setForm({ ...form, tahun: e.target.value })}
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
                Jenis Kelamin
              </label>
              <select
                value={form.jk}
                onChange={(e) => setForm({ ...form, jk: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/20 focus:border-[#0F4C81]"
              >
                <option value="-">-- Pilih Jenis Kelamin --</option>
                <option value="Laki-laki">Laki-laki</option>
                <option value="Perempuan">Perempuan</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-medium text-slate-700">
                Kegiatan Bidang / Skema LSP
              </label>
              <button
                type="button"
                onClick={() => setCustomKegiatanMode((prev) => !prev)}
                className="text-xs font-medium text-[#0F4C81] hover:underline"
              >
                {customKegiatanMode ? 'Pilih dari daftar kegiatan' : 'Ketik nama kegiatan baru'}
              </button>
            </div>
            {customKegiatanMode ? (
              <input
                type="text"
                value={form.kegiatan}
                onChange={(e) => setForm({ ...form, kegiatan: e.target.value })}
                placeholder="Contoh: Sertifikasi Pemandu Wisata Selam (LSP)"
                required
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/20 focus:border-[#0F4C81]"
              />
            ) : (
              <select
                value={form.kegiatan}
                onChange={(e) => setForm({ ...form, kegiatan: e.target.value })}
                required
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/20 focus:border-[#0F4C81]"
              >
                <option value="">-- Pilih Kegiatan --</option>
                {daftarKegiatan.map((k, idx) => (
                  <option key={`${k.tahun}-${k.nama}-${idx}`} value={k.nama}>
                    [{k.tahun}] {k.jenis === 'Sertifikasi LSP' ? '[LSP] ' : ''}
                    {k.nama}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                NIK (16 Digit KTP)
              </label>
              <input
                type="text"
                maxLength={16}
                value={form.nik}
                onChange={(e) =>
                  setForm({ ...form, nik: e.target.value.replace(/[^0-9]/g, '') })
                }
                placeholder="Opsional (16 digit angka)"
                className="w-full px-3 py-2 text-sm font-mono-tabular bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/20 focus:border-[#0F4C81]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Nama Lengkap (Sesuai KTP) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={form.nama}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
                placeholder="Contoh: La Ode Ahmad"
                required
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/20 focus:border-[#0F4C81]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Asal Kecamatan (Wakatobi)
              </label>
              <select
                value={form.kecamatan}
                onChange={(e) => setForm({ ...form, kecamatan: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/20 focus:border-[#0F4C81]"
              >
                <option value="-">-- Pilih Kecamatan --</option>
                {KECAMATAN_WAKATOBI.map((kec) => (
                  <option key={kec} value={kec}>
                    {kec}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Alamat Desa / Kelurahan
              </label>
              <input
                type="text"
                value={form.alamat}
                onChange={(e) => setForm({ ...form, alamat: e.target.value })}
                placeholder="Contoh: Kel. Mandati III"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/20 focus:border-[#0F4C81]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Nomor Telepon / WhatsApp
              </label>
              <input
                type="text"
                value={form.telp}
                onChange={(e) => setForm({ ...form, telp: e.target.value })}
                placeholder="Contoh: 0812xxxxxxxx"
                className="w-full px-3 py-2 text-sm font-mono-tabular bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/20 focus:border-[#0F4C81]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Pendidikan Terakhir
              </label>
              <select
                value={form.pendidikan}
                onChange={(e) => setForm({ ...form, pendidikan: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/20 focus:border-[#0F4C81]"
              >
                <option value="-">-- Pilih Pendidikan --</option>
                {PENDIDIKAN_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Pekerjaan / Profesi
              </label>
              <input
                type="text"
                value={form.pekerjaan}
                onChange={(e) => setForm({ ...form, pekerjaan: e.target.value })}
                placeholder="Contoh: Pemandu Wisata"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/20 focus:border-[#0F4C81]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Nama Lembaga / Pokdarwis / Usaha
              </label>
              <input
                type="text"
                value={form.lembaga}
                onChange={(e) => setForm({ ...form, lembaga: e.target.value })}
                placeholder="Contoh: Pokdarwis Liya Togo"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0F4C81]/20 focus:border-[#0F4C81]"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-[#0F4C81] rounded-lg hover:bg-[#0c3d68] transition-colors"
            >
              {editingPeserta ? 'Simpan Perubahan' : 'Simpan Data Peserta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
