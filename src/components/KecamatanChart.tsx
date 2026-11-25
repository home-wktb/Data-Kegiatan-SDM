import React from 'react';
import type { Peserta } from '../types/sdm';

interface KecamatanChartProps {
  dataPeserta: Peserta[];
  tahunDipilih: string;
  selectedKecamatan: string;
  onSelectKecamatan: (kecamatan: string) => void;
}

export const KecamatanChart: React.FC<KecamatanChartProps> = ({
  dataPeserta,
  tahunDipilih,
  selectedKecamatan,
  onSelectKecamatan,
}) => {
  const filtered = dataPeserta.filter(
    (p) => tahunDipilih === 'ALL' || p.tahun === tahunDipilih
  );

  const countsMap = new Map<string, number>();
  filtered.forEach((p) => {
    const kec = p.kecamatan && p.kecamatan !== '-' ? p.kecamatan.trim() : 'Belum Diisi';
    countsMap.set(kec, (countsMap.get(kec) || 0) + 1);
  });

  const rows = Array.from(countsMap.entries())
    .map(([kecamatan, total]) => ({ kecamatan, total }))
    .sort((a, b) => b.total - a.total);

  const maxCount = rows.length > 0 ? rows[0].total : 1;

  if (rows.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-slate-500">
        Belum ada data sebaran wilayah kecamatan pada tahun terpilih.
      </div>
    );
  }

  return (
    <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
      {rows.map((item) => {
        const pct = Math.max(4, Math.round((item.total / maxCount) * 100));
        const isActive = selectedKecamatan === item.kecamatan;
        const canFilter = item.kecamatan !== 'Belum Diisi';

        return (
          <button
            key={item.kecamatan}
            type="button"
            disabled={!canFilter}
            onClick={() => {
              if (!canFilter) return;
              onSelectKecamatan(isActive ? '' : item.kecamatan);
            }}
            className={`w-full text-left group rounded-lg px-2 py-1.5 transition-colors ${
              isActive ? 'bg-[#0F4C81]/8' : canFilter ? 'hover:bg-slate-50' : 'cursor-default'
            }`}
          >
            <div className="flex items-center justify-between text-xs mb-1">
              <span
                className={`font-medium truncate ${
                  isActive ? 'text-[#0F4C81]' : 'text-slate-700'
                }`}
              >
                {item.kecamatan}
              </span>
              <span className="font-mono-tabular font-semibold text-slate-900 ml-2 shrink-0">
                {item.total} org
              </span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-200 ${
                  isActive ? 'bg-[#0F4C81]' : 'bg-[#0D9488] group-hover:bg-[#0F4C81]'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </button>
        );
      })}
    </div>
  );
};
