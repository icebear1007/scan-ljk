import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  Download,
  HardDrive,
  Image,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Trash2,
  Upload,
  WifiOff,
} from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';
import {
  bacaDanValidasiCadangan,
  pulihkanDariCadangan,
  unduhFileCadangan,
  type FormatCadanganLJK,
  type RingkasanCadangan,
} from '../db/backup.ts';
import {
  ambilPengaturan,
  db,
  hapusSemuaData,
  resetPengaturanKeAwal,
  simpanPengaturan,
} from '../db/database.ts';
import { PENGATURAN_AWAL, type SkalaNilai } from '../types/ljk.ts';
import {
  formatUkuranByte,
  type EvaluasiRuangPenyimpanan,
} from '../utils/kesehatanAplikasi.ts';

interface PengaturanPageProps {
  canInstall: boolean;
  isInstalled: boolean;
  offlineReady: boolean;
  isOffline: boolean;
  infoRuang: EvaluasiRuangPenyimpanan | null;
  penyimpananPersisten: boolean | null;
  onRefreshRuang: () => Promise<void>;
  onInstall: () => void;
  onOpenUjiMesin: () => void;
}

interface PesanStatus {
  jenis: 'sukses' | 'galat';
  teks: string;
}

function formatAngkaId(nilai: number): string {
  return nilai.toFixed(2).replace('.', ',');
}

function formatTanggalId(iso?: string): string {
  if (!iso) return 'Belum pernah';
  const tgl = new Date(iso);
  if (Number.isNaN(tgl.getTime())) return 'Belum pernah';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(tgl);
}

export function PengaturanPage({
  canInstall,
  isInstalled,
  offlineReady,
  isOffline,
  infoRuang,
  penyimpananPersisten,
  onRefreshRuang,
  onInstall,
  onOpenUjiMesin,
}: PengaturanPageProps) {
  const pengaturan =
    useLiveQuery(() => ambilPengaturan(), []) ?? PENGATURAN_AWAL;

  const ringkasanData = useLiveQuery(async () => {
    const [jumlahTemplate, jumlahUjian, jumlahHasilScan] = await Promise.all([
      db.templates.count(),
      db.ujians.count(),
      db.hasilScans.count(),
    ]);
    return { jumlahTemplate, jumlahUjian, jumlahHasilScan };
  }, []) ?? { jumlahTemplate: 0, jumlahUjian: 0, jumlahHasilScan: 0 };

  const [pesan, setPesan] = useState<PesanStatus | null>(null);
  const [sedangProses, setSedangProses] = useState(false);

  // State modal pemulihan data
  const [calonPulih, setCalonPulih] = useState<{
    cadangan: FormatCadanganLJK;
    ringkasan: RingkasanCadangan;
  } | null>(null);

  // State modal hapus semua data (konfirmasi dua langkah)
  const [langkahHapus, setLangkahHapus] = useState<0 | 1 | 2>(0);
  const [ketikanHapus, setKetikanHapus] = useState('');

  const inputFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void onRefreshRuang();
  }, [
    onRefreshRuang,
    ringkasanData.jumlahTemplate,
    ringkasanData.jumlahUjian,
    ringkasanData.jumlahHasilScan,
  ]);

  const handleUbahAmbangTerisi = async (nilaiBaru: number) => {
    await simpanPengaturan({ ambangTerisi: nilaiBaru });
  };

  const handleUbahAmbangKosong = async (nilaiBaru: number) => {
    const ambangTerisiBaru = Math.max(pengaturan.ambangTerisi, nilaiBaru + 0.05);
    await simpanPengaturan({
      ambangKosong: nilaiBaru,
      ambangTerisi: Number(ambangTerisiBaru.toFixed(2)),
    });
  };

  const handleUbahBatasRagu = async (persenBaru: number) => {
    await simpanPengaturan({ batasRaguPersen: persenBaru });
  };

  const handleUbahSkala = async (skala: SkalaNilai) => {
    await simpanPengaturan({ skalaNilai: skala });
  };

  const handleUbahPoin = async (
    kolom: 'poinBenar' | 'poinSalah' | 'poinKosong',
    mentah: string,
  ) => {
    const angka = Number(mentah);
    if (!Number.isFinite(angka)) return;
    await simpanPengaturan({ [kolom]: angka });
  };

  const handleUbahSimpanFoto = async (aktif: boolean) => {
    await simpanPengaturan({ simpanFotoScan: aktif });
  };

  const handleResetPengaturan = async () => {
    await resetPengaturanKeAwal();
    setPesan({
      jenis: 'sukses',
      teks: 'Pengaturan pembacaan dan aturan nilai sudah dikembalikan ke nilai awal.',
    });
  };

  const handleCadangkan = async () => {
    setSedangProses(true);
    setPesan(null);
    try {
      const { namaFile } = await unduhFileCadangan();
      setPesan({
        jenis: 'sukses',
        teks: `File cadangan berhasil diunduh (${namaFile}). Simpan file ini di tempat aman.`,
      });
    } catch (err) {
      setPesan({
        jenis: 'galat',
        teks:
          err instanceof Error
            ? err.message
            : 'Gagal membuat file cadangan. Silakan coba lagi.',
      });
    } finally {
      setSedangProses(false);
    }
  };

  const handlePilihFilePulihkan = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset nilai input agar file yang sama bisa dipilih ulang jika perlu
    e.target.value = '';
    if (!file) return;

    setPesan(null);
    try {
      const teks = await file.text();
      const hasil = bacaDanValidasiCadangan(teks);
      setCalonPulih(hasil);
    } catch (err) {
      setPesan({
        jenis: 'galat',
        teks:
          err instanceof Error
            ? err.message
            : 'File cadangan tidak dapat dibaca.',
      });
    }
  };

  const handleKonfirmasiPulihkan = async () => {
    if (!calonPulih) return;
    const dataUntukPulih = calonPulih;
    setCalonPulih(null);
    setSedangProses(true);
    try {
      const hasil = await pulihkanDariCadangan(dataUntukPulih.cadangan);
      setPesan({
        jenis: 'sukses',
        teks: `Data berhasil dipulihkan: ${hasil.jumlahTemplate} template, ${hasil.jumlahUjian} ujian, dan ${hasil.jumlahHasilScan} hasil scan.`,
      });
    } catch (err) {
      setPesan({
        jenis: 'galat',
        teks:
          err instanceof Error
            ? err.message
            : 'Gagal memulihkan data dari file cadangan.',
      });
    } finally {
      setSedangProses(false);
    }
  };

  const handleHapusSemuaPermanen = async () => {
    setLangkahHapus(0);
    setKetikanHapus('');
    setSedangProses(true);
    try {
      await hapusSemuaData();
      setPesan({
        jenis: 'sukses',
        teks: 'Semua data template, ujian, hasil scan, dan pengaturan telah dihapus dari perangkat ini.',
      });
    } catch {
      setPesan({
        jenis: 'galat',
        teks: 'Gagal menghapus data. Silakan coba lagi.',
      });
    } finally {
      setSedangProses(false);
    }
  };

  const totalData =
    ringkasanData.jumlahTemplate +
    ringkasanData.jumlahUjian +
    ringkasanData.jumlahHasilScan;

  return (
    <div className="space-y-4">
      {pesan ? (
        <div
          role={pesan.jenis === 'galat' ? 'alert' : 'status'}
          aria-live={pesan.jenis === 'galat' ? 'assertive' : 'polite'}
          className={`flex items-start justify-between gap-3 rounded-2xl border px-4 py-3.5 text-sm font-medium ${
            pesan.jenis === 'galat'
              ? 'border-red-300 bg-red-50 text-red-950'
              : 'border-emerald-300 bg-emerald-50 text-emerald-950'
          }`}
        >
          <span>{pesan.teks}</span>
          <button
            type="button"
            onClick={() => setPesan(null)}
            className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-xl px-3 text-sm font-bold hover:bg-black/5"
          >
            Tutup
          </button>
        </div>
      ) : null}

      {/* Uji Mesin Pembaca LJK */}
      <section className="rounded-2xl border border-blue-200 bg-blue-50/70 p-5 shadow-xs space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-900 text-white">
            <ScanLine className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-slate-900">
              Uji Mesin Pembaca LJK
            </h2>
            <p className="mt-1 text-sm text-slate-700">
              Coba langsung pembacaan bulatan dengan contoh LJK bawaan atau uji
              meluruskan foto LJK sekolah Anda.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenUjiMesin}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-900 px-4 py-3 text-base font-bold text-white transition-colors hover:bg-blue-800 active:bg-blue-950"
        >
          <ScanLine className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>Buka Uji Mesin Pembaca</span>
        </button>
      </section>

      {/* Ringkasan Penyimpanan & Cadangan/Pulihkan */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-900">
            <HardDrive className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-slate-900">
              Data &amp; Cadangan
            </h2>
            <p className="mt-1 text-sm text-slate-700">
              Semua data tersimpan langsung di perangkat ini. Buat file cadangan
              secara berkala agar data aman jika ganti HP.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center">
          <div>
            <p className="text-xl font-bold text-slate-900">
              {ringkasanData.jumlahTemplate}
            </p>
            <p className="text-xs font-medium text-slate-700">Template</p>
          </div>
          <div>
            <p className="text-xl font-bold text-slate-900">
              {ringkasanData.jumlahUjian}
            </p>
            <p className="text-xs font-medium text-slate-700">Ujian</p>
          </div>
          <div>
            <p className="text-xl font-bold text-slate-900">
              {ringkasanData.jumlahHasilScan}
            </p>
            <p className="text-xs font-medium text-slate-700">Hasil Scan</p>
          </div>
        </div>

        <div className="space-y-2 text-xs text-slate-700">
          <p>
            <strong>Cadangan terakhir:</strong>{' '}
            {formatTanggalId(pengaturan.terakhirCadangan)}
          </p>
          {infoRuang ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span>
                  <strong>Ruang terpakai:</strong>{' '}
                  {formatUkuranByte(infoRuang.terpakai)}
                  {infoRuang.kuota > 0
                    ? ` dari ${formatUkuranByte(infoRuang.kuota)}`
                    : ''}
                </span>
                <span
                  className={`font-bold ${
                    infoRuang.hampirPenuh ? 'text-red-700' : 'text-slate-700'
                  }`}
                >
                  {infoRuang.persenTerpakai.toString().replace('.', ',')}%
                </span>
              </div>
              <div
                aria-hidden="true"
                className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200"
              >
                <div
                  className={`h-full rounded-full transition-all ${
                    infoRuang.hampirPenuh ? 'bg-red-600' : 'bg-blue-900'
                  }`}
                  style={{
                    width: `${Math.min(100, Math.max(2, infoRuang.persenTerpakai))}%`,
                  }}
                />
              </div>
            </div>
          ) : null}
        </div>

        {infoRuang?.hampirPenuh ? (
          <div
            role="alert"
            className="space-y-2.5 rounded-xl border-2 border-red-300 bg-red-50 p-3.5 text-sm text-red-950"
          >
            <div className="flex items-start gap-2.5">
              <AlertTriangle
                className="mt-0.5 h-5 w-5 shrink-0 text-red-700"
                aria-hidden="true"
              />
              <p className="font-medium">{infoRuang.pesanPeringatan}</p>
            </div>
            {pengaturan.simpanFotoScan ? (
              <button
                type="button"
                onClick={() => {
                  void handleUbahSimpanFoto(false);
                }}
                className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-red-700 px-3.5 py-2 text-sm font-bold text-white hover:bg-red-800"
              >
                Matikan Simpan Foto untuk Hemat Ruang
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-2.5 sm:grid-cols-2">
          <button
            type="button"
            disabled={sedangProses}
            onClick={() => {
              void handleCadangkan();
            }}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-900 px-4 py-3 text-base font-bold text-white transition-colors hover:bg-blue-800 active:bg-blue-950 disabled:opacity-50"
          >
            <Download className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>Cadangkan Data</span>
          </button>

          <button
            type="button"
            disabled={sedangProses}
            onClick={() => inputFileRef.current?.click()}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-blue-900 bg-white px-4 py-3 text-base font-bold text-blue-900 transition-colors hover:bg-blue-50 active:bg-blue-100 disabled:opacity-50"
          >
            <Upload className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>Pulihkan Data</span>
          </button>

          <input
            ref={inputFileRef}
            type="file"
            accept=".json,application/json"
            onChange={(e) => {
              void handlePilihFilePulihkan(e);
            }}
            className="sr-only"
            aria-label="Pilih file cadangan"
          />
        </div>
      </section>

      {/* Ambang Pembacaan Bulatan */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-900">
            <SlidersHorizontal className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-slate-900">
              Kepekaan Membaca Bulatan
            </h2>
            <p className="mt-1 text-sm text-slate-700">
              Nilai awal sudah cocok untuk kebanyakan LJK. Ubah hanya jika hasil
              pensil siswa sangat tipis atau kertas terlalu gelap.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="ambang-terisi"
                className="text-sm font-bold text-slate-900"
              >
                Batas bulatan dianggap terisi
              </label>
              <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-sm font-bold text-blue-900">
                {formatAngkaId(pengaturan.ambangTerisi)}
              </span>
            </div>
            <p id="hint-ambang-terisi" className="text-xs text-slate-600">
              Nilai awal 0,45. Lebih kecil berarti lebih peka pada arsiran pensil
              tipis.
            </p>
            <input
              id="ambang-terisi"
              type="range"
              min={Math.max(0.25, Number((pengaturan.ambangKosong + 0.05).toFixed(2)))}
              max={0.75}
              step={0.01}
              value={pengaturan.ambangTerisi}
              aria-describedby="hint-ambang-terisi"
              onChange={(e) => {
                void handleUbahAmbangTerisi(Number(e.target.value));
              }}
              className="h-12 w-full cursor-pointer"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="ambang-kosong"
                className="text-sm font-bold text-slate-900"
              >
                Batas bulatan dianggap kosong
              </label>
              <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-sm font-bold text-blue-900">
                {formatAngkaId(pengaturan.ambangKosong)}
              </span>
            </div>
            <p id="hint-ambang-kosong" className="text-xs text-slate-600">
              Nilai awal 0,20. Angka di antara batas kosong dan batas terisi
              akan ditandai kuning (ragu) supaya guru bisa memeriksa.
            </p>
            <input
              id="ambang-kosong"
              type="range"
              min={0.05}
              max={0.4}
              step={0.01}
              value={pengaturan.ambangKosong}
              aria-describedby="hint-ambang-kosong"
              onChange={(e) => {
                void handleUbahAmbangKosong(Number(e.target.value));
              }}
              className="h-12 w-full cursor-pointer"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="batas-ragu"
                className="text-sm font-bold text-slate-900"
              >
                Batas nomor ragu sebelum saran foto ulang
              </label>
              <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-sm font-bold text-blue-900">
                {pengaturan.batasRaguPersen}%
              </span>
            </div>
            <p id="hint-batas-ragu" className="text-xs text-slate-600">
              Nilai awal 20%. Jika nomor ragu melebihi batas ini, aplikasi akan
              menyarankan foto ulang.
            </p>
            <input
              id="batas-ragu"
              type="range"
              min={10}
              max={40}
              step={5}
              value={pengaturan.batasRaguPersen}
              aria-describedby="hint-batas-ragu"
              onChange={(e) => {
                void handleUbahBatasRagu(Number(e.target.value));
              }}
              className="h-12 w-full cursor-pointer"
            />
          </div>
        </div>
      </section>

      {/* Aturan Penilaian */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-900">
            <Calculator className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-slate-900">Aturan Nilai</h2>
            <p className="mt-1 text-sm text-slate-700">
              Jawaban ganda dan ragu ditandai kuning dan dihitung salah sampai
              Anda memeriksanya.
            </p>
          </div>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-bold text-slate-900">
            Skala nilai akhir
          </legend>
          <div className="grid grid-cols-2 gap-2.5">
            <label
              htmlFor="skala-100"
              className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl border-2 px-3.5 py-2.5 text-sm font-bold transition-colors ${
                pengaturan.skalaNilai === 100
                  ? 'border-blue-900 bg-blue-50 text-blue-950'
                  : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              <input
                id="skala-100"
                type="radio"
                name="skalaNilai"
                value={100}
                checked={pengaturan.skalaNilai === 100}
                onChange={() => {
                  void handleUbahSkala(100);
                }}
                className="h-5 w-5 shrink-0"
              />
              <span>0 sampai 100</span>
            </label>

            <label
              htmlFor="skala-10"
              className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl border-2 px-3.5 py-2.5 text-sm font-bold transition-colors ${
                pengaturan.skalaNilai === 10
                  ? 'border-blue-900 bg-blue-50 text-blue-950'
                  : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
              }`}
            >
              <input
                id="skala-10"
                type="radio"
                name="skalaNilai"
                value={10}
                checked={pengaturan.skalaNilai === 10}
                onChange={() => {
                  void handleUbahSkala(10);
                }}
                className="h-5 w-5 shrink-0"
              />
              <span>0 sampai 10</span>
            </label>
          </div>
        </fieldset>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="space-y-1">
            <label
              htmlFor="poin-benar"
              className="block text-xs font-bold text-slate-900"
            >
              Poin Benar
            </label>
            <input
              id="poin-benar"
              type="number"
              step="0.5"
              value={pengaturan.poinBenar}
              onChange={(e) => {
                void handleUbahPoin('poinBenar', e.target.value);
              }}
              className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-bold text-slate-900"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="poin-salah"
              className="block text-xs font-bold text-slate-900"
            >
              Poin Salah
            </label>
            <input
              id="poin-salah"
              type="number"
              step="0.5"
              value={pengaturan.poinSalah}
              onChange={(e) => {
                void handleUbahPoin('poinSalah', e.target.value);
              }}
              className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-bold text-slate-900"
            />
          </div>

          <div className="space-y-1">
            <label
              htmlFor="poin-kosong"
              className="block text-xs font-bold text-slate-900"
            >
              Poin Kosong
            </label>
            <input
              id="poin-kosong"
              type="number"
              step="0.5"
              value={pengaturan.poinKosong}
              onChange={(e) => {
                void handleUbahPoin('poinKosong', e.target.value);
              }}
              className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-bold text-slate-900"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            void handleResetPengaturan();
          }}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm font-bold text-slate-900 transition-colors hover:bg-slate-200 active:bg-slate-300"
        >
          <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Kembalikan ke Nilai Awal</span>
        </button>
      </section>

      {/* Simpan Foto Hasil Scan */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-900">
              <Image className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <label
                htmlFor="simpan-foto-scan"
                className="block cursor-pointer text-base font-bold text-slate-900"
              >
                Simpan foto hasil scan
              </label>
              <p className="mt-1 text-sm text-slate-700">
                {pengaturan.simpanFotoScan
                  ? 'Aktif. Foto LJK disimpan agar bisa dibuka ulang dari rekap nilai.'
                  : 'Nonaktif. Hanya angka dan jawaban yang disimpan untuk menghemat ruang HP.'}
              </p>
            </div>
          </div>

          <div className="flex min-h-12 min-w-14 shrink-0 items-center justify-center">
            <input
              id="simpan-foto-scan"
              type="checkbox"
              {...({ switch: '' } as Record<string, string>)}
              checked={pengaturan.simpanFotoScan}
              onChange={(e) => {
                void handleUbahSimpanFoto(e.target.checked);
              }}
              className="text-[26px]"
            />
          </div>
        </div>
      </section>

      {/* Pemasangan di Perangkat */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-900">
            <Smartphone className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-slate-900">
              Pemasangan di Perangkat
            </h2>
            <p className="mt-1 text-sm text-slate-700">
              {isInstalled
                ? 'Aplikasi sudah terpasang di perangkat ini.'
                : 'Aplikasi dapat dipasang ke layar utama HP agar mudah dibuka kapan saja tanpa internet.'}
            </p>
          </div>
        </div>

        {canInstall ? (
          <button
            type="button"
            onClick={onInstall}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-900 px-4 py-3 text-base font-bold text-white transition-colors hover:bg-blue-800 active:bg-blue-950"
          >
            <Download className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>Pasang ke Layar Utama</span>
          </button>
        ) : null}

        {isOffline ? (
          <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3.5 py-2.5 text-sm font-medium text-slate-900">
            <WifiOff
              className="h-5 w-5 shrink-0 text-slate-700"
              aria-hidden="true"
            />
            <span>Sedang tanpa internet — aplikasi berjalan penuh di perangkat.</span>
          </div>
        ) : offlineReady ? (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-900">
            <CheckCircle2
              className="h-5 w-5 shrink-0 text-emerald-700"
              aria-hidden="true"
            />
            <span>Siap dipakai tanpa internet.</span>
          </div>
        ) : null}

        {penyimpananPersisten === true ? (
          <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-3.5 py-2.5 text-xs font-medium text-blue-950">
            <ShieldCheck
              className="h-4 w-4 shrink-0 text-blue-800"
              aria-hidden="true"
            />
            <span>
              Penyimpanan perangkat terlindungi agar data tidak terhapus
              otomatis.
            </span>
          </div>
        ) : null}
      </section>

      {/* Privasi Data */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-slate-900">Privasi Data</h2>
            <p className="mt-1 text-sm text-slate-700">
              Semua data ujian, template, dan foto lembar jawaban disimpan
              langsung di perangkat ini dan tidak pernah dikirim ke server mana
              pun.
            </p>
          </div>
        </div>
      </section>

      {/* Hapus Semua Data (Konfirmasi Dua Langkah) */}
      <section className="rounded-2xl border border-red-200 bg-red-50/50 p-5 shadow-xs space-y-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-800">
            <AlertTriangle className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-red-950">
              Hapus Semua Data
            </h2>
            <p className="mt-1 text-sm text-red-900">
              Menghapus seluruh template, ujian, dan hasil koreksi dari
              perangkat ini. Pastikan Anda sudah mencadangkan data lebih dulu.
            </p>
          </div>
        </div>

        <button
          type="button"
          disabled={sedangProses}
          onClick={() => {
            setKetikanHapus('');
            setLangkahHapus(1);
          }}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-3 text-base font-bold text-white transition-colors hover:bg-red-800 active:bg-red-900 disabled:opacity-50"
        >
          <Trash2 className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>Hapus Semua Data</span>
        </button>
      </section>

      {/* Modal Konfirmasi Pulihkan Data */}
      <ConfirmDialog
        open={calonPulih !== null}
        title="Pulihkan Data dari File Cadangan?"
        description="Data yang saat ini tersimpan di perangkat ini akan diganti dengan isi file cadangan di bawah ini."
        confirmLabel="Pulihkan Sekarang"
        destructive
        onCancel={() => setCalonPulih(null)}
        onConfirm={() => {
          void handleKonfirmasiPulihkan();
        }}
      >
        {calonPulih ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-800 space-y-1">
            <p>
              <strong>Tanggal cadangan:</strong>{' '}
              {formatTanggalId(calonPulih.ringkasan.tanggalDibuat)}
            </p>
            <p>
              <strong>Isi cadangan:</strong>{' '}
              {calonPulih.ringkasan.jumlahTemplate} template,{' '}
              {calonPulih.ringkasan.jumlahUjian} ujian,{' '}
              {calonPulih.ringkasan.jumlahHasilScan} hasil scan.
            </p>
          </div>
        ) : null}
      </ConfirmDialog>

      {/* Modal Hapus Langkah 1 */}
      <ConfirmDialog
        open={langkahHapus === 1}
        title="Hapus Semua Data? (Langkah 1 dari 2)"
        description={
          totalData > 0
            ? `Anda akan menghapus ${ringkasanData.jumlahTemplate} template, ${ringkasanData.jumlahUjian} ujian, dan ${ringkasanData.jumlahHasilScan} hasil scan. Data yang terhapus tidak bisa dikembalikan tanpa file cadangan.`
            : 'Semua pengaturan akan dikembalikan ke awal dan seluruh penyimpanan akan dibersihkan.'
        }
        confirmLabel="Lanjutkan"
        destructive
        onCancel={() => setLangkahHapus(0)}
        onConfirm={() => {
          setKetikanHapus('');
          setLangkahHapus(2);
        }}
      />

      {/* Modal Hapus Langkah 2 */}
      <ConfirmDialog
        open={langkahHapus === 2}
        title="Konfirmasi Terakhir (Langkah 2 dari 2)"
        description="Untuk memastikan Anda benar-benar ingin menghapus semua data, ketik kata HAPUS di kotak bawah ini lalu tekan Hapus Permanen."
        confirmLabel="Hapus Permanen"
        destructive
        confirmDisabled={ketikanHapus.trim().toUpperCase() !== 'HAPUS'}
        onCancel={() => {
          setLangkahHapus(0);
          setKetikanHapus('');
        }}
        onConfirm={() => {
          void handleHapusSemuaPermanen();
        }}
      >
        <div className="space-y-1.5">
          <label
            htmlFor="konfirmasi-ketik-hapus"
            className="block text-sm font-bold text-slate-900"
          >
            Ketik HAPUS untuk melanjutkan
          </label>
          <input
            id="konfirmasi-ketik-hapus"
            type="text"
            value={ketikanHapus}
            onChange={(e) => setKetikanHapus(e.target.value)}
            placeholder="HAPUS"
            autoComplete="off"
            className="min-h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3.5 text-base font-bold uppercase tracking-wider text-slate-900"
          />
        </div>
      </ConfirmDialog>
    </div>
  );
}
