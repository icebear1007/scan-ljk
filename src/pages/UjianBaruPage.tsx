import { useLiveQuery } from 'dexie-react-hooks';
import { Check, LayoutGrid, Plus } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { KunciJawabanEditor } from '../components/ujian/KunciJawabanEditor.tsx';
import { db } from '../db/database.ts';
import {
  buatKunciKosong,
  perbaruiUjian,
  sesuaikanKunciKeTemplate,
  simpanUjianBaru,
  validasiKunciJawaban,
} from '../db/ujians.ts';
import type { TemplateLJK, Ujian } from '../types/ljk.ts';

interface UjianBaruPageProps {
  ujianAwal?: Ujian | null;
  onBukaBuatTemplate: () => void;
  onSelesai: (pesanSukses: string) => void;
  onBatal: () => void;
}

export function UjianBaruPage({
  ujianAwal,
  onBukaBuatTemplate,
  onSelesai,
  onBatal,
}: UjianBaruPageProps) {
  const modeUbah = Boolean(ujianAwal);

  const daftarTemplate = useLiveQuery(
    () => db.templates.orderBy('tanggalDiubah').reverse().toArray(),
    [],
  );

  const jumlahScanTerkait =
    useLiveQuery(
      () =>
        ujianAwal
          ? db.hasilScans.where('idUjian').equals(ujianAwal.id).count()
          : Promise.resolve(0),
      [ujianAwal?.id],
    ) ?? 0;

  const [nama, setNama] = useState(ujianAwal?.nama ?? '');
  const [kelas, setKelas] = useState(ujianAwal?.kelas ?? '');
  const [idTemplateDipilih, setIdTemplateDipilih] = useState<string>(
    ujianAwal?.idTemplate ?? '',
  );
  const [kunciJawaban, setKunciJawaban] = useState<string[]>(
    ujianAwal?.kunciJawaban ?? [],
  );

  const [galat, setGalat] = useState<{
    nama?: string;
    kelas?: string;
    template?: string;
    kunci?: string;
  }>({});
  const [sedangSimpan, setSedangSimpan] = useState(false);

  const inputNamaRef = useRef<HTMLInputElement>(null);
  const inputKelasRef = useRef<HTMLInputElement>(null);

  // Pilih otomatis template pertama bila membuat ujian baru & baru 1+ template tersedia
  useEffect(() => {
    if (modeUbah || !daftarTemplate || daftarTemplate.length === 0) return;
    if (!idTemplateDipilih) {
      const pertama = daftarTemplate[0];
      setIdTemplateDipilih(pertama.id);
      setKunciJawaban(buatKunciKosong(pertama.jumlahSoal));
    }
  }, [modeUbah, daftarTemplate, idTemplateDipilih]);

  const templateAktif: TemplateLJK | null = (() => {
    if (modeUbah && ujianAwal && idTemplateDipilih === ujianAwal.idTemplate) {
      return ujianAwal.salinanTemplate;
    }
    return (
      daftarTemplate?.find((t) => t.id === idTemplateDipilih) ??
      (modeUbah && ujianAwal ? ujianAwal.salinanTemplate : null)
    );
  })();

  const handlePilihTemplate = (tpl: TemplateLJK) => {
    setIdTemplateDipilih(tpl.id);
    setKunciJawaban((prev) =>
      sesuaikanKunciKeTemplate(prev, tpl.jumlahSoal, tpl.jumlahPilihan),
    );
    setGalat((prev) => ({ ...prev, template: undefined, kunci: undefined }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const galatBaru: typeof galat = {};

    if (nama.trim().length < 2) {
      galatBaru.nama = 'Isi nama ujian terlebih dahulu (minimal 2 huruf).';
    }
    if (kelas.trim().length < 1) {
      galatBaru.kelas = 'Isi kelas untuk ujian ini (misalnya IX-A).';
    }
    if (!templateAktif) {
      galatBaru.template = 'Pilih template LJK terlebih dahulu.';
    } else {
      const cekKunci = validasiKunciJawaban(
        kunciJawaban,
        templateAktif.jumlahSoal,
        templateAktif.jumlahPilihan,
      );
      if (!cekKunci.lengkap) {
        galatBaru.kunci = cekKunci.pesan;
      }
    }

    setGalat(galatBaru);

    if (galatBaru.nama) {
      inputNamaRef.current?.focus();
      return;
    }
    if (galatBaru.kelas) {
      inputKelasRef.current?.focus();
      return;
    }
    if (galatBaru.template || galatBaru.kunci || !templateAktif) {
      return;
    }

    setSedangSimpan(true);
    try {
      if (modeUbah && ujianAwal) {
        await perbaruiUjian(ujianAwal.id, {
          nama,
          kelas,
          template: templateAktif,
          kunciJawaban,
        });
        onSelesai(`Ujian "${nama.trim()}" berhasil diperbarui.`);
      } else {
        await simpanUjianBaru({
          nama,
          kelas,
          template: templateAktif,
          kunciJawaban,
        });
        onSelesai(`Ujian "${nama.trim()}" berhasil disimpan dan siap dikoreksi.`);
      }
    } catch (err) {
      setGalat({
        kunci:
          err instanceof Error
            ? err.message
            : 'Gagal menyimpan ujian. Silakan coba lagi.',
      });
    } finally {
      setSedangSimpan(false);
    }
  };

  // Jika belum ada template sama sekali (dan bukan mode ubah ujian lama)
  if (!modeUbah && daftarTemplate && daftarTemplate.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-900">
          <LayoutGrid className="h-7 w-7" aria-hidden="true" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-slate-900">
            Buat Template LJK Dulu
          </h2>
          <p className="text-sm text-slate-700">
            Sebelum membuat ujian baru, Anda perlu memiliki minimal 1 template
            LJK agar aplikasi tahu letak bulatan lembar jawaban sekolah Anda.
          </p>
        </div>
        <button
          type="button"
          onClick={onBukaBuatTemplate}
          className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-900 px-5 py-3.5 text-base font-bold text-white hover:bg-blue-800 active:bg-blue-950"
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
          <span>Buat Template Baru</span>
        </button>
        <button
          type="button"
          onClick={onBatal}
          className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-base font-bold text-slate-900 hover:bg-slate-200"
        >
          Kembali ke Beranda
        </button>
      </div>
    );
  }

  const kunciTemplateTerkunci = modeUbah && jumlahScanTerkait > 0;
  const pakaiDropdownTemplate = (daftarTemplate?.length ?? 0) >= 6;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {/* Bagian 1: Identitas Ujian & Pilihan Template */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <h2 className="text-base font-bold text-slate-900">
          1. Informasi Ujian
        </h2>

        <div className="space-y-1.5">
          <label
            htmlFor="nama-ujian"
            className="block text-sm font-bold text-slate-900"
          >
            Nama Ujian <span aria-hidden="true">*</span>
          </label>
          <input
            ref={inputNamaRef}
            id="nama-ujian"
            name="namaUjian"
            type="text"
            required
            enterKeyHint="next"
            value={nama}
            onChange={(e) => {
              setNama(e.target.value);
              if (galat.nama) setGalat((prev) => ({ ...prev, nama: undefined }));
            }}
            aria-invalid={Boolean(galat.nama)}
            aria-describedby={galat.nama ? 'galat-nama-ujian' : undefined}
            placeholder="Contoh: PTS Matematika Semester Ganjil"
            className="min-h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3.5 text-base font-medium text-slate-900"
          />
          {galat.nama ? (
            <p
              id="galat-nama-ujian"
              role="alert"
              className="text-sm font-semibold text-red-700"
            >
              {galat.nama}
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="kelas-ujian"
            className="block text-sm font-bold text-slate-900"
          >
            Kelas <span aria-hidden="true">*</span>
          </label>
          <input
            ref={inputKelasRef}
            id="kelas-ujian"
            name="kelasUjian"
            type="text"
            required
            enterKeyHint="next"
            value={kelas}
            onChange={(e) => {
              setKelas(e.target.value);
              if (galat.kelas) {
                setGalat((prev) => ({ ...prev, kelas: undefined }));
              }
            }}
            aria-invalid={Boolean(galat.kelas)}
            aria-describedby={galat.kelas ? 'galat-kelas-ujian' : 'bantuan-kelas'}
            placeholder="Contoh: IX-A atau Kelas IX (A–I)"
            className="min-h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3.5 text-base font-medium text-slate-900"
          />
          {galat.kelas ? (
            <p
              id="galat-kelas-ujian"
              role="alert"
              className="text-sm font-semibold text-red-700"
            >
              {galat.kelas}
            </p>
          ) : (
            <p id="bantuan-kelas" className="text-xs text-slate-600">
              Untuk ujian beberapa kelas sekaligus, Anda bisa menulis nama
              tingkat (mis. Kelas IX) lalu memilih kelas tiap siswa saat scan.
            </p>
          )}
        </div>

        {/* Pilih Template LJK */}
        <div className="space-y-2">
          {kunciTemplateTerkunci && templateAktif ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm">
              <p className="font-bold text-slate-900">
                Template dipakai: {templateAktif.nama}
              </p>
              <p className="mt-0.5 text-xs text-slate-700">
                {templateAktif.jumlahSoal} soal &middot; Pilihan A–
                {templateAktif.jumlahPilihan === 4 ? 'D' : 'E'} (template tidak
                diubah karena sudah ada {jumlahScanTerkait} hasil scan).
              </p>
            </div>
          ) : pakaiDropdownTemplate && daftarTemplate ? (
            <div className="space-y-1.5">
              <label
                htmlFor="pilih-template-select"
                className="block text-sm font-bold text-slate-900"
              >
                Pilih Template LJK <span aria-hidden="true">*</span>
              </label>
              <select
                id="pilih-template-select"
                name="idTemplate"
                value={idTemplateDipilih}
                onChange={(e) => {
                  const ditemukan = daftarTemplate.find(
                    (t) => t.id === e.target.value,
                  );
                  if (ditemukan) handlePilihTemplate(ditemukan);
                }}
                className="min-h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3.5 text-base font-bold text-slate-900"
              >
                {daftarTemplate.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.nama} ({tpl.jumlahSoal} soal, A–
                    {tpl.jumlahPilihan === 4 ? 'D' : 'E'})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <fieldset className="space-y-2">
              <legend className="text-sm font-bold text-slate-900">
                Pilih Template LJK <span aria-hidden="true">*</span>
              </legend>
              <div className="space-y-2">
                {(daftarTemplate ?? []).map((tpl) => {
                  const terpilih = tpl.id === idTemplateDipilih;
                  return (
                    <label
                      key={tpl.id}
                      htmlFor={`tpl-ujian-${tpl.id}`}
                      className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border-2 px-3.5 py-3 transition-colors ${
                        terpilih
                          ? 'border-blue-900 bg-blue-50 text-blue-950'
                          : 'border-slate-200 bg-white text-slate-900 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        id={`tpl-ujian-${tpl.id}`}
                        type="radio"
                        name="idTemplate"
                        value={tpl.id}
                        checked={terpilih}
                        onChange={() => handlePilihTemplate(tpl)}
                        className="h-5 w-5 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="block text-sm font-bold">
                          {tpl.nama}
                        </span>
                        <span className="block text-xs text-slate-700">
                          {tpl.jumlahSoal} soal &middot; Pilihan A–
                          {tpl.jumlahPilihan === 4 ? 'D' : 'E'}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          )}

          {galat.template ? (
            <p role="alert" className="text-sm font-semibold text-red-700">
              {galat.template}
            </p>
          ) : null}
        </div>
      </section>

      {/* Bagian 2: Kunci Jawaban (3 cara + ringkasan) */}
      {templateAktif ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              2. Kunci Jawaban ({templateAktif.jumlahSoal} Soal)
            </h2>
            <p className="mt-0.5 text-sm text-slate-700">
              Pilih cara paling nyaman: ketik cepat, ketuk satu per satu di
              grid, atau scan LJK kunci.
            </p>
          </div>

          <KunciJawabanEditor
            key={templateAktif.id}
            template={templateAktif}
            kunciJawaban={kunciJawaban}
            onChange={(kunciBaru) => {
              setKunciJawaban(kunciBaru);
              if (galat.kunci) {
                setGalat((prev) => ({ ...prev, kunci: undefined }));
              }
            }}
          />
        </section>
      ) : null}

      {galat.kunci ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-950"
        >
          {galat.kunci}
        </div>
      ) : null}

      {/* Tombol Aksi */}
      <div className="flex gap-2.5 pt-1">
        <button
          type="button"
          onClick={onBatal}
          className="inline-flex min-h-14 flex-1 items-center justify-center rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 text-base font-bold text-slate-900 hover:bg-slate-200"
        >
          Batal
        </button>
        <button
          type="submit"
          disabled={sedangSimpan}
          className="inline-flex min-h-14 flex-[2] items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-3 text-base font-bold text-white shadow-sm hover:bg-emerald-800 active:bg-emerald-900 disabled:opacity-50"
        >
          <Check className="h-5 w-5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
          <span>{modeUbah ? 'Simpan Perubahan' : 'Simpan Ujian'}</span>
        </button>
      </div>
    </form>
  );
}
