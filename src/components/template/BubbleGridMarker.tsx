import { ZoomIn, ZoomOut } from 'lucide-react';
import { useRef, useState, type MouseEvent } from 'react';
import {
  hitungPosisiBlokNama,
  hitungPosisiBulatanBlok,
} from '../../omr/geometry.ts';
import type {
  BlokJawaban,
  BlokNama,
  Titik,
  UkuranStandar,
} from '../../types/ljk.ts';

export interface DraftBlokJawaban {
  nomorAwal: number;
  jumlahNomor: number;
  jumlahPilihan: number;
  radiusBulatan: number;
  titikPertama: Titik | null;
  titikTerakhir: Titik | null;
}

export interface DraftBlokNama {
  jumlahKolom: number;
  radiusBulatan: number;
  titikHurufAPertama: Titik | null;
  titikHurufZTerakhir: Titik | null;
}

interface BubbleGridMarkerProps {
  mode: 'jawaban' | 'nama';
  fotoLurusUrl: string;
  ukuranStandar: UkuranStandar;
  blokJawabanTersimpan: BlokJawaban[];
  blokNamaTersimpan?: BlokNama | null;
  draftJawaban?: DraftBlokJawaban;
  draftNama?: DraftBlokNama;
  ketukanAktif: boolean;
  labelPanduanKetuk: string;
  onKetukGambar: (titik: Titik) => void;
}

const PILIHAN_ZOOM = [1, 1.5, 2, 3] as const;

export function BubbleGridMarker({
  mode,
  fotoLurusUrl,
  ukuranStandar,
  blokJawabanTersimpan,
  blokNamaTersimpan,
  draftJawaban,
  draftNama,
  ketukanAktif,
  labelPanduanKetuk,
  onKetukGambar,
}: BubbleGridMarkerProps) {
  const [zoom, setZoom] = useState<(typeof PILIHAN_ZOOM)[number]>(1);
  const gambarRef = useRef<HTMLImageElement>(null);

  const handleKlik = (event: MouseEvent<HTMLDivElement>) => {
    if (!ketukanAktif) return;
    const img = gambarRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const x = ((event.clientX - rect.left) / rect.width) * ukuranStandar.lebar;
    const y =
      ((event.clientY - rect.top) / rect.height) * ukuranStandar.tinggi;

    onKetukGambar({
      x: Math.max(0, Math.min(ukuranStandar.lebar - 1, Math.round(x))),
      y: Math.max(0, Math.min(ukuranStandar.tinggi - 1, Math.round(y))),
    });
  };

  const pratinjauDraftJawaban =
    mode === 'jawaban' &&
    draftJawaban?.titikPertama &&
    draftJawaban?.titikTerakhir
      ? hitungPosisiBulatanBlok({
          nomorAwal: draftJawaban.nomorAwal,
          jumlahNomor: draftJawaban.jumlahNomor,
          jumlahPilihan: draftJawaban.jumlahPilihan,
          radiusBulatan: draftJawaban.radiusBulatan,
          titikBulatanPertama: draftJawaban.titikPertama,
          titikBulatanTerakhir: draftJawaban.titikTerakhir,
        })
      : [];

  const pratinjauDraftNama =
    mode === 'nama' &&
    draftNama?.titikHurufAPertama &&
    draftNama?.titikHurufZTerakhir
      ? hitungPosisiBlokNama({
          jumlahKolom: draftNama.jumlahKolom,
          radiusBulatan: draftNama.radiusBulatan,
          titikHurufAPertama: draftNama.titikHurufAPertama,
          titikHurufZTerakhir: draftNama.titikHurufZTerakhir,
        })
      : [];

  const posisiNamaTersimpan =
    mode !== 'nama' && blokNamaTersimpan
      ? hitungPosisiBlokNama(blokNamaTersimpan)
      : [];

  const titikPertamaAktif =
    mode === 'jawaban'
      ? (draftJawaban?.titikPertama ?? null)
      : (draftNama?.titikHurufAPertama ?? null);
  const titikTerakhirAktif =
    mode === 'jawaban'
      ? (draftJawaban?.titikTerakhir ?? null)
      : (draftNama?.titikHurufZTerakhir ?? null);
  const radiusAktif =
    mode === 'jawaban'
      ? (draftJawaban?.radiusBulatan ?? 12)
      : (draftNama?.radiusBulatan ?? 6);

  const tebalGarisNama = Math.max(1.2, Math.min(2.2, radiusAktif * 0.28));

  return (
    <div className="space-y-2.5">
      {/* Kontrol perbesaran agar mudah mengetuk bulatan kecil di layar HP */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold text-blue-950">{labelPanduanKetuk}</p>
        <div
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1"
          role="group"
          aria-label="Perbesaran gambar"
        >
          <ZoomOut className="ml-1.5 h-4 w-4 text-slate-600" aria-hidden="true" />
          {PILIHAN_ZOOM.map((z) => (
            <button
              key={z}
              type="button"
              onClick={() => setZoom(z)}
              aria-pressed={zoom === z}
              className={`min-h-12 min-w-12 rounded-lg px-2 text-xs font-bold transition-colors ${
                zoom === z
                  ? 'bg-blue-900 text-white'
                  : 'bg-transparent text-slate-800 hover:bg-slate-200'
              }`}
            >
              {String(z).replace('.', ',')}×
            </button>
          ))}
          <ZoomIn className="mr-1.5 h-4 w-4 text-slate-600" aria-hidden="true" />
        </div>
      </div>

      {/* Wadah gambar dapat digulir saat diperbesar */}
      <div
        role="region"
        tabIndex={0}
        aria-label="Area gambar LJK untuk menandai bulatan"
        className="max-h-[62dvh] overflow-auto rounded-2xl border-2 border-slate-300 bg-slate-200"
      >
        <div
          onClick={handleKlik}
          style={{ width: `${zoom * 100}%` }}
          className={`relative select-none ${
            ketukanAktif ? 'cursor-crosshair' : 'cursor-default'
          }`}
        >
          <img
            ref={gambarRef}
            src={fotoLurusUrl}
            alt="Gambar LJK yang sudah diluruskan untuk menandai posisi bulatan"
            draggable={false}
            className="block h-auto w-full select-none"
          />

          <svg
            viewBox={`0 0 ${ukuranStandar.lebar} ${ukuranStandar.tinggi}`}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full"
          >
            {/* Blok jawaban yang sudah ditambahkan (hijau) */}
            {blokJawabanTersimpan.map((blok, idx) => {
              const daftarSoal = hitungPosisiBulatanBlok(blok);
              const pertama = daftarSoal[0]?.pilihan[0];
              const tebal = Math.max(1.6, Math.min(3, blok.radiusBulatan * 0.25));
              return (
                <g key={`saved-j-${idx}`}>
                  {daftarSoal.map((soal) =>
                    soal.pilihan.map((pil) => (
                      <circle
                        key={`sj-${idx}-${soal.nomor}-${pil.label}`}
                        cx={pil.pusat.x}
                        cy={pil.pusat.y}
                        r={pil.radius}
                        fill="rgba(22, 163, 74, 0.16)"
                        stroke="#15803d"
                        strokeWidth={tebal}
                      />
                    )),
                  )}
                  {pertama ? (
                    <text
                      x={pertama.pusat.x - pertama.radius}
                      y={Math.max(24, pertama.pusat.y - pertama.radius - 8)}
                      fill="#14532d"
                      fontSize="20"
                      fontWeight="bold"
                    >
                      No. {blok.nomorAwal}–{blok.nomorAwal + blok.jumlahNomor - 1}
                    </text>
                  ) : null}
                </g>
              );
            })}

            {/* Area nama yang sudah tersimpan (ungu tipis saat sedang di langkah Jawaban) */}
            {posisiNamaTersimpan.length > 0 ? (
              <g>
                {posisiNamaTersimpan.map((kolom) =>
                  kolom.digit.map((d) => (
                    <circle
                      key={`sn-${kolom.kolomKe}-${d.label}`}
                      cx={d.pusat.x}
                      cy={d.pusat.y}
                      r={d.radius}
                      fill="rgba(124, 58, 237, 0.12)"
                      stroke="#6d28d9"
                      strokeWidth={Math.max(1.1, Math.min(2, d.radius * 0.25))}
                    />
                  )),
                )}
              </g>
            ) : null}

            {/* Pratinjau blok jawaban yang sedang disusun (biru terang) */}
            {pratinjauDraftJawaban.map((soal) =>
              soal.pilihan.map((pil) => (
                <circle
                  key={`dj-${soal.nomor}-${pil.label}`}
                  cx={pil.pusat.x}
                  cy={pil.pusat.y}
                  r={pil.radius}
                  fill="rgba(37, 99, 235, 0.22)"
                  stroke="#1d4ed8"
                  strokeWidth={Math.max(1.8, Math.min(3.5, pil.radius * 0.28))}
                />
              )),
            )}

            {/* Pratinjau kisi nama (kolom x A-Z) yang sedang diatur */}
            {pratinjauDraftNama.length > 0 ? (
              <g>
                {pratinjauDraftNama.map((kolom) =>
                  kolom.digit.map((d) => (
                    <circle
                      key={`dn-${kolom.kolomKe}-${d.label}`}
                      cx={d.pusat.x}
                      cy={d.pusat.y}
                      r={d.radius}
                      fill="rgba(124, 58, 237, 0.18)"
                      stroke="#6d28d9"
                      strokeWidth={tebalGarisNama}
                    />
                  )),
                )}
              </g>
            ) : null}

            {/* Titik jangkar pertama (kiri atas: No. awal A atau Nama Kolom 1 huruf A) */}
            {titikPertamaAktif ? (
              <g>
                <circle
                  cx={titikPertamaAktif.x}
                  cy={titikPertamaAktif.y}
                  r={radiusAktif + 4}
                  fill="none"
                  stroke="#ea580c"
                  strokeWidth={mode === 'nama' ? 2.5 : 4}
                />
                <circle
                  cx={titikPertamaAktif.x}
                  cy={titikPertamaAktif.y}
                  r={mode === 'nama' ? 2.5 : 4}
                  fill="#ea580c"
                />
              </g>
            ) : null}

            {/* Titik jangkar terakhir (kanan bawah: No. akhir atau Nama Kolom terakhir huruf Z) */}
            {titikTerakhirAktif ? (
              <g>
                <circle
                  cx={titikTerakhirAktif.x}
                  cy={titikTerakhirAktif.y}
                  r={radiusAktif + 4}
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth={mode === 'nama' ? 2.5 : 4}
                />
                <circle
                  cx={titikTerakhirAktif.x}
                  cy={titikTerakhirAktif.y}
                  r={mode === 'nama' ? 2.5 : 4}
                  fill="#0284c7"
                />
              </g>
            ) : null}
          </svg>
        </div>
      </div>
    </div>
  );
}
