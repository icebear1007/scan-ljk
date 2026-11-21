import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Eraser,
  Keyboard,
  LayoutGrid,
  ScanLine,
  Upload,
} from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { ambilPengaturan } from '../../db/database.ts';
import {
  aturSatuKunciGrid,
  buatKunciKosong,
  daftarHurufSah,
  ekstrakKunciDariHasilScan,
  formatKunciKeTeksCepat,
  hitungDistribusiKunci,
  parseKetikCepatKunci,
  validasiKunciJawaban,
} from '../../db/ujians.ts';
import {
  bacaLjkDiWorker,
  buatContohLjkDiWorker,
  ubahFileGambarKeRgba,
  ubahRgbaKeDataUrl,
} from '../../omr/omrClient.ts';
import type { GambarMentahRgba, HasilBacaLJK } from '../../omr/types.ts';
import { PENGATURAN_AWAL, type TemplateLJK } from '../../types/ljk.ts';
import { formatDetik } from '../../utils/kesehatanAplikasi.ts';

type TabCaraKunci = 'ketik' | 'grid' | 'scan';

interface KunciJawabanEditorProps {
  template: TemplateLJK;
  kunciJawaban: string[];
  onChange: (kunciBaru: string[]) => void;
}

export function KunciJawabanEditor({
  template,
  kunciJawaban,
  onChange,
}: KunciJawabanEditorProps) {
  const pengaturan =
    useLiveQuery(() => ambilPengaturan(), []) ?? PENGATURAN_AWAL;

  const [tabAktif, setTabAktif] = useState<TabCaraKunci>('ketik');
  const [teksKetik, setTeksKetik] = useState<string>(() =>
    formatKunciKeTeksCepat(kunciJawaban),
  );
  const [infoKetik, setInfoKetik] = useState<{
    karakterTidakSah: string[];
    kelebihanHuruf: number;
  }>({ karakterTidakSah: [], kelebihanHuruf: 0 });

  // State Scan LJK Kunci
  const [sedangScan, setSedangScan] = useState(false);
  const [galatScan, setGalatScan] = useState<string | null>(null);
  const [hasilScanKunci, setHasilScanKunci] = useState<{
    hasil: HasilBacaLJK;
    fotoLurusUrl: string | null;
    nomorTerbaca: number;
    nomorPerluDilengkapi: number[];
  } | null>(null);

  const inputKameraRef = useRef<HTMLInputElement>(null);
  const inputGaleriRef = useRef<HTMLInputElement>(null);
  const barisGridRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const hurufSah = daftarHurufSah(template.jumlahPilihan);
  const validasi = validasiKunciJawaban(
    kunciJawaban,
    template.jumlahSoal,
    template.jumlahPilihan,
  );
  const distribusi = hitungDistribusiKunci(
    kunciJawaban,
    template.jumlahPilihan,
  );

  const pindahTab = (tabBaru: TabCaraKunci) => {
    if (tabBaru === 'ketik') {
      // Sinkronkan isi textarea dengan array kunci terbaru (dari grid/scan)
      setTeksKetik(formatKunciKeTeksCepat(kunciJawaban));
      setInfoKetik({ karakterTidakSah: [], kelebihanHuruf: 0 });
    }
    setTabAktif(tabBaru);
  };

  const handleUbahTeksCepat = (nilai: string) => {
    setTeksKetik(nilai);
    const parsed = parseKetikCepatKunci(
      nilai,
      template.jumlahSoal,
      template.jumlahPilihan,
    );
    setInfoKetik({
      karakterTidakSah: parsed.karakterTidakSah,
      kelebihanHuruf: parsed.kelebihanHuruf,
    });
    onChange(parsed.kunci);
  };

  const handleKetukGrid = (nomor: number, huruf: string) => {
    const saatIni = kunciJawaban[nomor - 1] ?? '';
    const nilaiBaru = saatIni === huruf ? '' : huruf;
    const kunciBaru = aturSatuKunciGrid(
      kunciJawaban,
      nomor,
      nilaiBaru,
      template.jumlahPilihan,
    );
    onChange(kunciBaru);
  };

  const loncatKeNomorGrid = (nomor: number) => {
    setTabAktif('grid');
    window.requestAnimationFrame(() => {
      const elemen = barisGridRefs.current[nomor];
      elemen?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const handleKosongkanSemua = () => {
    const kosong = buatKunciKosong(template.jumlahSoal);
    setTeksKetik('');
    setInfoKetik({ karakterTidakSah: [], kelebihanHuruf: 0 });
    setHasilScanKunci(null);
    onChange(kosong);
  };

  const prosesFotoKunci = async (gambarRgba: GambarMentahRgba) => {
    setSedangScan(true);
    setGalatScan(null);

    try {
      const hasil = await bacaLjkDiWorker(gambarRgba, {
        template,
        pengaturan,
        sertakanGambarLurus: true,
      });

      if (!hasil.berhasil) {
        setGalatScan(
          hasil.peringatan[0]?.pesan ||
            'Kertas LJK kunci tidak ditemukan. Pastikan keempat pojok terlihat jelas lalu foto ulang.',
        );
        return;
      }

      const ekstrak = ekstrakKunciDariHasilScan(
        hasil,
        template.jumlahSoal,
        template.jumlahPilihan,
      );
      const fotoLurusUrl = hasil.gambarLurus
        ? ubahRgbaKeDataUrl(hasil.gambarLurus, 0.84)
        : null;

      setHasilScanKunci({
        hasil,
        fotoLurusUrl,
        nomorTerbaca: ekstrak.nomorTerbaca,
        nomorPerluDilengkapi: ekstrak.nomorPerluDilengkapi,
      });
      onChange(ekstrak.kunci);
      setTeksKetik(formatKunciKeTeksCepat(ekstrak.kunci));
    } catch (err) {
      setGalatScan(
        err instanceof Error
          ? err.message
          : 'Gagal membaca LJK kunci. Silakan coba foto ulang.',
      );
    } finally {
      setSedangScan(false);
    }
  };

  const handlePilihFileScanKunci = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setSedangScan(true);
    setGalatScan(null);
    try {
      const rgba = await ubahFileGambarKeRgba(file, 1600);
      await prosesFotoKunci(rgba);
    } catch (err) {
      setSedangScan(false);
      setGalatScan(
        err instanceof Error ? err.message : 'Foto kunci tidak dapat dibuka.',
      );
    }
  };

  const handleSimulasiScanKunci = async () => {
    setSedangScan(true);
    setGalatScan(null);
    try {
      const polaContoh = Array.from(
        { length: template.jumlahSoal },
        (_, i) => hurufSah[i % hurufSah.length],
      );
      const rgba = await buatContohLjkDiWorker(template, {
        jawabanDiisi: polaContoh,
        kemiringanDerajat: 3,
        perspektif: 0.03,
        bayangan: 30,
        tanpaPenandaSudut: template.jenisPenanda === 'tepi-kertas',
      });
      await prosesFotoKunci(rgba);
    } catch (err) {
      setSedangScan(false);
      setGalatScan(
        err instanceof Error
          ? err.message
          : 'Gagal menjalankan simulasi scan LJK kunci.',
      );
    }
  };

  const daftarTab: Array<{
    id: TabCaraKunci;
    label: string;
    Icon: typeof Keyboard;
  }> = [
    { id: 'ketik', label: 'Ketik Cepat', Icon: Keyboard },
    { id: 'grid', label: 'Ketuk di Grid', Icon: LayoutGrid },
    { id: 'scan', label: 'Scan LJK Kunci', Icon: ScanLine },
  ];

  return (
    <div className="space-y-4">
      {/* Pilihan 3 cara mengisi kunci jawaban (single-row focusgroup tablist) */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div
          className="kunci-tablist px-2 pt-2"
          {...({ focusgroup: 'tablist nomemory' } as Record<string, string>)}
          role="tablist"
          aria-label="Cara mengisi kunci jawaban"
        >
          {daftarTab.map(({ id, label, Icon }) => {
            const aktif = tabAktif === id;
            return (
              <button
                key={id}
                id={`tab-kunci-${id}`}
                type="button"
                role="tab"
                aria-selected={aktif}
                {...(aktif ? ({ focusgroupstart: '' } as Record<string, string>) : {})}
                onClick={() => pindahTab(id)}
                className="kunci-tab inline-flex min-h-12 items-center justify-center gap-1.5 rounded-t-xl px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Panel 1: Ketik Cepat */}
        <div
          role="tabpanel"
          aria-labelledby="tab-kunci-ketik"
          hidden={tabAktif !== 'ketik'}
        >
          <div className="p-4 space-y-3">
            <div className="space-y-1.5">
              <label
                htmlFor="input-ketik-cepat"
                className="block text-sm font-bold text-slate-900"
              >
                Ketik huruf kunci berurutan ({hurufSah.join('–')})
              </label>
              <p id="bantuan-ketik-cepat" className="text-xs text-slate-700">
                Contoh: <code>ABCDE ABCDE...</code> (spasi, baris baru, atau
                nomor soal diabaikan otomatis). Diperlukan{' '}
                <strong>{template.jumlahSoal} huruf</strong>.
              </p>
              <textarea
                id="input-ketik-cepat"
                name="kunciKetikCepat"
                rows={4}
                autoCorrect="off"
                autoCapitalize="characters"
                spellCheck={false}
                value={teksKetik}
                aria-describedby="bantuan-ketik-cepat"
                onChange={(e) => handleUbahTeksCepat(e.target.value)}
                placeholder={`Ketik ${template.jumlahSoal} huruf (${hurufSah.join('')})...`}
                className="min-h-28 w-full rounded-xl border-2 border-slate-300 bg-white p-3 font-mono text-base font-bold uppercase tracking-widest text-slate-900"
              />
            </div>

            {infoKetik.karakterTidakSah.length > 0 ? (
              <div
                role="alert"
                className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-950"
              >
                Huruf di luar pilihan template ({infoKetik.karakterTidakSah.join(', ')})
                diabaikan. Template ini hanya memakai pilihan{' '}
                {hurufSah[0]}–{hurufSah[hurufSah.length - 1]}.
              </div>
            ) : null}

            {infoKetik.kelebihanHuruf > 0 ? (
              <div
                role="alert"
                className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-950"
              >
                Anda mengetik {infoKetik.kelebihanHuruf} huruf lebih banyak dari
                jumlah soal ({template.jumlahSoal}). Hanya {template.jumlahSoal}{' '}
                huruf pertama yang dipakai.
              </div>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700">
              <span>
                Terisi <strong>{validasi.terisi}</strong> dari{' '}
                <strong>{template.jumlahSoal}</strong> soal
              </span>
              <button
                type="button"
                onClick={handleKosongkanSemua}
                className="inline-flex min-h-12 items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100"
              >
                <Eraser className="h-4 w-4" aria-hidden="true" />
                <span>Kosongkan</span>
              </button>
            </div>
          </div>
        </div>

        {/* Panel 2: Ketuk di Grid */}
        <div
          role="tabpanel"
          aria-labelledby="tab-kunci-grid"
          hidden={tabAktif !== 'grid'}
        >
          <div className="p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-700">
                Ketuk huruf kunci untuk tiap nomor soal.
              </p>
              <div className="flex items-center gap-2">
                {validasi.nomorKosong.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => loncatKeNomorGrid(validasi.nomorKosong[0])}
                    className="inline-flex min-h-12 items-center rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950 hover:bg-amber-100"
                  >
                    Ke No. Kosong ({validasi.nomorKosong[0]})
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={handleKosongkanSemua}
                  className="inline-flex min-h-12 items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100"
                >
                  <Eraser className="h-4 w-4" aria-hidden="true" />
                  <span>Kosongkan</span>
                </button>
              </div>
            </div>

            <div className="max-h-[52dvh] space-y-2 overflow-y-auto pr-1">
              {Array.from({ length: template.jumlahSoal }, (_, idx) => {
                const nomor = idx + 1;
                const terpilih = kunciJawaban[idx] ?? '';
                return (
                  <div
                    key={`grid-no-${nomor}`}
                    ref={(el) => {
                      barisGridRefs.current[nomor] = el;
                    }}
                    className={`flex items-center gap-2 rounded-xl border p-2 ${
                      terpilih
                        ? 'border-slate-200 bg-white'
                        : 'border-amber-200 bg-amber-50/40'
                    }`}
                  >
                    <span className="w-9 shrink-0 text-center text-sm font-bold text-slate-900">
                      {nomor}.
                    </span>
                    <div
                      className={`grid flex-1 gap-1.5 ${
                        template.jumlahPilihan === 4
                          ? 'grid-cols-4'
                          : 'grid-cols-5'
                      }`}
                      role="group"
                      aria-label={`Kunci jawaban nomor ${nomor}`}
                    >
                      {hurufSah.map((huruf) => {
                        const aktif = terpilih === huruf;
                        return (
                          <button
                            key={`${nomor}-${huruf}`}
                            type="button"
                            aria-pressed={aktif}
                            onClick={() => handleKetukGrid(nomor, huruf)}
                            className={`min-h-12 rounded-xl border-2 text-base font-bold transition-colors ${
                              aktif
                                ? 'border-blue-900 bg-blue-900 text-white shadow-xs'
                                : 'border-slate-300 bg-white text-slate-900 hover:bg-slate-100'
                            }`}
                          >
                            {huruf}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Panel 3: Scan LJK Kunci */}
        <div
          role="tabpanel"
          aria-labelledby="tab-kunci-scan"
          hidden={tabAktif !== 'scan'}
        >
          <div className="p-4 space-y-3.5">
            <p className="text-sm text-slate-700">
              Hitamkan satu lembar LJK dengan kunci jawaban yang benar, lalu
              potret atau unggah fotonya. Aplikasi akan mengisi seluruh kunci
              secara otomatis.
            </p>

            {sedangScan ? (
              <div
                role="status"
                aria-live="polite"
                className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3.5 text-sm font-bold text-blue-950"
              >
                <progress
                  aria-label="Sedang membaca LJK kunci..."
                  className="loading-spinner shrink-0"
                />
                <span>Sedang membaca LJK kunci...</span>
              </div>
            ) : null}

            {galatScan ? (
              <div
                role="alert"
                className="rounded-xl border border-red-300 bg-red-50 p-3.5 text-sm font-medium text-red-950"
              >
                {galatScan}
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                disabled={sedangScan}
                onClick={() => inputKameraRef.current?.click()}
                className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-blue-900 px-4 py-3 text-base font-bold text-white hover:bg-blue-800 active:bg-blue-950 disabled:opacity-50"
              >
                <Camera className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>Potret LJK Kunci</span>
              </button>

              <button
                type="button"
                disabled={sedangScan}
                onClick={() => inputGaleriRef.current?.click()}
                className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-blue-900 bg-white px-4 py-3 text-base font-bold text-blue-900 hover:bg-blue-50 disabled:opacity-50"
              >
                <Upload className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>Unggah dari Galeri</span>
              </button>
            </div>

            <button
              type="button"
              disabled={sedangScan}
              onClick={() => {
                void handleSimulasiScanKunci();
              }}
              className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-100 disabled:opacity-50"
            >
              Uji Cepat dengan Simulasi LJK Kunci
            </button>

            <input
              ref={inputKameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                void handlePilihFileScanKunci(e);
              }}
              className="sr-only"
              aria-label="Potret LJK kunci dengan kamera"
            />
            <input
              ref={inputGaleriRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                void handlePilihFileScanKunci(e);
              }}
              className="sr-only"
              aria-label="Unggah foto LJK kunci dari galeri"
            />

            {hasilScanKunci ? (
              <div className="space-y-3 border-t border-slate-200 pt-3">
                {hasilScanKunci.nomorPerluDilengkapi.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-sm font-bold text-emerald-950">
                    <CheckCircle2
                      className="h-5 w-5 shrink-0 text-emerald-700"
                      aria-hidden="true"
                    />
                    <span>
                      Semua {hasilScanKunci.nomorTerbaca} nomor kunci terbaca
                      jelas ({formatDetik(hasilScanKunci.hasil.waktuProsesMs)}).
                      Periksa ringkasan di bawah sebelum menyimpan.
                    </span>
                  </div>
                ) : (
                  <div
                    role="alert"
                    className="space-y-2 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-sm text-amber-950"
                  >
                    <div className="flex items-center gap-2 font-bold">
                      <AlertTriangle
                        className="h-5 w-5 shrink-0 text-amber-700"
                        aria-hidden="true"
                      />
                      <span>
                        Terbaca {hasilScanKunci.nomorTerbaca} dari{' '}
                        {template.jumlahSoal} soal
                      </span>
                    </div>
                    <p className="text-xs">
                      Nomor belum terbaca / ragu:{' '}
                      <strong>
                        {hasilScanKunci.nomorPerluDilengkapi.join(', ')}
                      </strong>
                      . Anda bisa melengkapinya langsung di tab Ketuk di Grid.
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        loncatKeNomorGrid(
                          hasilScanKunci.nomorPerluDilengkapi[0],
                        )
                      }
                      className="inline-flex min-h-12 items-center justify-center rounded-xl bg-amber-700 px-3.5 py-2 text-xs font-bold text-white hover:bg-amber-800"
                    >
                      Lengkapi Nomor {hasilScanKunci.nomorPerluDilengkapi[0]} di
                      Grid
                    </button>
                  </div>
                )}

                {hasilScanKunci.fotoLurusUrl ? (
                  <div className="relative overflow-hidden rounded-xl border border-slate-300 bg-slate-100">
                    <img
                      src={hasilScanKunci.fotoLurusUrl}
                      alt="Foto LJK kunci yang sudah diluruskan dengan tanda pembacaan"
                      className="block h-auto w-full"
                    />
                    <svg
                      viewBox={`0 0 ${template.ukuranStandar.lebar} ${template.ukuranStandar.tinggi}`}
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 h-full w-full"
                    >
                      {hasilScanKunci.hasil.hasilPerNomor.map((item) =>
                        item.bulatan.map((b) => {
                          if (
                            item.statusMentah === 'terjawab' &&
                            item.jawabanTerbaca === b.label
                          ) {
                            return (
                              <circle
                                key={`sk-${item.nomor}-${b.label}`}
                                cx={b.pusat.x}
                                cy={b.pusat.y}
                                r={b.radius + 4}
                                fill="rgba(22, 163, 74, 0.25)"
                                stroke="#15803d"
                                strokeWidth="4"
                              />
                            );
                          }
                          if (
                            item.statusMentah !== 'terjawab' &&
                            b.status !== 'kosong'
                          ) {
                            return (
                              <circle
                                key={`sk-${item.nomor}-${b.label}`}
                                cx={b.pusat.x}
                                cy={b.pusat.y}
                                r={b.radius + 4}
                                fill="rgba(234, 179, 8, 0.28)"
                                stroke="#a16207"
                                strokeWidth="4"
                              />
                            );
                          }
                          return null;
                        }),
                      )}
                    </svg>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Ringkasan Kunci Jawaban untuk diperiksa guru sebelum menyimpan */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-base font-bold text-slate-900">
            Ringkasan Kunci Jawaban
          </h3>
          <span
            className={`rounded-xl px-3 py-1 text-xs font-bold ${
              validasi.lengkap
                ? 'bg-emerald-100 text-emerald-950'
                : 'bg-amber-100 text-amber-950'
            }`}
          >
            {validasi.terisi}/{template.jumlahSoal} terisi
          </span>
        </div>

        <p
          className={`text-xs font-semibold ${
            validasi.lengkap ? 'text-emerald-800' : 'text-amber-900'
          }`}
        >
          {validasi.pesan}
        </p>

        {/* Distribusi huruf A-E */}
        <div className="flex flex-wrap gap-1.5">
          {hurufSah.map((h) => (
            <span
              key={`dist-${h}`}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-800"
            >
              {h}: {distribusi[h] ?? 0}
            </span>
          ))}
        </div>

        {/* Kisi ringkas 1..N (ketuk nomor untuk ubah di Grid) */}
        <div className="grid grid-cols-5 gap-1.5">
          {Array.from({ length: template.jumlahSoal }, (_, idx) => {
            const nomor = idx + 1;
            const huruf = kunciJawaban[idx] ?? '';
            return (
              <button
                key={`ringkasan-${nomor}`}
                type="button"
                onClick={() => loncatKeNomorGrid(nomor)}
                aria-label={`Nomor ${nomor}, kunci ${huruf || 'belum diisi'}. Ketuk untuk mengubah di grid.`}
                className={`min-h-12 rounded-xl border text-center text-xs font-bold transition-colors ${
                  huruf
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-950 hover:bg-emerald-100'
                    : 'border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100'
                }`}
              >
                <span className="text-slate-600">{nomor}.</span>{' '}
                <span>{huruf || '—'}</span>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}
