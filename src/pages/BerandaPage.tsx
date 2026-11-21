import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Camera,
  ClipboardList,
  Download,
  HardDrive,
  KeyRound,
  Plus,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import { unduhFileCadangan } from '../db/backup.ts';
import { ambilPengaturan, db } from '../db/database.ts';
import { hapusUjian } from '../db/ujians.ts';
import { PENGATURAN_AWAL, type Ujian } from '../types/ljk.ts';
import {
  evaluasiPengingatCadangan,
  type EvaluasiRuangPenyimpanan,
} from '../utils/kesehatanAplikasi.ts';

interface BerandaPageProps {
  onNewExam: () => void;
  onScanExam: (ujian: Ujian) => void;
  onOpenRekap: (ujian: Ujian) => void;
  onEditExam: (ujian: Ujian) => void;
  onOpenPengaturan: () => void;
  canInstall: boolean;
  onInstall: () => void;
  infoRuang?: EvaluasiRuangPenyimpanan | null;
  pesanBanner?: string | null;
  onTutupBanner?: () => void;
}

export function BerandaPage({
  onNewExam,
  onScanExam,
  onOpenRekap,
  onEditExam,
  onOpenPengaturan,
  canInstall,
  onInstall,
  infoRuang,
  pesanBanner,
  onTutupBanner,
}: BerandaPageProps) {
  const pengaturan =
    useLiveQuery(() => ambilPengaturan(), []) ?? PENGATURAN_AWAL;

  const daftarUjian = useLiveQuery(async () => {
    const ujians = await db.ujians.orderBy('tanggalDibuat').reverse().toArray();
    const denganJumlah = await Promise.all(
      ujians.map(async (ujian) => {
        const jumlahScan = await db.hasilScans
          .where('idUjian')
          .equals(ujian.id)
          .count();
        return { ujian, jumlahScan };
      }),
    );
    return denganJumlah;
  }, []);

  const [pesanLokal, setPesanLokal] = useState<string | null>(null);
  const [galatLokal, setGalatLokal] = useState<string | null>(null);
  const [sedangCadangkan, setSedangCadangkan] = useState(false);
  const [pengingatDitutup, setPengingatDitutup] = useState(false);
  const [calonHapus, setCalonHapus] = useState<{
    ujian: Ujian;
    jumlahScan: number;
  } | null>(null);

  const pesanAktif = pesanLokal ?? pesanBanner ?? null;

  const totalUjian = daftarUjian?.length ?? 0;
  const totalHasilScan =
    daftarUjian?.reduce((sum, item) => sum + item.jumlahScan, 0) ?? 0;

  const pengingatCadangan = evaluasiPengingatCadangan({
    jumlahUjian: totalUjian,
    jumlahHasilScan: totalHasilScan,
    terakhirCadangan: pengaturan.terakhirCadangan,
  });

  const handleCadangkanCepat = async () => {
    setSedangCadangkan(true);
    setGalatLokal(null);
    try {
      const { namaFile } = await unduhFileCadangan();
      setPesanLokal(
        `File cadangan berhasil diunduh (${namaFile}). Simpan di tempat aman.`,
      );
    } catch (err) {
      setGalatLokal(
        err instanceof Error
          ? err.message
          : 'Gagal membuat file cadangan. Silakan coba lewat halaman Pengaturan.',
      );
    } finally {
      setSedangCadangkan(false);
    }
  };

  const handleKonfirmasiHapus = async () => {
    if (!calonHapus) return;
    const target = calonHapus;
    setCalonHapus(null);
    await hapusUjian(target.ujian.id);
    setPesanLokal(`Ujian "${target.ujian.nama}" telah dihapus.`);
  };

  return (
    <div className="space-y-5">
      {pesanAktif ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950"
        >
          <span>{pesanAktif}</span>
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

      {galatLokal ? (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm font-medium text-red-950"
        >
          <span>{galatLokal}</span>
          <button
            type="button"
            onClick={() => setGalatLokal(null)}
            className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-xl px-2.5 text-sm font-bold text-red-900 hover:bg-red-100"
          >
            Tutup
          </button>
        </div>
      ) : null}

      {/* Peringatan Ruang Penyimpanan Hampir Penuh */}
      {infoRuang?.hampirPenuh ? (
        <section
          role="alert"
          className="rounded-2xl border-2 border-red-300 bg-red-50 p-4 shadow-xs space-y-3"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-6 w-6 shrink-0 text-red-700"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-red-950">
                Ruang Penyimpanan Hampir Penuh ({infoRuang.persenTerpakai}%)
              </h2>
              <p className="mt-1 text-sm text-red-900">
                {infoRuang.pesanPeringatan}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenPengaturan}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-700 px-4 py-3 text-sm font-bold text-white hover:bg-red-800"
          >
            <HardDrive className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>Atur Penyimpanan &amp; Cadangkan</span>
          </button>
        </section>
      ) : null}

      {/* Pengingat Cadangan Data Berkala */}
      {pengingatCadangan.perluPengingat && !pengingatDitutup ? (
        <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 shadow-xs space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-200 text-amber-900">
              <Bell className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-base font-bold text-amber-950">
                {pengingatCadangan.judul}
              </h2>
              <p className="mt-1 text-sm text-amber-900">
                {pengingatCadangan.pesan}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={sedangCadangkan}
              onClick={() => {
                void handleCadangkanCepat();
              }}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-800 disabled:opacity-50"
            >
              <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {sedangCadangkan ? 'Menyiapkan...' : 'Cadangkan Sekarang'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setPengingatDitutup(true)}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-bold text-amber-950 hover:bg-amber-100"
            >
              Ingatkan Nanti
            </button>
          </div>
        </section>
      ) : null}

      {canInstall ? (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 shadow-xs">
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="text-base font-bold text-blue-950">
                Pasang di Layar Utama HP
              </h2>
              <p className="mt-1 text-sm text-blue-900">
                Pasang aplikasi ini supaya lebih cepat dibuka dan bisa dipakai
                tanpa internet.
              </p>
            </div>
            <button
              type="button"
              onClick={onInstall}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-900 px-4 py-3 text-base font-bold text-white transition-colors hover:bg-blue-800 active:bg-blue-950"
            >
              <Download className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>Pasang Aplikasi</span>
            </button>
          </div>
        </section>
      ) : null}

      <button
        type="button"
        onClick={onNewExam}
        className="flex min-h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-blue-900 px-5 py-4 text-lg font-bold text-white shadow-sm transition-colors hover:bg-blue-800 active:bg-blue-950"
      >
        <Plus className="h-6 w-6 shrink-0" strokeWidth={2.5} aria-hidden="true" />
        <span>Ujian Baru</span>
      </button>

      <section className="space-y-3">
        <h2 className="text-base font-bold text-slate-800">Ujian Terbaru</h2>

        {!daftarUjian || daftarUjian.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
              <ClipboardList className="h-7 w-7" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Belum ada ujian</h3>
            <p className="mt-2 text-sm text-slate-700">
              Daftar ujian, kelas, dan jumlah LJK yang sudah dikoreksi akan
              tampil di sini. Tekan tombol <strong>Ujian Baru</strong> di atas
              untuk memulai.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {daftarUjian.map(({ ujian, jumlahScan }) => (
              <li
                key={ujian.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-slate-900">
                      {ujian.nama}
                    </h3>
                    <p className="mt-0.5 text-sm text-slate-700">
                      Kelas {ujian.kelas} &middot; {ujian.kunciJawaban.length}{' '}
                      soal
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      Template: {ujian.salinanTemplate.nama}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-xl bg-blue-50 px-3 py-1.5 text-sm font-bold text-blue-900">
                    {jumlahScan} LJK
                  </span>
                </div>

                <div className="space-y-2 border-t border-slate-100 pt-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onScanExam(ujian)}
                      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-900 px-3 py-3 text-sm font-bold text-white transition-colors hover:bg-blue-800 active:bg-blue-950"
                    >
                      <Camera className="h-5 w-5 shrink-0" aria-hidden="true" />
                      <span>Scan LJK</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenRekap(ujian)}
                      className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 py-3 text-sm font-bold text-white transition-colors hover:bg-emerald-800 active:bg-emerald-900"
                    >
                      <BarChart3
                        className="h-5 w-5 shrink-0"
                        aria-hidden="true"
                      />
                      <span>Rekap &amp; Excel</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => onEditExam(ujian)}
                      aria-label={`Ubah kunci dan info ujian ${ujian.nama}`}
                      className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900 hover:bg-slate-100"
                    >
                      <KeyRound
                        className="h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                      <span>Ubah Kunci</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCalonHapus({ ujian, jumlahScan })}
                      aria-label={`Hapus ujian ${ujian.nama}`}
                      className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-bold text-red-800 hover:bg-red-100"
                    >
                      <Trash2
                        className="h-4 w-4 shrink-0"
                        aria-hidden="true"
                      />
                      <span>Hapus</span>
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={calonHapus !== null}
        title="Hapus Ujian Ini?"
        description={
          calonHapus
            ? calonHapus.jumlahScan > 0
              ? `Ujian "${calonHapus.ujian.nama}" beserta ${calonHapus.jumlahScan} hasil scan siswa di dalamnya akan dihapus permanen.`
              : `Ujian "${calonHapus.ujian.nama}" beserta kunci jawabannya akan dihapus dari perangkat ini.`
            : ''
        }
        confirmLabel="Hapus Ujian"
        destructive
        onCancel={() => setCalonHapus(null)}
        onConfirm={() => {
          void handleKonfirmasiHapus();
        }}
      />
    </div>
  );
}
