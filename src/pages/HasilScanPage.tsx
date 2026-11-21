import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Pencil,
  RotateCcw,
  Save,
  User,
} from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { FotoHasilOverlay } from '../components/scan/FotoHasilOverlay.tsx';
import { KoreksiNomorDialog } from '../components/scan/KoreksiNomorDialog.tsx';
import { ambilPengaturan } from '../db/database.ts';
import {
  cariDuplikatSiswa,
  hitungUlangHasilDariKoreksi,
  perbaruiHasilScan,
  simpanHasilScanBaru,
  timpaHasilScan,
} from '../db/hasilScans.ts';
import type { HasilBacaLJK, StatusBulatan } from '../omr/types.ts';
import {
  PENGATURAN_AWAL,
  type HasilScan,
  type StatusJawaban,
  type Ujian,
} from '../types/ljk.ts';

interface HasilScanPageProps {
  ujian: Ujian;
  /** Diisi saat baru selesai scan dari Layar 5 */
  hasilBacaBaru?: HasilBacaLJK | null;
  fotoLurusBlobBaru?: Blob;
  /** Diisi saat membuka kembali hasil tersimpan untuk dikoreksi lagi */
  hasilTersimpan?: HasilScan | null;
  onFotoUlang?: () => void;
  onSimpanDanLanjutScan?: (pesan: string) => void;
  onSimpanDanSelesai: (pesan: string) => void;
}

type AksiSesudahSimpan = 'lanjut-scan' | 'selesai';

function labelStatus(status: StatusJawaban): string {
  switch (status) {
    case 'benar':
      return 'Benar';
    case 'salah':
      return 'Salah';
    case 'kosong':
      return 'Kosong';
    case 'ganda':
      return 'Ganda';
    case 'ragu':
      return 'Ragu';
  }
}

export function HasilScanPage({
  ujian,
  hasilBacaBaru,
  fotoLurusBlobBaru,
  hasilTersimpan,
  onFotoUlang,
  onSimpanDanLanjutScan,
  onSimpanDanSelesai,
}: HasilScanPageProps) {
  const modeEditLama = Boolean(hasilTersimpan);
  const pengaturan =
    useLiveQuery(() => ambilPengaturan(), []) ?? PENGATURAN_AWAL;

  const jawabanTerbacaAwal = useMemo<string[]>(() => {
    if (hasilTersimpan) return hasilTersimpan.jawabanTerbaca;
    if (hasilBacaBaru) return hasilBacaBaru.jawabanTerbaca;
    return Array(ujian.kunciJawaban.length).fill('');
  }, [hasilTersimpan, hasilBacaBaru, ujian.kunciJawaban.length]);

  const statusMentahAwal = useMemo<
    Array<'terjawab' | 'kosong' | 'ganda' | 'ragu' | StatusJawaban>
  >(() => {
    if (hasilTersimpan) return hasilTersimpan.statusPerNomor;
    if (hasilBacaBaru) {
      return hasilBacaBaru.hasilPerNomor.map((h) => h.statusMentah);
    }
    return Array(ujian.kunciJawaban.length).fill('kosong');
  }, [hasilTersimpan, hasilBacaBaru, ujian.kunciJawaban.length]);

  const statusBulatanMentah = useMemo<
    Array<Record<string, StatusBulatan>> | undefined
  >(() => {
    if (!hasilBacaBaru) return undefined;
    return hasilBacaBaru.hasilPerNomor.map((item) => {
      const peta: Record<string, StatusBulatan> = {};
      for (const b of item.bulatan) {
        peta[b.label] = b.status;
      }
      return peta;
    });
  }, [hasilBacaBaru]);

  const [jawabanSetelahKoreksi, setJawabanSetelahKoreksi] = useState<string[]>(
    () =>
      hasilTersimpan
        ? [...hasilTersimpan.jawabanSetelahKoreksi]
        : [...jawabanTerbacaAwal],
  );

  const [nomorDikoreksi, setNomorDikoreksi] = useState<Set<number>>(() => {
    const awal = new Set<number>();
    if (hasilTersimpan) {
      for (let i = 0; i < hasilTersimpan.jawabanSetelahKoreksi.length; i++) {
        if (
          hasilTersimpan.jawabanSetelahKoreksi[i] !==
          hasilTersimpan.jawabanTerbaca[i]
        ) {
          awal.add(i + 1);
        }
      }
    }
    return awal;
  });

  const identitasOtomatis = (() => {
    if (hasilTersimpan) return hasilTersimpan.identitasSiswa;
    const terbaca = hasilBacaBaru?.identitas?.nilaiTerbaca ?? '';
    return terbaca && !terbaca.includes('?') ? terbaca : '';
  })();

  const [identitasSiswa, setIdentitasSiswa] = useState(identitasOtomatis);
  const [kelasSiswa, setKelasSiswa] = useState(
    hasilTersimpan?.kelas ?? ujian.kelas,
  );

  const [nomorSorot, setNomorSorot] = useState<number | null>(null);
  const [nomorKoreksiAktif, setNomorKoreksiAktif] = useState<number | null>(
    null,
  );
  const [sedangSimpan, setSedangSimpan] = useState(false);
  const [galatSimpan, setGalatSimpan] = useState<string | null>(null);

  // Dialog deteksi siswa ganda (di-scan dua kali)
  const [duplikatDitemukan, setDuplikatDitemukan] = useState<{
    dataLama: HasilScan;
    aksiSetelah: AksiSesudahSimpan;
  } | null>(null);
  const dialogDuplikatRef = useRef<HTMLDialogElement>(null);
  const judulDuplikatId = useId();
  const deskDuplikatId = useId();

  useEffect(() => {
    const dialog = dialogDuplikatRef.current;
    if (!dialog) return;
    if (duplikatDitemukan && !dialog.open) {
      dialog.showModal();
    } else if (!duplikatDitemukan && dialog.open) {
      dialog.close();
    }
  }, [duplikatDitemukan]);

  // URL pratinjau foto lurus (dengan pembersihan aman)
  const blobFotoAktif = hasilTersimpan?.fotoLurus ?? fotoLurusBlobBaru;
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blobFotoAktif) {
      setFotoUrl(null);
      return;
    }
    const url = URL.createObjectURL(blobFotoAktif);
    setFotoUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [blobFotoAktif]);

  // Hitung ulang nilai & status seketika setiap kali jawaban berubah atau pengaturan berubah
  const ringkasan = useMemo(
    () =>
      hitungUlangHasilDariKoreksi(
        jawabanSetelahKoreksi,
        ujian.kunciJawaban,
        statusMentahAwal,
        nomorDikoreksi,
        pengaturan,
      ),
    [
      jawabanSetelahKoreksi,
      ujian.kunciJawaban,
      statusMentahAwal,
      nomorDikoreksi,
      pengaturan,
    ],
  );

  const daftarPerluDicek = useMemo(() => {
    const daftar: Array<{ nomor: number; status: StatusJawaban }> = [];
    for (let i = 0; i < ringkasan.statusPerNomor.length; i++) {
      const st = ringkasan.statusPerNomor[i];
      if (st === 'kosong' || st === 'ganda' || st === 'ragu') {
        daftar.push({ nomor: i + 1, status: st });
      }
    }
    return daftar;
  }, [ringkasan.statusPerNomor]);

  const peringatanKualitas = hasilBacaBaru?.peringatan ?? [];

  const handleKoreksiManual = (nomor: number, jawabanBaru: string) => {
    setJawabanSetelahKoreksi((prev) => {
      const salinan = [...prev];
      salinan[nomor - 1] = jawabanBaru;
      return salinan;
    });
    setNomorDikoreksi((prev) => {
      const baru = new Set(prev);
      baru.add(nomor);
      return baru;
    });
    setNomorKoreksiAktif(null);
    setNomorSorot(nomor);
  };

  const eksekusiSimpan = async (
    aksiSetelah: AksiSesudahSimpan,
    idTimpa?: string,
  ) => {
    setSedangSimpan(true);
    setGalatSimpan(null);

    try {
      const payload = {
        idUjian: ujian.id,
        kelas: kelasSiswa || ujian.kelas,
        identitasSiswa,
        jawabanTerbaca: jawabanTerbacaAwal,
        jawabanSetelahKoreksi,
        statusPerNomor: ringkasan.statusPerNomor,
        benar: ringkasan.benar,
        salah: ringkasan.salah,
        kosong: ringkasan.kosong,
        perluDicek: ringkasan.perluDicek,
        nilai: ringkasan.nilai,
        fotoLurus: blobFotoAktif,
        simpanFotoScan: pengaturan.simpanFotoScan,
      };

      const labelSiswa = identitasSiswa.trim() || 'Siswa tanpa nama';

      if (modeEditLama && hasilTersimpan) {
        await perbaruiHasilScan(hasilTersimpan.id, {
          kelas: payload.kelas,
          identitasSiswa: payload.identitasSiswa,
          jawabanSetelahKoreksi: payload.jawabanSetelahKoreksi,
          statusPerNomor: payload.statusPerNomor,
          benar: payload.benar,
          salah: payload.salah,
          kosong: payload.kosong,
          perluDicek: payload.perluDicek,
          nilai: payload.nilai,
        });
        onSimpanDanSelesai(
          `Perubahan hasil "${labelSiswa}" (Nilai ${ringkasan.nilai}) berhasil disimpan.`,
        );
        return;
      }

      if (idTimpa) {
        await timpaHasilScan(idTimpa, payload);
      } else {
        await simpanHasilScanBaru(payload);
      }

      const pesan = idTimpa
        ? `Hasil "${labelSiswa}" (Nilai ${ringkasan.nilai}) berhasil menimpa data lama.`
        : `Hasil "${labelSiswa}" (Nilai ${ringkasan.nilai}) tersimpan.`;

      if (aksiSetelah === 'lanjut-scan' && onSimpanDanLanjutScan) {
        onSimpanDanLanjutScan(`${pesan} Siap scan berikutnya.`);
      } else {
        onSimpanDanSelesai(pesan);
      }
    } catch (err) {
      setGalatSimpan(
        err instanceof Error
          ? err.message
          : 'Gagal menyimpan hasil scan. Coba lagi.',
      );
    } finally {
      setSedangSimpan(false);
    }
  };

  const handleKlikSimpan = async (aksiSetelah: AksiSesudahSimpan) => {
    if (modeEditLama) {
      await eksekusiSimpan(aksiSetelah);
      return;
    }

    // PRD Bagian 12: Cek apakah siswa yang sama di-scan dua kali
    const duplikat = await cariDuplikatSiswa(ujian.id, identitasSiswa);
    if (duplikat) {
      setDuplikatDitemukan({ dataLama: duplikat, aksiSetelah });
      return;
    }

    await eksekusiSimpan(aksiSetelah);
  };

  const handleTutupDialogDuplikat = () => {
    const dialog = dialogDuplikatRef.current;
    if (!dialog || !duplikatDitemukan) return;
    const pilihan = dialog.returnValue;
    dialog.returnValue = '';

    const konteks = duplikatDitemukan;
    setDuplikatDitemukan(null);

    if (pilihan === 'timpa') {
      void eksekusiSimpan(konteks.aksiSetelah, konteks.dataLama.id);
    } else if (pilihan === 'tambah') {
      void eksekusiSimpan(konteks.aksiSetelah);
    }
  };

  return (
    <div className="space-y-4">
      {/* Peringatan Keselarasan / Kualitas Foto */}
      {peringatanKualitas.length > 0 ? (
        <section
          role="alert"
          className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 text-amber-950 space-y-2.5"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle
              className="mt-0.5 h-6 w-6 shrink-0 text-amber-700"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <h2 className="text-base font-bold">
                {peringatanKualitas.every(
                  (p) =>
                    p.kode === 'kemiringan-berlebihan' ||
                    p.kode === 'posisi-bergeser',
                )
                  ? 'Periksa Posisi Kertas'
                  : 'Periksa Kualitas Foto'}
              </h2>
              <ul className="list-disc pl-5 text-sm space-y-1">
                {peringatanKualitas.map((p, i) => (
                  <li key={`${p.kode}-${i}`}>{p.pesan}</li>
                ))}
              </ul>
            </div>
          </div>
          {onFotoUlang ? (
            <button
              type="button"
              onClick={onFotoUlang}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-800"
            >
              <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Foto Ulang Sekarang</span>
            </button>
          ) : null}
        </section>
      ) : null}

      {/* Ringkasan Nilai & Statistik Utama di Bagian Atas */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
              Nilai Akhir (Skala {pengaturan.skalaNilai})
            </p>
            <p className="text-4xl font-extrabold tracking-tight text-blue-900">
              {ringkasan.nilai}
            </p>
          </div>
          <div className="text-right text-xs text-slate-700">
            <p className="font-bold text-slate-900">{ujian.nama}</p>
            <p>{ujian.kunciJawaban.length} soal</p>
            {nomorDikoreksi.size > 0 ? (
              <p className="mt-1 inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-0.5 font-bold text-blue-900">
                <Pencil className="h-3 w-3" aria-hidden="true" />
                {nomorDikoreksi.size} dikoreksi manual
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="rounded-xl bg-emerald-50 p-2.5">
            <p className="text-xl font-extrabold text-emerald-800">
              {ringkasan.benar}
            </p>
            <p className="text-xs font-bold text-emerald-950">Benar</p>
          </div>
          <div className="rounded-xl bg-red-50 p-2.5">
            <p className="text-xl font-extrabold text-red-700">
              {ringkasan.salah}
            </p>
            <p className="text-xs font-bold text-red-950">Salah</p>
          </div>
          <div className="rounded-xl bg-slate-100 p-2.5">
            <p className="text-xl font-extrabold text-slate-800">
              {ringkasan.kosong}
            </p>
            <p className="text-xs font-bold text-slate-800">Kosong</p>
          </div>
          <div className="rounded-xl bg-amber-50 p-2.5">
            <p className="text-xl font-extrabold text-amber-800">
              {ringkasan.perluDicek}
            </p>
            <p className="text-xs font-bold text-amber-950">Perlu Dicek</p>
          </div>
        </div>
      </section>

      {/* Foto LJK dengan Tanda Warna & Simbol + Cubit Zoom */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <h2 className="text-base font-bold text-slate-900">
          Foto LJK &amp; Tanda Hasil Baca
        </h2>
        <FotoHasilOverlay
          fotoUrl={fotoUrl}
          template={ujian.salinanTemplate}
          kunciJawaban={ujian.kunciJawaban}
          jawabanSetelahKoreksi={jawabanSetelahKoreksi}
          statusPerNomor={ringkasan.statusPerNomor}
          nomorDikoreksi={nomorDikoreksi}
          statusBulatanMentah={statusBulatanMentah}
          nomorSorot={nomorSorot}
          onPilihNomor={(no) => setNomorKoreksiAktif(no)}
        />
      </section>

      {/* Daftar Perlu Dicek (Nomor Kuning) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900">
            Daftar Perlu Dicek
          </h2>
          <span
            className={`rounded-xl px-3 py-1 text-xs font-bold ${
              daftarPerluDicek.length === 0
                ? 'bg-emerald-100 text-emerald-950'
                : 'bg-amber-100 text-amber-950'
            }`}
          >
            {daftarPerluDicek.length} nomor
          </span>
        </div>

        {daftarPerluDicek.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-3 text-sm font-semibold text-emerald-950">
            <CheckCircle2
              className="h-5 w-5 shrink-0 text-emerald-700"
              aria-hidden="true"
            />
            <span>
              Semua nomor terbaca jelas. Tidak ada nomor yang perlu dicek.
            </span>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-slate-700">
              Ketuk nomor untuk melompat langsung ke posisinya di foto, atau
              ketuk <strong>Koreksi</strong> untuk memilih jawaban yang benar.
            </p>
            <ul className="space-y-2">
              {daftarPerluDicek.map(({ nomor, status }) => (
                <li
                  key={`cek-${nomor}`}
                  className="flex items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50/70 p-2"
                >
                  <button
                    type="button"
                    onClick={() => setNomorSorot(nomor)}
                    className="flex min-h-12 flex-1 items-center gap-2 rounded-lg px-2.5 text-left hover:bg-amber-100"
                  >
                    <span className="text-sm font-extrabold text-amber-950">
                      No. {nomor}
                    </span>
                    <span className="rounded-md bg-amber-200 px-2 py-0.5 text-xs font-bold text-amber-950">
                      ? {labelStatus(status)}
                    </span>
                    <span className="text-xs text-slate-700">
                      (Lihat di foto)
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNomorKoreksiAktif(nomor)}
                    className="inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-xl bg-blue-900 px-3.5 py-2 text-xs font-bold text-white hover:bg-blue-800"
                  >
                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Koreksi</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Rincian Semua Nomor (Ketuk untuk Koreksi Manual) */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Rincian Semua Nomor
          </h2>
          <p className="mt-0.5 text-xs text-slate-700">
            Ketuk nomor mana saja jika ingin mengubah jawaban secara manual.
            Nilai langsung dihitung ulang.
          </p>
        </div>

        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-5">
          {ringkasan.statusPerNomor.map((status, idx) => {
            const nomor = idx + 1;
            const jawab = jawabanSetelahKoreksi[idx] || '—';
            const dikoreksi = nomorDikoreksi.has(nomor);

            const gaya =
              status === 'benar'
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                : status === 'salah'
                  ? 'border-red-300 bg-red-50 text-red-950'
                  : 'border-amber-300 bg-amber-50 text-amber-950';

            const simbol =
              status === 'benar' ? '✓' : status === 'salah' ? '✕' : '?';

            return (
              <button
                key={`semua-${nomor}`}
                type="button"
                onClick={() => setNomorKoreksiAktif(nomor)}
                aria-label={`Nomor ${nomor}, jawaban ${jawab}, status ${labelStatus(status)}${dikoreksi ? ', dikoreksi manual' : ''}. Ketuk untuk ubah.`}
                className={`relative flex min-h-12 flex-col items-center justify-center rounded-xl border px-1 py-1.5 text-xs font-bold transition-colors hover:brightness-95 ${gaya}`}
              >
                <span className="leading-none">
                  {nomor}. {jawab} {simbol}
                </span>
                {dikoreksi ? (
                  <span className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-bold text-blue-900">
                    <Pencil className="h-2.5 w-2.5" aria-hidden="true" />
                    ubah
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      {/* Identitas Siswa & Kelas */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3.5">
        <div className="flex items-center gap-2">
          <User className="h-5 w-5 text-blue-900" aria-hidden="true" />
          <h2 className="text-base font-bold text-slate-900">
            Identitas Siswa
          </h2>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="identitas-siswa"
            className="block text-sm font-bold text-slate-900"
          >
            Nama atau Nomor Absen Siswa
          </label>
          <input
            id="identitas-siswa"
            name="identitasSiswa"
            type="text"
            value={identitasSiswa}
            onChange={(e) => setIdentitasSiswa(e.target.value)}
            placeholder="Contoh: 01 - Ani Rahmawati (boleh dikosongkan)"
            className="min-h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3.5 text-base font-medium text-slate-900"
          />
          <p className="text-xs text-slate-600">
            {identitasOtomatis
              ? 'Terisi otomatis dari kolom identitas LJK. Anda bisa mengubahnya bila perlu.'
              : 'Boleh dikosongkan sekarang dan dilengkapi nanti pada halaman Rekap.'}
          </p>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="kelas-siswa"
            className="block text-sm font-bold text-slate-900"
          >
            Kelas
          </label>
          <input
            id="kelas-siswa"
            name="kelasSiswa"
            type="text"
            value={kelasSiswa}
            onChange={(e) => setKelasSiswa(e.target.value)}
            placeholder="Contoh: IX-A"
            className="min-h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3.5 text-base font-medium text-slate-900"
          />
        </div>
      </section>

      {galatSimpan ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-950"
        >
          {galatSimpan}
        </div>
      ) : null}

      {/* Tombol Simpan */}
      {modeEditLama ? (
        <button
          type="button"
          disabled={sedangSimpan}
          onClick={() => {
            void handleKlikSimpan('selesai');
          }}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3.5 text-base font-bold text-white shadow-sm hover:bg-emerald-800 active:bg-emerald-900 disabled:opacity-50"
        >
          <Save className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>Simpan Perubahan</span>
        </button>
      ) : (
        <div className="space-y-2.5">
          <button
            type="button"
            disabled={sedangSimpan}
            onClick={() => {
              void handleKlikSimpan('lanjut-scan');
            }}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-900 px-5 py-3.5 text-base font-bold text-white shadow-sm hover:bg-blue-800 active:bg-blue-950 disabled:opacity-50"
          >
            <span>Simpan dan Scan Berikutnya</span>
            <ArrowRight className="h-5 w-5 shrink-0" aria-hidden="true" />
          </button>

          <button
            type="button"
            disabled={sedangSimpan}
            onClick={() => {
              void handleKlikSimpan('selesai');
            }}
            className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3.5 text-base font-bold text-white shadow-sm hover:bg-emerald-800 active:bg-emerald-900 disabled:opacity-50"
          >
            <Save className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span>Simpan dan Selesai</span>
          </button>

          {onFotoUlang ? (
            <button
              type="button"
              disabled={sedangSimpan}
              onClick={onFotoUlang}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm font-bold text-slate-900 hover:bg-slate-200"
            >
              <RotateCcw className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Foto Ulang (Jangan Simpan)</span>
            </button>
          ) : null}
        </div>
      )}

      {/* Dialog Koreksi Manual Per Nomor */}
      <KoreksiNomorDialog
        nomor={nomorKoreksiAktif}
        jumlahPilihan={ujian.salinanTemplate.jumlahPilihan}
        kunciJawaban={
          nomorKoreksiAktif !== null
            ? (ujian.kunciJawaban[nomorKoreksiAktif - 1] ?? '')
            : ''
        }
        jawabanTerbacaAwal={
          nomorKoreksiAktif !== null
            ? (jawabanTerbacaAwal[nomorKoreksiAktif - 1] ?? '')
            : ''
        }
        jawabanSaatIni={
          nomorKoreksiAktif !== null
            ? (jawabanSetelahKoreksi[nomorKoreksiAktif - 1] ?? '')
            : ''
        }
        statusSaatIni={
          nomorKoreksiAktif !== null
            ? (ringkasan.statusPerNomor[nomorKoreksiAktif - 1] ?? 'kosong')
            : 'kosong'
        }
        onPilih={handleKoreksiManual}
        onTutup={() => setNomorKoreksiAktif(null)}
      />

      {/* Dialog Konfirmasi Siswa Sama Di-Scan Dua Kali */}
      <dialog
        ref={dialogDuplikatRef}
        aria-labelledby={judulDuplikatId}
        aria-describedby={deskDuplikatId}
        onClose={handleTutupDialogDuplikat}
        className="m-auto w-[min(92dvw,26rem)] rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl"
      >
        {duplikatDitemukan ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <h2
                id={judulDuplikatId}
                className="text-lg font-bold text-slate-900"
              >
                Siswa Ini Sudah Pernah Di-Scan
              </h2>
              <p id={deskDuplikatId} className="text-sm text-slate-700">
                Data atas nama{' '}
                <strong>{duplikatDitemukan.dataLama.identitasSiswa}</strong>{' '}
                (Kelas {duplikatDitemukan.dataLama.kelas}, Nilai{' '}
                <strong>{duplikatDitemukan.dataLama.nilai}</strong>) sudah ada
                di ujian ini. Apa yang ingin Anda lakukan?
              </p>
            </div>

            <form method="dialog" className="space-y-2.5">
              <button
                type="submit"
                value="timpa"
                className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-blue-900 px-4 py-3 text-base font-bold text-white hover:bg-blue-800"
              >
                Timpa Hasil Lama
              </button>
              <button
                type="submit"
                value="tambah"
                className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border-2 border-blue-900 bg-white px-4 py-3 text-base font-bold text-blue-900 hover:bg-blue-50"
              >
                Simpan Sebagai Tambahan
              </button>
              <button
                type="submit"
                value="cancel"
                autoFocus
                className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-base font-bold text-slate-900 hover:bg-slate-200"
              >
                Batal
              </button>
            </form>
          </div>
        ) : null}
      </dialog>
    </div>
  );
}
