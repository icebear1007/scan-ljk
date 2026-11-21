import { useLiveQuery } from 'dexie-react-hooks';
import {
  Camera,
  ChevronRight,
  FileSpreadsheet,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import { db } from '../db/database.ts';
import { hapusHasilScan } from '../db/hasilScans.ts';
import type { HasilScan, Ujian } from '../types/ljk.ts';
import {
  ambilDaftarKelasUnik,
  hitungStatistikRekap,
  saringDanUrutkanHasil,
  unduhRekapExcel,
} from '../utils/rekapExcel.ts';

interface RekapUjianPageProps {
  ujian: Ujian;
  pesanBanner?: string | null;
  onTutupBanner?: () => void;
  onScanBaru: () => void;
  onBukaHasil: (hasil: HasilScan) => void;
}

function formatAngkaRata(nilai: number | null): string {
  if (nilai === null) return '—';
  return Number.isInteger(nilai)
    ? String(nilai)
    : nilai.toFixed(1).replace('.', ',');
}

export function RekapUjianPage({
  ujian,
  pesanBanner,
  onTutupBanner,
  onScanBaru,
  onBukaHasil,
}: RekapUjianPageProps) {
  const semuaHasil =
    useLiveQuery(
      () => db.hasilScans.where('idUjian').equals(ujian.id).toArray(),
      [ujian.id],
    ) ?? [];

  const [filterKelas, setFilterKelas] = useState<string>('SEMUA');
  const [kataKunci, setKataKunci] = useState('');
  const [sedangEkspor, setSedangEkspor] = useState(false);
  const [pesanLokal, setPesanLokal] = useState<{
    jenis: 'sukses' | 'galat';
    teks: string;
  } | null>(null);
  const [calonHapus, setCalonHapus] = useState<HasilScan | null>(null);

  const captionId = useId();

  const daftarKelas = useMemo(
    () => ambilDaftarKelasUnik(semuaHasil),
    [semuaHasil],
  );

  // Jika kelas yang dipilih sudah tidak ada (misalnya baru dihapus), reset ke SEMUA
  const filterKelasAktif =
    filterKelas !== 'SEMUA' && !daftarKelas.includes(filterKelas)
      ? 'SEMUA'
      : filterKelas;

  const hasilTampil = useMemo(
    () => saringDanUrutkanHasil(semuaHasil, filterKelasAktif, kataKunci),
    [semuaHasil, filterKelasAktif, kataKunci],
  );

  const statistik = useMemo(
    () => hitungStatistikRekap(hasilTampil),
    [hasilTampil],
  );

  const handleEksporExcel = async () => {
    if (semuaHasil.length === 0) return;
    setSedangEkspor(true);
    setPesanLokal(null);
    try {
      const namaFile = await unduhRekapExcel(ujian, semuaHasil);
      setPesanLokal({
        jenis: 'sukses',
        teks: `File Excel berhasil diunduh (${namaFile}) berisi ${semuaHasil.length} siswa dalam 2 lembar: Rekap dan Jawaban.`,
      });
    } catch (err) {
      setPesanLokal({
        jenis: 'galat',
        teks:
          err instanceof Error
            ? err.message
            : 'Gagal mengekspor file Excel. Silakan coba lagi.',
      });
    } finally {
      setSedangEkspor(false);
    }
  };

  const handleKonfirmasiHapus = async () => {
    if (!calonHapus) return;
    const target = calonHapus;
    setCalonHapus(null);
    await hapusHasilScan(target.id);
    setPesanLokal({
      jenis: 'sukses',
      teks: `Hasil "${target.identitasSiswa || 'Siswa tanpa nama'}" telah dihapus.`,
    });
  };

  const teksBannerSukses =
    pesanLokal?.jenis === 'sukses'
      ? pesanLokal.teks
      : !pesanLokal && pesanBanner
        ? pesanBanner
        : null;

  return (
    <div className="space-y-4">
      {teksBannerSukses ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950"
        >
          <span>{teksBannerSukses}</span>
          <button
            type="button"
            onClick={() => {
              setPesanLokal(null);
              onTutupBanner?.();
            }}
            className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-xl px-2.5 text-sm font-bold text-emerald-900 hover:bg-emerald-100"
          >
            Tutup
          </button>
        </div>
      ) : null}

      {pesanLokal?.jenis === 'galat' ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-950"
        >
          <span>{pesanLokal.teks}</span>
          <button
            type="button"
            onClick={() => setPesanLokal(null)}
            className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-xl px-2.5 text-sm font-bold text-red-900 hover:bg-red-100"
          >
            Tutup
          </button>
        </div>
      ) : null}

      {/* Info Ujian & Tombol Utama (Ekspor Excel + Tambah Scan) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">{ujian.nama}</h2>
          <p className="mt-0.5 text-xs text-slate-700">
            {ujian.kunciJawaban.length} soal &middot; Template:{' '}
            {ujian.salinanTemplate.nama}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <button
            type="button"
            disabled={semuaHasil.length === 0 || sedangEkspor}
            onClick={() => {
              void handleEksporExcel();
            }}
            className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3 text-base font-bold text-white shadow-sm transition-colors hover:bg-emerald-800 active:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <FileSpreadsheet className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>{sedangEkspor ? 'Menyiapkan Excel...' : 'Ekspor Excel (.xlsx)'}</span>
          </button>

          <button
            type="button"
            onClick={onScanBaru}
            className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-900 px-4 py-3 text-base font-bold text-white shadow-sm transition-colors hover:bg-blue-800 active:bg-blue-950"
          >
            <Camera className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>Scan LJK Baru</span>
          </button>
        </div>

        {semuaHasil.length > 0 && filterKelasAktif !== 'SEMUA' ? (
          <p className="text-xs text-slate-600">
            Ekspor Excel mengunduh seluruh {semuaHasil.length} siswa pada ujian
            ini (terurut rapi per kelas) dalam 1 file.
          </p>
        ) : null}
      </section>

      {/* Statistik Sederhana */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-slate-900">
            Statistik{' '}
            {filterKelasAktif === 'SEMUA'
              ? 'Semua Kelas'
              : `Kelas ${filterKelasAktif}`}
          </h3>
          {statistik.jumlahPerluDicek > 0 ? (
            <span className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-950">
              {statistik.jumlahPerluDicek} lembar perlu dicek
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="rounded-xl bg-blue-50 p-2.5">
            <p className="text-xl font-extrabold text-blue-950">
              {statistik.jumlahSiswa}
            </p>
            <p className="text-[11px] font-bold text-blue-900">Dikoreksi</p>
          </div>
          <div className="rounded-xl bg-slate-100 p-2.5">
            <p className="text-xl font-extrabold text-slate-900">
              {formatAngkaRata(statistik.rataRata)}
            </p>
            <p className="text-[11px] font-bold text-slate-700">Rata-rata</p>
          </div>
          <div className="rounded-xl bg-emerald-50 p-2.5">
            <p className="text-xl font-extrabold text-emerald-800">
              {statistik.tertinggi ?? '—'}
            </p>
            <p className="text-[11px] font-bold text-emerald-950">Tertinggi</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-2.5">
            <p className="text-xl font-extrabold text-amber-800">
              {statistik.terendah ?? '—'}
            </p>
            <p className="text-[11px] font-bold text-amber-950">Terendah</p>
          </div>
        </div>
      </section>

      {/* Filter Kelas & Pencarian */}
      {semuaHasil.length > 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
          {daftarKelas.length > 1 ? (
            daftarKelas.length <= 5 ? (
              <div className="space-y-1.5">
                <p className="text-xs font-bold text-slate-800">
                  Filter per kelas
                </p>
                <div
                  className="flex flex-wrap gap-1.5"
                  role="group"
                  aria-label="Filter berdasarkan kelas"
                >
                  <button
                    type="button"
                    aria-pressed={filterKelasAktif === 'SEMUA'}
                    onClick={() => setFilterKelas('SEMUA')}
                    className={`min-h-12 rounded-xl border-2 px-3.5 py-2 text-sm font-bold transition-colors ${
                      filterKelasAktif === 'SEMUA'
                        ? 'border-blue-900 bg-blue-900 text-white'
                        : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    Semua ({semuaHasil.length})
                  </button>
                  {daftarKelas.map((kls) => (
                    <button
                      key={kls}
                      type="button"
                      aria-pressed={filterKelasAktif === kls}
                      onClick={() => setFilterKelas(kls)}
                      className={`min-h-12 rounded-xl border-2 px-3.5 py-2 text-sm font-bold transition-colors ${
                        filterKelasAktif === kls
                          ? 'border-blue-900 bg-blue-900 text-white'
                          : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      {kls}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <label
                  htmlFor="filter-kelas-select"
                  className="block text-sm font-bold text-slate-900"
                >
                  Filter per kelas ({daftarKelas.length} kelas)
                </label>
                <select
                  id="filter-kelas-select"
                  value={filterKelasAktif}
                  onChange={(e) => setFilterKelas(e.target.value)}
                  className="min-h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3.5 text-base font-bold text-slate-900"
                >
                  <option value="SEMUA">
                    Semua Kelas ({semuaHasil.length} siswa)
                  </option>
                  {daftarKelas.map((kls) => (
                    <option key={kls} value={kls}>
                      Kelas {kls}
                    </option>
                  ))}
                </select>
              </div>
            )
          ) : null}

          <search>
            <div className="space-y-1">
              <label
                htmlFor="cari-siswa"
                className="block text-xs font-bold text-slate-800"
              >
                Cari nama atau nomor absen siswa
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500"
                  aria-hidden="true"
                />
                <input
                  id="cari-siswa"
                  type="search"
                  value={kataKunci}
                  onChange={(e) => setKataKunci(e.target.value)}
                  placeholder="Ketik nama atau nomor absen..."
                  className="min-h-12 w-full rounded-xl border-2 border-slate-300 bg-white pl-11 pr-3.5 text-base font-medium text-slate-900"
                />
              </div>
            </div>
          </search>
        </section>
      ) : null}

      {/* Daftar Hasil Per Siswa (Responsive Table) */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-bold text-slate-900">
            Daftar Nilai Siswa ({hasilTampil.length})
          </h3>
          {hasilTampil.length > 0 ? (
            <p className="text-xs text-slate-600">
              Ketuk siswa untuk melihat foto &amp; koreksi lagi.
            </p>
          ) : null}
        </div>

        {semuaHasil.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs space-y-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
              <Users className="h-7 w-7" aria-hidden="true" />
            </div>
            <h4 className="text-base font-bold text-slate-900">
              Belum ada LJK yang dikoreksi
            </h4>
            <p className="text-sm text-slate-700">
              Tekan tombol <strong>Scan LJK Baru</strong> di atas untuk mulai
              mengoreksi lembar jawaban siswa.
            </p>
          </div>
        ) : hasilTampil.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-700 shadow-xs">
            Tidak ada siswa yang cocok dengan filter atau pencarian saat ini.
          </div>
        ) : (
          <div
            tabIndex={0}
            role="region"
            aria-labelledby={captionId}
            className="rekap-table-wrapper rounded-2xl border border-slate-200 bg-white shadow-xs"
          >
            <table className="rekap-table text-sm">
              <caption id={captionId} className="visually-hidden">
                Rekap nilai siswa untuk {ujian.nama}
              </caption>
              <thead className="bg-slate-100 text-left text-xs font-bold uppercase text-slate-700">
                <tr>
                  <th scope="col" className="px-3 py-3 border-b border-slate-200">
                    Nama / No. Absen
                  </th>
                  <th scope="col" className="px-2.5 py-3 border-b border-slate-200">
                    Kelas
                  </th>
                  <th scope="col" className="px-2 py-3 border-b border-slate-200 text-center">
                    Benar
                  </th>
                  <th scope="col" className="px-2 py-3 border-b border-slate-200 text-center">
                    Salah
                  </th>
                  <th scope="col" className="px-2 py-3 border-b border-slate-200 text-center">
                    Kosong
                  </th>
                  <th scope="col" className="px-2.5 py-3 border-b border-slate-200 text-center">
                    Nilai
                  </th>
                  <th scope="col" className="px-2.5 py-3 border-b border-slate-200 text-right">
                    Tindakan
                  </th>
                </tr>
              </thead>
              <tbody>
                {hasilTampil.map((item) => {
                  const namaTampil = item.identitasSiswa.trim();
                  return (
                    <tr
                      key={item.id}
                      className="border-b border-slate-100 hover:bg-blue-50/40"
                    >
                      <th scope="row" className="px-3 py-2.5 font-bold text-slate-900">
                        <button
                          type="button"
                          onClick={() => onBukaHasil(item)}
                          className="flex min-h-12 w-full items-center justify-between gap-2 text-left"
                        >
                          <div className="min-w-0">
                            <span
                              className={`block ${
                                namaTampil ? 'text-slate-900' : 'italic text-amber-900'
                              }`}
                            >
                              {namaTampil || 'Belum diisi (ketuk untuk isi)'}
                            </span>
                            {item.perluDicek > 0 ? (
                              <span className="mt-0.5 inline-block rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-950">
                                ? {item.perluDicek} perlu dicek
                              </span>
                            ) : null}
                          </div>
                          <ChevronRight
                            className="h-5 w-5 shrink-0 text-slate-400"
                            aria-hidden="true"
                          />
                        </button>
                      </th>
                      <td className="px-2.5 py-2.5 font-semibold text-slate-800">
                        {item.kelas || '—'}
                      </td>
                      <td className="px-2 py-2.5 text-center font-bold text-emerald-800">
                        {item.benar}
                      </td>
                      <td className="px-2 py-2.5 text-center font-bold text-red-700">
                        {item.salah}
                      </td>
                      <td className="px-2 py-2.5 text-center font-bold text-slate-700">
                        {item.kosong}
                      </td>
                      <td className="px-2.5 py-2.5 text-center">
                        <span className="inline-block rounded-lg bg-blue-50 px-2.5 py-1 text-base font-extrabold text-blue-900">
                          {item.nilai}
                        </span>
                      </td>
                      <td className="px-2.5 py-2.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onBukaHasil(item)}
                            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-950 hover:bg-blue-100"
                          >
                            Buka
                          </button>
                          <button
                            type="button"
                            aria-label={`Hapus hasil ${namaTampil || 'siswa tanpa nama'}`}
                            onClick={() => setCalonHapus(item)}
                            className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-800 hover:bg-red-100"
                          >
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={calonHapus !== null}
        title="Hapus Hasil Siswa Ini?"
        description={
          calonHapus
            ? `Hasil scan milik "${calonHapus.identitasSiswa || 'Siswa tanpa nama'}" (Nilai ${calonHapus.nilai}) akan dihapus dari rekap ujian ini.`
            : ''
        }
        confirmLabel="Hapus Hasil"
        destructive
        onCancel={() => setCalonHapus(null)}
        onConfirm={() => {
          void handleKonfirmasiHapus();
        }}
      />
    </div>
  );
}
