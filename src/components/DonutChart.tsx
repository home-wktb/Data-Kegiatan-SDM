import React, { useState } from 'react';
import { Award } from 'lucide-react';
import type { Kegiatan, Peserta } from '../types/sdm';
import { isKegiatanLsp } from '../utils/sheetsParser';

interface DonutChartProps {
  daftarKegiatan: Kegiatan[];
  dataPeserta: Peserta[];
  tahunDipilih: string;
  selectedKegiatan: string;
  onSelectKegiatan: (kegiatan: string) => void;
}

const CHART_COLORS = [
  '#0F4C81',
  '#0D9488',
  '#D97706',
  '#2563EB',
  '#059669',
  '#4F46E5',
  '#DC2626',
  '#7C3AED',
  '#0284C7',
  '#EA580C',
];

export const DonutChart: React.FC<DonutChartProps> = ({
  daftarKegiatan,
  dataPeserta,
  tahunDipilih,
  selectedKegiatan,
  onSelectKegiatan,
}) => {
  const [hoveredName, setHoveredName] = useState<string | null>(null);

  const kegMaster = daftarKegiatan
    .filter((k) => tahunDipilih === 'ALL' || k.tahun === tahunDipilih)
    .map((k) => k.nama);
  const kegPeserta = dataPeserta
    .filter((p) => tahunDipilih === 'ALL' || p.tahun === tahunDipilih)
    .map((p) => p.kegiatan);
  const uniqueNames = Array.from(new Set([...kegMaster, ...kegPeserta])).filter(
    (n) => n && n !== '-'
  );

  const items = uniqueNames.map((nama, idx) => {
    const jumlah = dataPeserta.filter(
      (p) => (tahunDipilih === 'ALL' || p.tahun === tahunDipilih) && p.kegiatan === nama
    ).length;
    return {
      nama,
      jumlah,
      isLsp: isKegiatanLsp(nama, daftarKegiatan),
      color: CHART_COLORS[idx % CHART_COLORS.length],
    };
  });

  const totalPeserta = items.reduce((sum, i) => sum + i.jumlah, 0);
  const totalWeight = items.reduce((sum, i) => sum + (i.jumlah > 0 ? i.jumlah : 1), 0);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center text-sm text-slate-500">
        Belum ada kegiatan tercatat pada tahun terpilih.
      </div>
    );
  }

  // Compute SVG arc segments around center (100, 100) radius 74, strokeWidth 28
  const radius = 74;
  const circumference = 2 * Math.PI * radius;
  let cumulativeFraction = 0;

  const activeItem =
    items.find((i) => i.nama === hoveredName) ||
    items.find((i) => i.nama === selectedKegiatan) ||
    null;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative w-48 h-48 shrink-0 flex items-center justify-center">
        <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
          {items.map((item) => {
            const weight = item.jumlah > 0 ? item.jumlah : 1;
            const fraction = weight / totalWeight;
            const dashArray = `${Math.max(fraction * circumference - 2, 1)} ${circumference}`;
            const dashOffset = -cumulativeFraction * circumference;
            cumulativeFraction += fraction;

            const isDimmed =
              (hoveredName && hoveredName !== item.nama) ||
              (!hoveredName && selectedKegiatan && selectedKegiatan !== item.nama);

            return (
              <circle
                key={item.nama}
                cx="100"
                cy="100"
                r={radius}
                fill="transparent"
                stroke={item.color}
                strokeWidth={hoveredName === item.nama || selectedKegiatan === item.nama ? 32 : 26}
                strokeDasharray={dashArray}
                strokeDashoffset={dashOffset}
                className="cursor-pointer transition-all duration-150"
                style={{ opacity: isDimmed ? 0.35 : 1 }}
                onMouseEnter={() => setHoveredName(item.nama)}
                onMouseLeave={() => setHoveredName(null)}
                onClick={() =>
                  onSelectKegiatan(selectedKegiatan === item.nama ? '' : item.nama)
                }
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-6 text-center">
          <span className="text-2xl font-bold text-slate-900 font-mono-tabular leading-tight">
            {activeItem ? activeItem.jumlah : totalPeserta}
          </span>
          <span className="text-[11px] font-medium text-slate-500 line-clamp-2 mt-0.5">
            {activeItem ? 'Peserta' : 'Total Peserta'}
          </span>
        </div>
      </div>

      <div className="flex-1 w-full min-w-0 max-h-56 overflow-y-auto divide-y divide-slate-100 pr-1">
        {items.map((item) => {
          const isSelected = selectedKegiatan === item.nama;
          return (
            <button
              key={item.nama}
              type="button"
              onMouseEnter={() => setHoveredName(item.nama)}
              onMouseLeave={() => setHoveredName(null)}
              onClick={() => onSelectKegiatan(isSelected ? '' : item.nama)}
              className={`w-full flex items-center justify-between gap-3 py-2.5 px-2.5 text-left transition-colors rounded-lg ${
                isSelected ? 'bg-[#0F4C81]/8 text-slate-900' : 'hover:bg-slate-50 text-slate-700'
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 mt-1.5"
                  style={{ backgroundColor: item.color }}
                />
                <div className="min-w-0">
                  <p className="text-xs font-medium leading-snug text-slate-800 line-clamp-2">
                    {item.nama}
                  </p>
                  {item.isLsp && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 mt-0.5">
                      <Award className="w-3 h-3" />
                      Sertifikasi LSP
                    </span>
                  )}
                </div>
              </div>
              <span className="text-xs font-semibold font-mono-tabular text-slate-900 shrink-0">
                {item.jumlah} org
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
