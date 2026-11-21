import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { EmpatSudut } from '../../omr/types.ts';
import type { Titik } from '../../types/ljk.ts';

type KunciSudut = keyof EmpatSudut;

const DAFTAR_SUDUT: Array<{ kunci: KunciSudut; label: string; singkat: string }> = [
  { kunci: 'kiriAtas', label: 'Kiri Atas', singkat: 'KA' },
  { kunci: 'kananAtas', label: 'Kanan Atas', singkat: 'KnA' },
  { kunci: 'kananBawah', label: 'Kanan Bawah', singkat: 'KnB' },
  { kunci: 'kiriBawah', label: 'Kiri Bawah', singkat: 'KB' },
];

interface CornerAdjusterProps {
  fotoUrl: string;
  lebarGambar: number;
  tinggiGambar: number;
  sudut: EmpatSudut;
  onChange: (sudutBaru: EmpatSudut) => void;
}

export function CornerAdjuster({
  fotoUrl,
  lebarGambar,
  tinggiGambar,
  sudut,
  onChange,
}: CornerAdjusterProps) {
  const wadahRef = useRef<HTMLDivElement>(null);
  const [sudutAktif, setSudutAktif] = useState<KunciSudut>('kiriAtas');
  const [sedangSeret, setSedangSeret] = useState<KunciSudut | null>(null);
  const [pengumuman, setPengumuman] = useState('');

  const offsetSeretRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const timerUmumRef = useRef<number | null>(null);

  const umumkan = (teks: string) => {
    setPengumuman(teks);
    if (timerUmumRef.current !== null) {
      window.clearTimeout(timerUmumRef.current);
    }
    timerUmumRef.current = window.setTimeout(() => {
      setPengumuman('');
    }, 1000);
  };

  const batasiTitik = (x: number, y: number): Titik => ({
    x: Math.max(0, Math.min(lebarGambar - 1, Math.round(x))),
    y: Math.max(0, Math.min(tinggiGambar - 1, Math.round(y))),
  });

  const perbaruiSatuSudut = (kunci: KunciSudut, titikBaru: Titik) => {
    onChange({
      ...sudut,
      [kunci]: batasiTitik(titikBaru.x, titikBaru.y),
    });
  };

  const posisiClientKeGambar = (clientX: number, clientY: number): Titik | null => {
    const wadah = wadahRef.current;
    if (!wadah) return null;
    const rect = wadah.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = ((clientX - rect.left) / rect.width) * lebarGambar;
    const y = ((clientY - rect.top) / rect.height) * tinggiGambar;
    return batasiTitik(x, y);
  };

  const handlePointerDown = (
    kunci: KunciSudut,
    event: PointerEvent<HTMLButtonElement>,
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    setSudutAktif(kunci);

    const posisiPointer = posisiClientKeGambar(event.clientX, event.clientY);
    if (posisiPointer) {
      offsetSeretRef.current = {
        dx: posisiPointer.x - sudut[kunci].x,
        dy: posisiPointer.y - sudut[kunci].y,
      };
    } else {
      offsetSeretRef.current = { dx: 0, dy: 0 };
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setSedangSeret(kunci);
  };

  const handlePointerMove = (
    kunci: KunciSudut,
    event: PointerEvent<HTMLButtonElement>,
  ) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const posisiPointer = posisiClientKeGambar(event.clientX, event.clientY);
    if (!posisiPointer) return;
    perbaruiSatuSudut(kunci, {
      x: posisiPointer.x - offsetSeretRef.current.dx,
      y: posisiPointer.y - offsetSeretRef.current.dy,
    });
  };

  const handleLostPointerCapture = (kunci: KunciSudut, label: string) => {
    if (sedangSeret === kunci) {
      setSedangSeret(null);
      umumkan(`Sudut ${label} selesai dipindahkan.`);
    }
  };

  const handleKeyDown = (
    kunci: KunciSudut,
    label: string,
    event: KeyboardEvent<HTMLButtonElement>,
  ) => {
    const langkah = event.shiftKey ? 24 : 8;
    const saatIni = sudut[kunci];
    let dx = 0;
    let dy = 0;
    let arah = '';

    if (event.key === 'ArrowLeft') {
      dx = -langkah;
      arah = 'kiri';
    } else if (event.key === 'ArrowRight') {
      dx = langkah;
      arah = 'kanan';
    } else if (event.key === 'ArrowUp') {
      dy = -langkah;
      arah = 'atas';
    } else if (event.key === 'ArrowDown') {
      dy = langkah;
      arah = 'bawah';
    } else {
      return;
    }

    event.preventDefault();
    setSudutAktif(kunci);
    perbaruiSatuSudut(kunci, { x: saatIni.x + dx, y: saatIni.y + dy });
    umumkan(`Sudut ${label} digeser ke ${arah}.`);
  };

  const handleKetukGambar = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    // Hanya untuk ketukan langsung pada gambar (bukan saat menekan tombol sudut)
    if ((event.target as HTMLElement).closest('button')) return;
    const titik = posisiClientKeGambar(event.clientX, event.clientY);
    if (!titik) return;
    const meta = DAFTAR_SUDUT.find((s) => s.kunci === sudutAktif);
    perbaruiSatuSudut(sudutAktif, titik);
    if (meta) {
      umumkan(`Sudut ${meta.label} dipindahkan ke titik yang diketuk.`);
    }
  };

  const titikPoligon = [
    sudut.kiriAtas,
    sudut.kananAtas,
    sudut.kananBawah,
    sudut.kiriBawah,
  ]
    .map((p) => `${p.x},${p.y}`)
    .join(' ');

  return (
    <div className="space-y-3">
      <div className="visually-hidden" aria-live="polite">
        {pengumuman}
      </div>

      {/* Pemilih sudut aktif (alternatif ketuk tanpa menyeret) */}
      <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Pilih sudut yang sedang diatur">
        {DAFTAR_SUDUT.map((item) => {
          const aktif = sudutAktif === item.kunci;
          return (
            <button
              key={item.kunci}
              type="button"
              onClick={() => setSudutAktif(item.kunci)}
              aria-pressed={aktif}
              className={`min-h-12 rounded-xl border-2 px-1.5 py-2 text-xs font-bold transition-colors ${
                aktif
                  ? 'border-blue-900 bg-blue-900 text-white'
                  : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-slate-700">
        Seret lingkaran biru di 4 pojok, atau pilih sudut di atas lalu ketuk
        langsung posisi pojoknya pada foto.
      </p>

      {/* Foto LJK + bingkai segi empat + 4 gagang sudut */}
      <div
        ref={wadahRef}
        onPointerDown={handleKetukGambar}
        className="relative w-full overflow-hidden rounded-2xl border-2 border-slate-300 bg-slate-900"
      >
        <img
          src={fotoUrl}
          alt="Foto LJK kosong dengan 4 titik sudut yang bisa digeser"
          draggable={false}
          className="block h-auto w-full select-none"
        />

        <svg
          viewBox={`0 0 ${lebarGambar} ${tinggiGambar}`}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full"
        >
          <polygon
            points={titikPoligon}
            fill="rgba(30, 58, 138, 0.14)"
            stroke="#2563eb"
            strokeWidth={Math.max(4, Math.round(lebarGambar * 0.004))}
            strokeLinejoin="round"
          />
        </svg>

        {DAFTAR_SUDUT.map((item) => {
          const pt = sudut[item.kunci];
          const kiriPersen = (pt.x / lebarGambar) * 100;
          const atasPersen = (pt.y / tinggiGambar) * 100;
          const aktif = sudutAktif === item.kunci;
          const diseret = sedangSeret === item.kunci;

          return (
            <button
              key={item.kunci}
              type="button"
              aria-label={`Geser sudut ${item.label}. Gunakan tombol panah untuk menggeser.`}
              onPointerDown={(e) => handlePointerDown(item.kunci, e)}
              onPointerMove={(e) => handlePointerMove(item.kunci, e)}
              onLostPointerCapture={() =>
                handleLostPointerCapture(item.kunci, item.label)
              }
              onKeyDown={(e) => handleKeyDown(item.kunci, item.label, e)}
              onFocus={() => setSudutAktif(item.kunci)}
              style={{
                left: `${kiriPersen}%`,
                top: `${atasPersen}%`,
              }}
              className={`drag-handle absolute -translate-x-1/2 -translate-y-1/2 flex h-12 w-12 items-center justify-center rounded-full focus-visible:outline-3 focus-visible:outline-amber-400 ${
                diseret ? 'dragging scale-110' : ''
              }`}
            >
              <span
                aria-hidden="true"
                className={`flex h-9 w-9 items-center justify-center rounded-full border-3 shadow-md transition-transform ${
                  aktif
                    ? 'border-white bg-blue-700/85 text-white ring-2 ring-blue-900'
                    : 'border-white bg-blue-900/70 text-white'
                }`}
              >
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300 ring-1 ring-slate-900" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
