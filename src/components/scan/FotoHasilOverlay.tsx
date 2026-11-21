import { Eye, EyeOff, ZoomIn, ZoomOut } from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type TouchEvent,
} from 'react';
import { hitungPosisiSemuaSoal } from '../../omr/geometry.ts';
import type { StatusBulatan } from '../../omr/types.ts';
import type { StatusJawaban, TemplateLJK } from '../../types/ljk.ts';

interface FotoHasilOverlayProps {
  fotoUrl: string | null;
  template: TemplateLJK;
  kunciJawaban: string[];
  jawabanSetelahKoreksi: string[];
  statusPerNomor: StatusJawaban[];
  nomorDikoreksi: ReadonlySet<number>;
  statusBulatanMentah?: Array<Record<string, StatusBulatan>>;
  nomorSorot: number | null;
  onPilihNomor: (nomor: number) => void;
}

function jarakDuaSentuhan(t1: { clientX: number; clientY: number }, t2: { clientX: number; clientY: number }): number {
  return Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
}

export function FotoHasilOverlay({
  fotoUrl,
  template,
  kunciJawaban,
  jawabanSetelahKoreksi,
  statusPerNomor,
  nomorDikoreksi,
  statusBulatanMentah,
  nomorSorot,
  onPilihNomor,
}: FotoHasilOverlayProps) {
  const [tampilkanTanda, setTampilkanTanda] = useState(true);
  const [zoom, setZoom] = useState(1);

  const wadahGulirRef = useRef<HTMLDivElement>(null);
  const pinchAwalRef = useRef<{ jarak: number; zoomAwal: number } | null>(null);

  const semuaSoal = useMemo(() => hitungPosisiSemuaSoal(template), [template]);
  const stdW = template.ukuranStandar.lebar;
  const stdH = template.ukuranStandar.tinggi;

  // Saat guru mengetuk nomor di Daftar Perlu Dicek, perbesar & gulir langsung ke posisi nomor itu di foto
  useEffect(() => {
    if (nomorSorot === null) return;
    const soal = semuaSoal.find((s) => s.nomor === nomorSorot);
    if (!soal || soal.pilihan.length === 0) return;

    const zoomTujuan = Math.max(zoom, 1.8);
    if (zoom < 1.8) {
      setZoom(zoomTujuan);
    }

    const xs = soal.pilihan.map((p) => p.pusat.x);
    const ys = soal.pilihan.map((p) => p.pusat.y);
    const fraksiX = ((Math.min(...xs) + Math.max(...xs)) / 2) / stdW;
    const fraksiY = ((Math.min(...ys) + Math.max(...ys)) / 2) / stdH;

    window.requestAnimationFrame(() => {
      const wadah = wadahGulirRef.current;
      if (!wadah) return;
      wadah.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      const targetX = Math.max(
        0,
        wadah.scrollWidth * fraksiX - wadah.clientWidth / 2,
      );
      const targetY = Math.max(
        0,
        wadah.scrollHeight * fraksiY - wadah.clientHeight / 2,
      );
      wadah.scrollTo({ left: targetX, top: targetY, behavior: 'smooth' });
    });
  }, [nomorSorot, semuaSoal, stdW, stdH]);

  const aturZoom = (nilai: number) => {
    const dibatasi = Math.max(1, Math.min(3, Math.round(nilai * 10) / 10));
    setZoom(dibatasi);
  };

  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      pinchAwalRef.current = {
        jarak: jarakDuaSentuhan(e.touches[0], e.touches[1]),
        zoomAwal: zoom,
      };
    }
  };

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && pinchAwalRef.current) {
      const jarakSekarang = jarakDuaSentuhan(e.touches[0], e.touches[1]);
      if (pinchAwalRef.current.jarak > 10) {
        const rasio = jarakSekarang / pinchAwalRef.current.jarak;
        aturZoom(pinchAwalRef.current.zoomAwal * rasio);
      }
    }
  };

  const handleTouchEnd = (e: TouchEvent<HTMLDivElement>) => {
    if (e.touches.length < 2) {
      pinchAwalRef.current = null;
    }
  };

  if (!fotoUrl) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-100 p-5 text-center text-sm text-slate-700">
        Foto hasil scan tidak disimpan untuk lembar ini (opsi simpan foto sedang
        nonaktif). Anda tetap bisa memeriksa dan mengoreksi jawaban pada daftar
        nomor di bawah.
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {/* Kontrol Tanda Warna + Zoom */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setTampilkanTanda((v) => !v)}
          aria-pressed={tampilkanTanda}
          className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-bold text-slate-900 hover:bg-slate-50"
        >
          {tampilkanTanda ? (
            <>
              <EyeOff className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Sembunyikan Tanda</span>
            </>
          ) : (
            <>
              <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Tampilkan Tanda</span>
            </>
          )}
        </button>

        <div
          className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white p-1"
          role="group"
          aria-label="Perbesaran foto LJK"
        >
          <button
            type="button"
            aria-label="Perkecil foto"
            disabled={zoom <= 1}
            onClick={() => aturZoom(zoom - 0.5)}
            className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg text-slate-900 hover:bg-slate-100 disabled:opacity-40"
          >
            <ZoomOut className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Atur ulang perbesaran ke 1 kali"
            onClick={() => aturZoom(1)}
            className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg px-2 text-xs font-bold text-blue-900 hover:bg-blue-50"
          >
            {zoom.toFixed(1).replace('.', ',')}×
          </button>
          <button
            type="button"
            aria-label="Perbesar foto"
            disabled={zoom >= 3}
            onClick={() => aturZoom(zoom + 0.5)}
            className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-lg text-slate-900 hover:bg-slate-100 disabled:opacity-40"
          >
            <ZoomIn className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <p className="text-xs text-slate-600">
        Cubit dengan dua jari atau gunakan tombol + / − untuk memperbesar. Ketuk
        nomor mana saja pada foto untuk mengoreksi manual.
      </p>

      {/* Wadah Foto LJK yang dapat dicubit & digulir 2D */}
      <div
        ref={wadahGulirRef}
        role="region"
        tabIndex={0}
        aria-label="Foto hasil scan LJK dengan tanda warna"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{ touchAction: 'pan-x pan-y' }}
        className="max-h-[64dvh] overflow-auto rounded-2xl border-2 border-slate-300 bg-slate-200"
      >
        <div style={{ width: `${zoom * 100}%` }} className="relative select-none">
          <img
            src={fotoUrl}
            alt="Foto LJK yang sudah diluruskan dengan tanda warna hasil koreksi"
            draggable={false}
            className="block h-auto w-full select-none"
          />

          <svg
            viewBox={`0 0 ${stdW} ${stdH}`}
            className="absolute inset-0 h-full w-full"
          >
            {semuaSoal.map((soal) => {
              const idx = soal.nomor - 1;
              const status = statusPerNomor[idx] ?? 'kosong';
              const jawaban = (jawabanSetelahKoreksi[idx] ?? '').toUpperCase();
              const kunci = (kunciJawaban[idx] ?? '').toUpperCase();
              const dikoreksi = nomorDikoreksi.has(soal.nomor);
              const disorot = nomorSorot === soal.nomor;
              const mentahBaris = statusBulatanMentah?.[idx];

              const xs = soal.pilihan.map((p) => p.pusat.x);
              const ys = soal.pilihan.map((p) => p.pusat.y);
              const rMaks = soal.pilihan[0]?.radius ?? 15;
              const minX = Math.min(...xs) - rMaks - 8;
              const maxX = Math.max(...xs) + rMaks + 14;
              const minY = Math.min(...ys) - rMaks - 6;
              const maxY = Math.max(...ys) + rMaks + 6;
              const perluKuning =
                status === 'kosong' || status === 'ganda' || status === 'ragu';

              return (
                <g key={`row-${soal.nomor}`}>
                  {/* Sorotan biru saat melompat dari Daftar Perlu Dicek */}
                  {disorot ? (
                    <rect
                      x={minX - 6}
                      y={minY - 4}
                      width={maxX - minX + 12}
                      height={maxY - minY + 8}
                      rx="14"
                      fill="rgba(37, 99, 235, 0.14)"
                      stroke="#1d4ed8"
                      strokeWidth="5"
                    />
                  ) : null}

                  {tampilkanTanda ? (
                    <>
                      {/* Bingkai lembut kuning untuk nomor kosong agar langsung terlihat */}
                      {status === 'kosong' ? (
                        <rect
                          x={minX}
                          y={minY}
                          width={maxX - minX}
                          height={maxY - minY}
                          rx="10"
                          fill="rgba(234, 179, 8, 0.14)"
                          stroke="#ca8a04"
                          strokeWidth="3"
                        />
                      ) : null}

                      {soal.pilihan.map((pil) => {
                        const adalahKunci = pil.label === kunci;
                        const terpilih = jawaban === pil.label;
                        const statusMentahBulatan = mentahBaris?.[pil.label];

                        // 1. Benar: lingkaran hijau + simbol centang
                        if (status === 'benar' && terpilih) {
                          return (
                            <g key={`b-${soal.nomor}-${pil.label}`}>
                              <circle
                                cx={pil.pusat.x}
                                cy={pil.pusat.y}
                                r={pil.radius + 4}
                                fill="rgba(22, 163, 74, 0.28)"
                                stroke="#15803d"
                                strokeWidth="4.5"
                              />
                              <text
                                x={pil.pusat.x + pil.radius + 6}
                                y={pil.pusat.y + 7}
                                fill="#15803d"
                                fontSize="22"
                                fontWeight="bold"
                              >
                                ✓
                              </text>
                            </g>
                          );
                        }

                        // 2. Salah: lingkaran merah + silang pada jawaban siswa
                        if (status === 'salah' && terpilih) {
                          return (
                            <g key={`s-${soal.nomor}-${pil.label}`}>
                              <circle
                                cx={pil.pusat.x}
                                cy={pil.pusat.y}
                                r={pil.radius + 4}
                                fill="rgba(220, 38, 38, 0.26)"
                                stroke="#b91c1c"
                                strokeWidth="4.5"
                              />
                              <text
                                x={pil.pusat.x + pil.radius + 6}
                                y={pil.pusat.y + 7}
                                fill="#b91c1c"
                                fontSize="20"
                                fontWeight="bold"
                              >
                                ✕
                              </text>
                            </g>
                          );
                        }

                        // 3. Kuning (?): nomor ganda / ragu pada bulatan yang bertanda gelap/ragu
                        if (
                          (status === 'ganda' || status === 'ragu') &&
                          statusMentahBulatan &&
                          statusMentahBulatan !== 'kosong'
                        ) {
                          return (
                            <g key={`k-${soal.nomor}-${pil.label}`}>
                              <circle
                                cx={pil.pusat.x}
                                cy={pil.pusat.y}
                                r={pil.radius + 4}
                                fill="rgba(234, 179, 8, 0.30)"
                                stroke="#a16207"
                                strokeWidth="4.5"
                              />
                              {adalahKunci ? (
                                <circle
                                  cx={pil.pusat.x}
                                  cy={pil.pusat.y}
                                  r={pil.radius + 9}
                                  fill="none"
                                  stroke="#15803d"
                                  strokeWidth="3.5"
                                  strokeDasharray="6 4"
                                />
                              ) : null}
                            </g>
                          );
                        }

                        // 4. Cincin hijau putus-putus pada kunci yang seharusnya (saat salah/kosong/ganda/ragu)
                        if (status !== 'benar' && adalahKunci) {
                          return (
                            <circle
                              key={`key-${soal.nomor}-${pil.label}`}
                              cx={pil.pusat.x}
                              cy={pil.pusat.y}
                              r={pil.radius + 5}
                              fill="none"
                              stroke="#15803d"
                              strokeWidth="4"
                              strokeDasharray="6 4"
                            />
                          );
                        }

                        return null;
                      })}

                      {/* Simbol tanda tanya di ujung kanan baris untuk kosong / ganda / ragu */}
                      {perluKuning ? (
                        <text
                          x={maxX + 4}
                          y={(minY + maxY) / 2 + 8}
                          fill="#854d0e"
                          fontSize="22"
                          fontWeight="bold"
                        >
                          ?
                        </text>
                      ) : null}

                      {/* Lencana pensil jika nomor dikoreksi manual */}
                      {dikoreksi ? (
                        <g>
                          <circle
                            cx={minX - 6}
                            cy={(minY + maxY) / 2}
                            r="12"
                            fill="#1e3a8a"
                          />
                          <text
                            x={minX - 12}
                            y={(minY + maxY) / 2 + 5}
                            fill="#ffffff"
                            fontSize="14"
                            fontWeight="bold"
                          >
                            ✎
                          </text>
                        </g>
                      ) : null}
                    </>
                  ) : null}

                  {/* Area klik/ketuk transparan agar guru dapat mengetuk nomor langsung pada foto */}
                  <rect
                    x={minX}
                    y={minY}
                    width={maxX - minX}
                    height={maxY - minY}
                    fill="transparent"
                    className="cursor-pointer"
                    onClick={() => onPilihNomor(soal.nomor)}
                  >
                    <title>
                      Nomor {soal.nomor} ({status}) — ketuk untuk koreksi manual
                    </title>
                  </rect>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Legenda warna & simbol */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800">
        <span className="inline-flex items-center gap-1 text-emerald-800">
          <span>✓</span> Benar
        </span>
        <span className="inline-flex items-center gap-1 text-red-700">
          <span>✕</span> Salah
        </span>
        <span className="inline-flex items-center gap-1 text-emerald-800">
          <span>◌</span> Kunci benar
        </span>
        <span className="inline-flex items-center gap-1 text-amber-800">
          <span>?</span> Kosong / Ganda / Ragu
        </span>
        <span className="inline-flex items-center gap-1 text-blue-900">
          <span>✎</span> Dikoreksi manual
        </span>
      </div>
    </div>
  );
}
