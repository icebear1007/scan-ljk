import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  Play,
} from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { ambilPengaturan } from '../db/database.ts';
import {
  bacaLjkDiWorker,
  buatContohLjkDiWorker,
  deteksiKertasDiWorker,
  ubahFileGambarKeRgba,
  ubahRgbaKeDataUrl,
} from '../omr/omrClient.ts';
import {
  KUNCI_CONTOH_40_SOAL,
  TEMPLATE_CONTOH_40_SOAL,
  type OpsiGambarContohLJK,
} from '../omr/sampleTemplate.ts';
import type { HasilBacaLJK, HasilDeteksiKertas } from '../omr/types.ts';
import { PENGATURAN_AWAL, type JenisPenanda } from '../types/ljk.ts';
import { formatDetik } from '../utils/kesehatanAplikasi.ts';

type SkenarioUji = 'normal' | 'sulit' | 'miring';

const DAFTAR_SKENARIO: Array<{
  id: SkenarioUji;
  judul: string;
  keterangan: string;
  buatOpsi: () => OpsiGambarContohLJK;
}> = [
  {
    id: 'normal',
    judul: 'Contoh Normal (Miring Ringan & Bayangan)',
    keterangan: '40 soal (36 benar, 3 salah, 1 kosong) dan nomor siswa 2407.',
    buatOpsi: () => {
      const jawaban = [...KUNCI_CONTOH_40_SOAL];
      jawaban[3] = 'A'; // salah (kunci D)
      jawaban[14] = 'B'; // salah (kunci E)
      jawaban[27] = 'E'; // salah (kunci C)
      jawaban[35] = ''; // kosong
      return {
        jawabanDiisi: jawaban,
        identitasDigit: '2407',
        kemiringanDerajat: 4,
        perspektif: 0.04,
        bayangan: 45,
      };
    },
  },
  {
    id: 'sulit',
    judul: 'Contoh Kasus Sulit (Ganda, Kosong, Pensil Tipis, Bekas Hapus)',
    keterangan:
      'Menguji deteksi nomor kuning pada soal 3 (kosong), 5 (ganda), 7 (pensil tipis), dan 9 (bekas hapus).',
    buatOpsi: () => {
      const jawaban = [...KUNCI_CONTOH_40_SOAL];
      jawaban[2] = ''; // No 3 kosong
      jawaban[4] = 'AE'; // No 5 ganda
      jawaban[6] = ''; // No 7 hanya pensil tipis
      return {
        jawabanDiisi: jawaban,
        arsiranTipis: { 7: 'C' },
        bekasHapus: { 9: 'A' },
        identitasDigit: '1085',
        kemiringanDerajat: -3,
        perspektif: 0.03,
        bayangan: 35,
      };
    },
  },
  {
    id: 'miring',
    judul: 'Contoh Kertas Miring Berlebihan',
    keterangan:
      'Menguji peringatan otomatis saat kertas terlalu miring agar guru diminta foto ulang.',
    buatOpsi: () => ({
      jawabanDiisi: [...KUNCI_CONTOH_40_SOAL],
      identitasDigit: '0912',
      kemiringanDerajat: 24,
      perspektif: 0.05,
      bayangan: 30,
    }),
  },
];

export function UjiMesinPage() {
  const pengaturan =
    useLiveQuery(() => ambilPengaturan(), []) ?? PENGATURAN_AWAL;

  const [skenarioDipilih, setSkenarioDipilih] =
    useState<SkenarioUji>('normal');
  const [sedangMemproses, setSedangMemproses] = useState(false);
  const [pesanProses, setPesanProses] = useState('');
  const [galat, setGalat] = useState<string | null>(null);

  // Hasil uji contoh bawaan
  const [hasilContoh, setHasilContoh] = useState<{
    hasil: HasilBacaLJK;
    fotoAsliUrl: string;
    fotoLurusUrl: string | null;
  } | null>(null);
  const [tampilkanTanda, setTampilkanTanda] = useState(true);

  // Hasil uji foto sendiri (deteksi + luruskan kertas)
  const [jenisPenandaUji, setJenisPenandaUji] =
    useState<JenisPenanda>('penanda-sudut');
  const [hasilFotoSendiri, setHasilFotoSendiri] = useState<{
    deteksi: HasilDeteksiKertas;
    fotoAsliUrl: string;
    fotoLurusUrl: string | null;
  } | null>(null);

  const inputFotoRef = useRef<HTMLInputElement>(null);

  const jalankanUjiContoh = async () => {
    const skenario = DAFTAR_SKENARIO.find((s) => s.id === skenarioDipilih);
    if (!skenario) return;

    setSedangMemproses(true);
    setGalat(null);
    setPesanProses('Menyiapkan mesin pembaca dan membuat contoh LJK...');

    try {
      const gambarContoh = await buatContohLjkDiWorker(
        TEMPLATE_CONTOH_40_SOAL,
        skenario.buatOpsi(),
      );
      const fotoAsliUrl = ubahRgbaKeDataUrl(gambarContoh, 0.8);

      setPesanProses('Sedang membaca lembar jawaban...');
      const hasil = await bacaLjkDiWorker(gambarContoh, {
        template: TEMPLATE_CONTOH_40_SOAL,
        pengaturan,
        kunciJawaban: KUNCI_CONTOH_40_SOAL,
        sertakanGambarLurus: true,
      });

      const fotoLurusUrl = hasil.gambarLurus
        ? ubahRgbaKeDataUrl(hasil.gambarLurus, 0.85)
        : null;

      setHasilContoh({ hasil, fotoAsliUrl, fotoLurusUrl });
    } catch (err) {
      setGalat(
        err instanceof Error
          ? err.message
          : 'Gagal menjalankan uji mesin pembaca.',
      );
    } finally {
      setSedangMemproses(false);
      setPesanProses('');
    }
  };

  const handlePilihFotoSendiri = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setSedangMemproses(true);
    setGalat(null);
    setPesanProses('Sedang memeriksa dan meluruskan kertas LJK...');

    try {
      const gambarRgba = await ubahFileGambarKeRgba(file, 1600);
      const fotoAsliUrl = ubahRgbaKeDataUrl(gambarRgba, 0.8);

      const deteksi = await deteksiKertasDiWorker(gambarRgba, {
        jenisPenanda: jenisPenandaUji,
        ukuranStandar: { lebar: 1000, tinggi: 1414 },
        sertakanGambarLurus: true,
      });

      const fotoLurusUrl = deteksi.gambarLurus
        ? ubahRgbaKeDataUrl(deteksi.gambarLurus, 0.85)
        : null;

      setHasilFotoSendiri({ deteksi, fotoAsliUrl, fotoLurusUrl });
    } catch (err) {
      setGalat(
        err instanceof Error
          ? err.message
          : 'Gagal membaca foto yang dipilih.',
      );
    } finally {
      setSedangMemproses(false);
      setPesanProses('');
    }
  };

  const stdW = TEMPLATE_CONTOH_40_SOAL.ukuranStandar.lebar;
  const stdH = TEMPLATE_CONTOH_40_SOAL.ukuranStandar.tinggi;

  return (
    <div className="space-y-5">
      {sedangMemproses ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-3.5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-950"
        >
          <progress
            aria-label={pesanProses || 'Sedang membaca...'}
            className="loading-spinner shrink-0"
          />
          <p className="text-sm font-bold">
            {pesanProses || 'Sedang membaca...'}
          </p>
        </div>
      ) : null}

      {galat ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm font-medium text-red-950"
        >
          {galat}
        </div>
      ) : null}

      {/* Bagian 1: Uji cepat dengan contoh LJK 40 soal */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            1. Uji Cepat dengan Contoh LJK (40 Soal)
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            Menguji seluruh alur pembacaan (cari sudut, luruskan kertas, ukur
            bulatan, dan hitung nilai) langsung di perangkat tanpa internet.
          </p>
        </div>

        <fieldset className="space-y-2.5">
          <legend className="text-sm font-bold text-slate-900">
            Pilih contoh kondisi foto
          </legend>
          {DAFTAR_SKENARIO.map((sk) => {
            const aktif = skenarioDipilih === sk.id;
            return (
              <label
                key={sk.id}
                htmlFor={`skenario-${sk.id}`}
                className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-xl border-2 p-3.5 transition-colors ${
                  aktif
                    ? 'border-blue-900 bg-blue-50'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <input
                  id={`skenario-${sk.id}`}
                  type="radio"
                  name="skenarioUji"
                  value={sk.id}
                  checked={aktif}
                  onChange={() => setSkenarioDipilih(sk.id)}
                  className="mt-0.5 h-5 w-5 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-900">
                    {sk.judul}
                  </span>
                  <span className="mt-0.5 block text-xs text-slate-700">
                    {sk.keterangan}
                  </span>
                </div>
              </label>
            );
          })}
        </fieldset>

        <button
          type="button"
          disabled={sedangMemproses}
          onClick={() => {
            void jalankanUjiContoh();
          }}
          className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-blue-900 px-4 py-3 text-base font-bold text-white transition-colors hover:bg-blue-800 active:bg-blue-950 disabled:opacity-50"
        >
          <Play className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>Jalankan Uji Pembacaan</span>
        </button>

        {hasilContoh ? (
          <div className="space-y-4 border-t border-slate-200 pt-4">
            {hasilContoh.hasil.peringatan.length > 0 ? (
              <div
                role="alert"
                className="space-y-1.5 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-sm text-amber-950"
              >
                <div className="flex items-center gap-2 font-bold">
                  <AlertTriangle
                    className="h-5 w-5 shrink-0 text-amber-700"
                    aria-hidden="true"
                  />
                  <span>Peringatan Kualitas Foto</span>
                </div>
                <ul className="list-disc pl-5 space-y-1">
                  {hasilContoh.hasil.peringatan.map((p, i) => (
                    <li key={`${p.kode}-${i}`}>{p.pesan}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm font-bold text-emerald-900">
                <CheckCircle2
                  className="h-5 w-5 shrink-0 text-emerald-700"
                  aria-hidden="true"
                />
                <span>
                  Pembacaan berhasil dalam{' '}
                  {(hasilContoh.hasil.waktuProsesMs / 1000)
                    .toFixed(2)
                    .replace('.', ',')}{' '}
                  detik.
                </span>
              </div>
            )}

            {hasilContoh.hasil.ringkasanNilai ? (
              <div className="grid grid-cols-5 gap-1.5 rounded-xl bg-slate-50 p-3 text-center">
                <div>
                  <p className="text-lg font-bold text-emerald-800">
                    {hasilContoh.hasil.ringkasanNilai.benar}
                  </p>
                  <p className="text-[11px] font-medium text-slate-700">
                    Benar
                  </p>
                </div>
                <div>
                  <p className="text-lg font-bold text-red-700">
                    {hasilContoh.hasil.ringkasanNilai.salah}
                  </p>
                  <p className="text-[11px] font-medium text-slate-700">
                    Salah
                  </p>
                </div>
                <div>
                  <p className="text-lg font-bold text-amber-700">
                    {hasilContoh.hasil.ringkasanNilai.kosong}
                  </p>
                  <p className="text-[11px] font-medium text-slate-700">
                    Kosong
                  </p>
                </div>
                <div>
                  <p className="text-lg font-bold text-amber-800">
                    {hasilContoh.hasil.ringkasanNilai.perluDicek}
                  </p>
                  <p className="text-[11px] font-medium text-slate-700">
                    Dicek
                  </p>
                </div>
                <div>
                  <p className="text-lg font-bold text-blue-900">
                    {hasilContoh.hasil.ringkasanNilai.nilai}
                  </p>
                  <p className="text-[11px] font-medium text-slate-700">
                    Nilai
                  </p>
                </div>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700">
              <span>
                <strong>Nomor siswa terbaca:</strong>{' '}
                {hasilContoh.hasil.identitas?.nilaiTerbaca || '-'}
              </span>
              <span>
                <strong>Waktu baca:</strong>{' '}
                {formatDetik(hasilContoh.hasil.waktuProsesMs)}
              </span>
            </div>

            {hasilContoh.fotoLurusUrl ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    Hasil Kertas Lurus &amp; Tanda Warna
                  </h3>
                  <button
                    type="button"
                    onClick={() => setTampilkanTanda((v) => !v)}
                    className="inline-flex min-h-12 items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-900 hover:bg-slate-200"
                  >
                    {tampilkanTanda ? (
                      <>
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                        <span>Sembunyikan Tanda</span>
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4" aria-hidden="true" />
                        <span>Tampilkan Tanda</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="relative overflow-hidden rounded-xl border border-slate-300 bg-slate-100">
                  <img
                    src={hasilContoh.fotoLurusUrl}
                    alt="Lembar jawaban yang sudah diluruskan dengan tanda warna hasil koreksi"
                    className="block w-full h-auto"
                  />
                  {tampilkanTanda ? (
                    <svg
                      viewBox={`0 0 ${stdW} ${stdH}`}
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 h-full w-full"
                    >
                      {hasilContoh.hasil.hasilPerNomor.map((item, idx) => {
                        const status = hasilContoh.hasil.statusPerNomor[idx];
                        const kunci = KUNCI_CONTOH_40_SOAL[idx];
                        const perluKuning =
                          status === 'kosong' ||
                          status === 'ganda' ||
                          status === 'ragu';

                        return (
                          <g key={item.nomor}>
                            {item.bulatan.map((b) => {
                              const adalahKunci = b.label === kunci;
                              const terpilih = item.jawabanTerbaca === b.label;

                              if (status === 'benar' && terpilih) {
                                return (
                                  <g key={`${item.nomor}-${b.label}`}>
                                    <circle
                                      cx={b.pusat.x}
                                      cy={b.pusat.y}
                                      r={b.radius + 4}
                                      fill="rgba(22, 163, 74, 0.25)"
                                      stroke="#15803d"
                                      strokeWidth="4"
                                    />
                                    <text
                                      x={b.pusat.x + b.radius + 7}
                                      y={b.pusat.y + 6}
                                      fill="#15803d"
                                      fontSize="20"
                                      fontWeight="bold"
                                    >
                                      ✓
                                    </text>
                                  </g>
                                );
                              }

                              if (status === 'salah' && terpilih) {
                                return (
                                  <g key={`${item.nomor}-${b.label}`}>
                                    <circle
                                      cx={b.pusat.x}
                                      cy={b.pusat.y}
                                      r={b.radius + 4}
                                      fill="rgba(220, 38, 38, 0.22)"
                                      stroke="#b91c1c"
                                      strokeWidth="4"
                                    />
                                    <text
                                      x={b.pusat.x + b.radius + 7}
                                      y={b.pusat.y + 6}
                                      fill="#b91c1c"
                                      fontSize="19"
                                      fontWeight="bold"
                                    >
                                      ✕
                                    </text>
                                  </g>
                                );
                              }

                              if (
                                perluKuning &&
                                (b.status !== 'kosong' || adalahKunci)
                              ) {
                                return (
                                  <g key={`${item.nomor}-${b.label}`}>
                                    <circle
                                      cx={b.pusat.x}
                                      cy={b.pusat.y}
                                      r={b.radius + 4}
                                      fill="rgba(234, 179, 8, 0.25)"
                                      stroke="#a16207"
                                      strokeWidth="4"
                                    />
                                    {adalahKunci ? (
                                      <circle
                                        cx={b.pusat.x}
                                        cy={b.pusat.y}
                                        r={b.radius + 9}
                                        fill="none"
                                        stroke="#15803d"
                                        strokeWidth="3"
                                        strokeDasharray="6 4"
                                      />
                                    ) : null}
                                    <text
                                      x={b.pusat.x + b.radius + 8}
                                      y={b.pusat.y + 6}
                                      fill="#854d0e"
                                      fontSize="19"
                                      fontWeight="bold"
                                    >
                                      ?
                                    </text>
                                  </g>
                                );
                              }

                              if (status === 'salah' && adalahKunci) {
                                return (
                                  <circle
                                    key={`${item.nomor}-${b.label}`}
                                    cx={b.pusat.x}
                                    cy={b.pusat.y}
                                    r={b.radius + 5}
                                    fill="none"
                                    stroke="#15803d"
                                    strokeWidth="4"
                                    strokeDasharray="6 4"
                                  />
                                );
                              }

                              return null;
                            })}
                          </g>
                        );
                      })}
                    </svg>
                  ) : null}
                </div>

                <details className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-800">
                  <summary className="cursor-pointer font-bold text-slate-900">
                    Lihat Foto Sebelum Diluruskan
                  </summary>
                  <img
                    src={hasilContoh.fotoAsliUrl}
                    alt="Foto contoh LJK sebelum diluruskan"
                    className="mt-3 block w-full rounded-lg border border-slate-200"
                  />
                </details>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {/* Bagian 2: Uji luruskan kertas dengan foto LJK sendiri */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            2. Uji Meluruskan Foto LJK Anda Sendiri
          </h2>
          <p className="mt-1 text-sm text-slate-700">
            Coba unggah atau potret satu lembar LJK sekolah Anda untuk melihat
            apakah keempat sudut kertas sudah terdeteksi dan lurus dengan rapi.
          </p>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-bold text-slate-900">
            Ciri sudut lembar LJK Anda
          </legend>
          <div className="grid grid-cols-2 gap-2.5">
            <label
              htmlFor="penanda-sudut"
              className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-bold ${
                jenisPenandaUji === 'penanda-sudut'
                  ? 'border-blue-900 bg-blue-50 text-blue-950'
                  : 'border-slate-200 bg-white text-slate-800'
              }`}
            >
              <input
                id="penanda-sudut"
                type="radio"
                name="jenisPenandaUji"
                checked={jenisPenandaUji === 'penanda-sudut'}
                onChange={() => setJenisPenandaUji('penanda-sudut')}
                className="h-5 w-5 shrink-0"
              />
              <span>Kotak hitam di pojok</span>
            </label>

            <label
              htmlFor="tepi-kertas"
              className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-bold ${
                jenisPenandaUji === 'tepi-kertas'
                  ? 'border-blue-900 bg-blue-50 text-blue-950'
                  : 'border-slate-200 bg-white text-slate-800'
              }`}
            >
              <input
                id="tepi-kertas"
                type="radio"
                name="jenisPenandaUji"
                checked={jenisPenandaUji === 'tepi-kertas'}
                onChange={() => setJenisPenandaUji('tepi-kertas')}
                className="h-5 w-5 shrink-0"
              />
              <span>Tepi kertas biasa</span>
            </label>
          </div>
        </fieldset>

        <button
          type="button"
          disabled={sedangMemproses}
          onClick={() => inputFotoRef.current?.click()}
          className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-blue-900 bg-white px-4 py-3 text-base font-bold text-blue-900 transition-colors hover:bg-blue-50 active:bg-blue-100 disabled:opacity-50"
        >
          <Camera className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>Pilih / Potret Foto LJK</span>
        </button>

        <input
          ref={inputFotoRef}
          type="file"
          accept="image/*"
          onChange={(e) => {
            void handlePilihFotoSendiri(e);
          }}
          className="sr-only"
          aria-label="Pilih foto LJK untuk diuji"
        />

        {hasilFotoSendiri ? (
          <div className="space-y-3 border-t border-slate-200 pt-4">
            {hasilFotoSendiri.deteksi.berhasil ? (
              <div className="rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm font-bold text-emerald-900">
                Kertas ditemukan (
                {hasilFotoSendiri.deteksi.metode === 'penanda-sudut'
                  ? 'dari kotak hitam sudut'
                  : 'dari tepi kertas'}
                ) dalam {formatDetik(hasilFotoSendiri.deteksi.waktuProsesMs)}.
              </div>
            ) : (
              <div
                role="alert"
                className="rounded-xl border border-red-300 bg-red-50 px-3.5 py-3 text-sm font-medium text-red-950"
              >
                {hasilFotoSendiri.deteksi.peringatan[0]?.pesan ||
                  'Kertas belum terdeteksi. Mohon foto ulang dengan latar meja yang kontras.'}
              </div>
            )}

            {hasilFotoSendiri.fotoLurusUrl ? (
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-slate-800">
                  Hasil kertas yang sudah diluruskan:
                </p>
                <img
                  src={hasilFotoSendiri.fotoLurusUrl}
                  alt="Hasil pelurusan foto LJK yang diunggah"
                  className="block w-full rounded-xl border border-slate-300"
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
