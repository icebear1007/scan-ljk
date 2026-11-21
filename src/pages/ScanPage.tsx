import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertTriangle,
  Camera,
  Check,
  RotateCcw,
  Upload,
} from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { ambilPengaturan, db } from '../db/database.ts';
import { daftarHurufSah } from '../db/ujians.ts';
import {
  bacaLjkDiWorker,
  buatContohLjkDiWorker,
  ubahFileGambarKeRgba,
  ubahRgbaKeDataUrl,
  ubahRgbaKeJpegBlob,
} from '../omr/omrClient.ts';
import type { GambarMentahRgba, HasilBacaLJK } from '../omr/types.ts';
import { PENGATURAN_AWAL, type Ujian } from '../types/ljk.ts';

export interface HasilSiapTampil {
  hasilBaca: HasilBacaLJK;
  fotoLurusBlob?: Blob;
}

interface ScanPageProps {
  ujian: Ujian;
  pesanBanner?: string | null;
  onTutupBanner?: () => void;
  onHasilSiap: (data: HasilSiapTampil) => void;
}

export function ScanPage({
  ujian,
  pesanBanner,
  onTutupBanner,
  onHasilSiap,
}: ScanPageProps) {
  const pengaturan =
    useLiveQuery(() => ambilPengaturan(), []) ?? PENGATURAN_AWAL;

  const jumlahTerkoreksi =
    useLiveQuery(
      () => db.hasilScans.where('idUjian').equals(ujian.id).count(),
      [ujian.id],
    ) ?? 0;

  const [fotoDipilih, setFotoDipilih] = useState<{
    rgba: GambarMentahRgba;
    previewUrl: string;
  } | null>(null);
  const [sedangMembaca, setSedangMembaca] = useState(false);
  const [galatBaca, setGalatBaca] = useState<string | null>(null);

  const inputKameraRef = useRef<HTMLInputElement>(null);
  const inputGaleriRef = useRef<HTMLInputElement>(null);

  const handlePilihFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setGalatBaca(null);
    setSedangMembaca(true);
    try {
      const rgba = await ubahFileGambarKeRgba(file, 1600);
      const previewUrl = ubahRgbaKeDataUrl(rgba, 0.82);
      setFotoDipilih({ rgba, previewUrl });
    } catch (err) {
      setGalatBaca(
        err instanceof Error
          ? err.message
          : 'Foto tidak dapat dibuka. Silakan foto ulang.',
      );
    } finally {
      setSedangMembaca(false);
    }
  };

  const handleBuatSimulasiSiswa = async () => {
    setGalatBaca(null);
    setSedangMembaca(true);
    try {
      const tpl = ujian.salinanTemplate;
      const hurufSah = daftarHurufSah(tpl.jumlahPilihan);
      const kunci = ujian.kunciJawaban;

      // Buat jawaban siswa realistis: mayoritas benar, beberapa salah, 1 kosong, 1 ganda, 1 pensil tipis
      const jawabanSiswa = kunci.map((k, idx) => {
        if (idx === 2) return ''; // kosong
        if (idx === 4 && hurufSah.length >= 2) {
          return `${hurufSah[0]}${hurufSah[hurufSah.length - 1]}`; // ganda
        }
        if (idx === 6) return ''; // diisi tipis
        if (idx % 9 === 1) {
          return hurufSah.find((h) => h !== k) ?? hurufSah[0]; // salah
        }
        return k || hurufSah[idx % hurufSah.length];
      });

      const nomorTipis = Math.min(7, tpl.jumlahSoal);
      const hurufTipis = kunci[nomorTipis - 1] || hurufSah[0];

      const contohDaftarNama = [
        'ANI RAHMAWATI',
        'BUDI SANTOSO',
        'CITRA DEWI',
        'DIMAS PRATAMA',
        'EKA PUTRI',
      ];
      const namaSimulasi = tpl.blokNama
        ? contohDaftarNama[jumlahTerkoreksi % contohDaftarNama.length].slice(
            0,
            tpl.blokNama.jumlahKolom,
          )
        : undefined;

      const idDigit =
        !tpl.blokNama && tpl.blokIdentitas && tpl.blokIdentitas.length > 0
          ? Array.from({ length: tpl.blokIdentitas.length }, (_, i) =>
              String((jumlahTerkoreksi + i + 1) % 10),
            ).join('')
          : undefined;

      const rgba = await buatContohLjkDiWorker(tpl, {
        jawabanDiisi: jawabanSiswa,
        arsiranTipis: tpl.jumlahSoal >= 7 ? { [nomorTipis]: hurufTipis } : undefined,
        namaSiswa: namaSimulasi,
        identitasDigit: idDigit,
        kemiringanDerajat: 4,
        perspektif: 0.04,
        bayangan: 40,
        tanpaPenandaSudut: tpl.jenisPenanda === 'tepi-kertas',
      });

      const previewUrl = ubahRgbaKeDataUrl(rgba, 0.82);
      setFotoDipilih({ rgba, previewUrl });
    } catch (err) {
      setGalatBaca(
        err instanceof Error
          ? err.message
          : 'Gagal menyiapkan contoh foto LJK siswa.',
      );
    } finally {
      setSedangMembaca(false);
    }
  };

  const handlePakaiFotoIni = async () => {
    if (!fotoDipilih) return;
    setSedangMembaca(true);
    setGalatBaca(null);

    try {
      const hasilBaca = await bacaLjkDiWorker(fotoDipilih.rgba, {
        template: ujian.salinanTemplate,
        pengaturan,
        kunciJawaban: ujian.kunciJawaban,
        sertakanGambarLurus: true,
      });

      // PRD Layar 5: Jangan pernah menampilkan nilai dari hasil yang gagal dibaca
      if (!hasilBaca.berhasil) {
        setGalatBaca(
          hasilBaca.peringatan[0]?.pesan ||
            'Kertas LJK tidak terdeteksi. Pastikan seluruh kertas dan keempat pojok terlihat jelas, lalu foto ulang.',
        );
        setFotoDipilih(null);
        return;
      }

      const fotoLurusBlob = hasilBaca.gambarLurus
        ? await ubahRgbaKeJpegBlob(hasilBaca.gambarLurus, 0.82)
        : undefined;

      onHasilSiap({ hasilBaca, fotoLurusBlob });
    } catch (err) {
      setGalatBaca(
        err instanceof Error
          ? err.message
          : 'Gagal membaca LJK. Mohon foto ulang.',
      );
      setFotoDipilih(null);
    } finally {
      setSedangMembaca(false);
    }
  };

  return (
    <div className="space-y-4">
      {pesanBanner ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950"
        >
          <span>{pesanBanner}</span>
          <button
            type="button"
            onClick={onTutupBanner}
            className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-xl px-2.5 text-sm font-bold text-emerald-900 hover:bg-emerald-100"
          >
            Tutup
          </button>
        </div>
      ) : null}

      {/* Info Ujian Aktif */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-slate-900">{ujian.nama}</h2>
          <p className="text-xs text-slate-700">
            Kelas {ujian.kelas} &middot; {ujian.kunciJawaban.length} soal
          </p>
        </div>
        <span className="shrink-0 rounded-xl bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-900">
          {jumlahTerkoreksi} LJK
        </span>
      </section>

      {/* Indikator Sedang Membaca */}
      {sedangMembaca ? (
        <section
          role="status"
          aria-live="polite"
          className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-blue-200 bg-blue-50 p-8 text-center text-blue-950"
        >
          <progress
            aria-label="Sedang membaca..."
            className="loading-spinner"
          />
          <div className="space-y-1">
            <p className="text-lg font-bold">Sedang membaca...</p>
            <p className="text-sm text-blue-900">
              Meluruskan kertas dan memeriksa setiap bulatan jawaban.
            </p>
          </div>
        </section>
      ) : null}

      {/* Pesan Gagal Deteksi Kertas (tanpa menampilkan nilai) */}
      {galatBaca && !sedangMembaca ? (
        <section
          role="alert"
          className="rounded-2xl border-2 border-red-300 bg-red-50 p-5 text-red-950 space-y-3"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-6 w-6 shrink-0 text-red-700"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <h3 className="text-base font-bold">LJK Belum Dapat Dibaca</h3>
              <p className="text-sm">{galatBaca}</p>
            </div>
          </div>
          <p className="text-xs text-red-900">
            Tips: letakkan LJK di atas meja yang agak gelap, hindari bayangan
            tangan, dan pastikan keempat pojok kertas masuk seluruhnya.
          </p>
        </section>
      ) : null}

      {/* Tahap Konfirmasi Foto */}
      {fotoDipilih && !sedangMembaca ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-4">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Periksa Foto Sebelum Dibaca
            </h3>
            <p className="mt-0.5 text-sm text-slate-700">
              Pastikan gambar jelas, tidak buram, dan keempat pojok kertas
              terlihat utuh.
            </p>
          </div>

          <img
            src={fotoDipilih.previewUrl}
            alt="Pratinjau foto LJK siswa untuk dikonfirmasi"
            className="block max-h-[55dvh] w-full rounded-xl border border-slate-300 bg-slate-900 object-contain"
          />

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                setFotoDipilih(null);
                setGalatBaca(null);
              }}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 text-base font-bold text-slate-900 hover:bg-slate-200"
            >
              <RotateCcw className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>Foto Ulang</span>
            </button>

            <button
              type="button"
              onClick={() => {
                void handlePakaiFotoIni();
              }}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-blue-900 px-4 py-3 text-base font-bold text-white shadow-sm hover:bg-blue-800 active:bg-blue-950"
            >
              <Check className="h-5 w-5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
              <span>Pakai Foto Ini</span>
            </button>
          </div>
        </section>
      ) : null}

      {/* Tahap Ambil Foto / Unggah dari Galeri */}
      {!fotoDipilih && !sedangMembaca ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 space-y-1.5">
            <p className="font-bold">Panduan memotret LJK:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Kertas rata, tidak terlipat.</li>
              <li>Cahaya merata, tanpa bayangan tangan atau HP.</li>
              <li>Seluruh kertas dan keempat pojok masuk bingkai foto.</li>
            </ul>
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => inputKameraRef.current?.click()}
              className="flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-blue-900 px-5 py-4 text-lg font-bold text-white shadow-sm transition-colors hover:bg-blue-800 active:bg-blue-950"
            >
              <Camera className="h-6 w-6 shrink-0" aria-hidden="true" />
              <span>Ambil Foto</span>
            </button>

            <button
              type="button"
              onClick={() => inputGaleriRef.current?.click()}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-blue-900 bg-white px-4 py-3 text-base font-bold text-blue-900 transition-colors hover:bg-blue-50"
            >
              <Upload className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>Unggah dari Galeri</span>
            </button>

            <button
              type="button"
              onClick={() => {
                void handleBuatSimulasiSiswa();
              }}
              className="flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-100"
            >
              Uji Cepat dengan Simulasi Foto LJK Siswa
            </button>

            <input
              ref={inputKameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                void handlePilihFile(e);
              }}
              className="sr-only"
              aria-label="Ambil foto LJK siswa dengan kamera"
            />
            <input
              ref={inputGaleriRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                void handlePilihFile(e);
              }}
              className="sr-only"
              aria-label="Unggah foto LJK siswa dari galeri"
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
