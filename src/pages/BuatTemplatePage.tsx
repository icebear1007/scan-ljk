import { useLiveQuery } from 'dexie-react-hooks';
import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Eye,
  EyeOff,
  Plus,
  RotateCcw,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import {
  BubbleGridMarker,
  type DraftBlokIdentitas,
  type DraftBlokJawaban,
} from '../components/template/BubbleGridMarker.tsx';
import { CornerAdjuster } from '../components/template/CornerAdjuster.tsx';
import { ambilPengaturan } from '../db/database.ts';
import {
  perbaruiTemplate,
  sarankanBlokBerikutnya,
  simpanTemplateBaru,
  validasiCakupanBlokJawaban,
} from '../db/templates.ts';
import {
  hitungUkuranStandarDariSudut,
  HURUF_PILIHAN,
} from '../omr/geometry.ts';
import { formatDetik } from '../utils/kesehatanAplikasi.ts';
import {
  bacaLjkDiWorker,
  buatContohLjkDiWorker,
  deteksiKertasDiWorker,
  ubahFileGambarKeRgba,
  ubahRgbaKeDataUrl,
  ubahRgbaKeJpegBlob,
} from '../omr/omrClient.ts';
import { TEMPLATE_CONTOH_40_SOAL } from '../omr/sampleTemplate.ts';
import type {
  EmpatSudut,
  GambarMentahRgba,
  HasilBacaLJK,
} from '../omr/types.ts';
import {
  PENGATURAN_AWAL,
  type BlokIdentitas,
  type BlokJawaban,
  type JenisPenanda,
  type TemplateLJK,
  type Titik,
  type UkuranStandar,
} from '../types/ljk.ts';

interface BuatTemplatePageProps {
  templateAwal?: TemplateLJK | null;
  onSelesai: (pesanSukses: string) => void;
  onBatal: () => void;
}

const UKURAN_STANDAR_AWAL: UkuranStandar = { lebar: 1000, tinggi: 1414 };

const DAFTAR_LANGKAH = [
  { nomor: 1, label: 'Dasar' },
  { nomor: 2, label: 'Foto Kosong' },
  { nomor: 3, label: 'Luruskan' },
  { nomor: 4, label: 'Blok Jawaban' },
  { nomor: 5, label: 'Identitas' },
  { nomor: 6, label: 'Uji & Simpan' },
] as const;

type NomorLangkah = (typeof DAFTAR_LANGKAH)[number]['nomor'];

function buatSudutBawaan(lebar: number, tinggi: number): EmpatSudut {
  const mx = Math.round(lebar * 0.08);
  const my = Math.round(tinggi * 0.08);
  return {
    kiriAtas: { x: mx, y: my },
    kananAtas: { x: lebar - mx, y: my },
    kananBawah: { x: lebar - mx, y: tinggi - my },
    kiriBawah: { x: mx, y: tinggi - my },
  };
}

export function BuatTemplatePage({
  templateAwal,
  onSelesai,
  onBatal,
}: BuatTemplatePageProps) {
  const modeUbah = Boolean(templateAwal);
  const pengaturan =
    useLiveQuery(() => ambilPengaturan(), []) ?? PENGATURAN_AWAL;

  // Langkah aktif (1..6)
  const [langkah, setLangkah] = useState<NomorLangkah>(1);
  const judulLangkahRef = useRef<HTMLHeadingElement>(null);
  const sudahMountRef = useRef(false);

  // Langkah 1: Nama & dasar
  const [nama, setNama] = useState(templateAwal?.nama ?? '');
  const [jumlahSoalTeks, setJumlahSoalTeks] = useState(
    String(templateAwal?.jumlahSoal ?? 40),
  );
  const [jumlahPilihan, setJumlahPilihan] = useState<4 | 5>(
    templateAwal?.jumlahPilihan ?? 5,
  );
  const [jenisPenanda, setJenisPenanda] = useState<JenisPenanda>(
    templateAwal?.jenisPenanda ?? 'penanda-sudut',
  );
  const [ukuranStandar, setUkuranStandar] = useState<UkuranStandar>(
    templateAwal?.ukuranStandar ?? UKURAN_STANDAR_AWAL,
  );
  const [galatLangkah1, setGalatLangkah1] = useState<{
    nama?: string;
    jumlahSoal?: string;
  }>({});
  const inputNamaRef = useRef<HTMLInputElement>(null);
  const inputJumlahSoalRef = useRef<HTMLInputElement>(null);

  // Langkah 2 & 3: Foto mentah & pelurusan
  const [fotoMentahRgba, setFotoMentahRgba] =
    useState<GambarMentahRgba | null>(null);
  const [fotoMentahUrl, setFotoMentahUrl] = useState<string | null>(null);
  const [sudut, setSudut] = useState<EmpatSudut | null>(null);
  const [infoDeteksiSudut, setInfoDeteksiSudut] = useState<string | null>(null);
  const [fotoLurusBlob, setFotoLurusBlob] = useState<Blob | undefined>(
    templateAwal?.gambarContoh,
  );
  const [fotoLurusUrl, setFotoLurusUrl] = useState<string | null>(null);

  // Langkah 4: Blok jawaban
  const [blokJawaban, setBlokJawaban] = useState<BlokJawaban[]>(
    templateAwal?.blokJawaban ?? [],
  );
  const saranAwal = sarankanBlokBerikutnya(
    templateAwal?.blokJawaban ?? [],
    templateAwal?.jumlahSoal ?? 40,
  );
  const [draftJawaban, setDraftJawaban] = useState<DraftBlokJawaban>({
    nomorAwal: saranAwal.nomorAwal,
    jumlahNomor: saranAwal.jumlahNomor,
    jumlahPilihan: templateAwal?.jumlahPilihan ?? 5,
    radiusBulatan: 15,
    titikPertama: null,
    titikTerakhir: null,
  });
  const [targetKetukJawaban, setTargetKetukJawaban] = useState<
    'pertama' | 'terakhir'
  >('pertama');

  // Langkah 5: Blok identitas (opsional)
  const [blokIdentitas, setBlokIdentitas] = useState<BlokIdentitas[]>(
    templateAwal?.blokIdentitas ?? [],
  );
  const [draftIdentitas, setDraftIdentitas] = useState<DraftBlokIdentitas>({
    kolomKe: (templateAwal?.blokIdentitas?.length ?? 0) + 1,
    jumlahDigit: 10,
    radiusBulatan: 11,
    titikPertama: null,
    titikTerakhir: null,
  });
  const [targetKetukIdentitas, setTargetKetukIdentitas] = useState<
    'pertama' | 'terakhir'
  >('pertama');

  // Langkah 6: Uji template
  const [hasilUji, setHasilUji] = useState<{
    hasil: HasilBacaLJK;
    fotoLurusUrl: string | null;
  } | null>(null);
  const [tampilkanTandaUji, setTampilkanTandaUji] = useState(true);

  // Status proses & galat umum
  const [sedangProses, setSedangProses] = useState(false);
  const [pesanProses, setPesanProses] = useState('');
  const [galatUmum, setGalatUmum] = useState<string | null>(null);

  const inputKameraKosongRef = useRef<HTMLInputElement>(null);
  const inputGaleriKosongRef = useRef<HTMLInputElement>(null);
  const inputKameraUjiRef = useRef<HTMLInputElement>(null);
  const inputGaleriUjiRef = useRef<HTMLInputElement>(null);

  // Buat object URL aman untuk gambar contoh yang sudah tersimpan (saat mode Ubah)
  useEffect(() => {
    if (!fotoLurusBlob) {
      setFotoLurusUrl(null);
      return;
    }
    const url = URL.createObjectURL(fotoLurusBlob);
    setFotoLurusUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [fotoLurusBlob]);

  // Pindahkan fokus ke judul langkah setiap berpindah langkah (accessibility multi-step form)
  useEffect(() => {
    if (!sudahMountRef.current) {
      sudahMountRef.current = true;
      return;
    }
    judulLangkahRef.current?.focus();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [langkah]);

  // Sinkronkan jumlahPilihan pada draft blok jawaban jika diubah di langkah 1
  useEffect(() => {
    setDraftJawaban((prev) => ({ ...prev, jumlahPilihan }));
  }, [jumlahPilihan]);

  const jumlahSoalAngka = Math.max(
    1,
    Math.min(200, Math.round(Number(jumlahSoalTeks) || 0)),
  );

  const validasiBlok = useMemo(
    () => validasiCakupanBlokJawaban(blokJawaban, jumlahSoalAngka),
    [blokJawaban, jumlahSoalAngka],
  );

  const hurufPilihanTerakhir = HURUF_PILIHAN[jumlahPilihan - 1] ?? 'E';

  const draftTemplate: TemplateLJK = useMemo(() => {
    const sekarang = new Date().toISOString();
    return {
      id: templateAwal?.id ?? 'draft-uji-template',
      nama: nama.trim() || 'Template Baru',
      jumlahSoal: jumlahSoalAngka,
      jumlahPilihan,
      ukuranStandar,
      jenisPenanda,
      blokJawaban,
      ...(blokIdentitas.length > 0 ? { blokIdentitas } : {}),
      ...(fotoLurusBlob ? { gambarContoh: fotoLurusBlob } : {}),
      tanggalDibuat: templateAwal?.tanggalDibuat ?? sekarang,
      tanggalDiubah: sekarang,
    };
  }, [
    templateAwal,
    nama,
    jumlahSoalAngka,
    jumlahPilihan,
    ukuranStandar,
    jenisPenanda,
    blokJawaban,
    blokIdentitas,
    fotoLurusBlob,
  ]);

  const pindahLangkah = (tujuan: NomorLangkah) => {
    setGalatUmum(null);
    setLangkah(tujuan);
  };

  // --- Handler Langkah 1 ---
  const handleLanjutLangkah1 = (e: FormEvent) => {
    e.preventDefault();
    const galatBaru: { nama?: string; jumlahSoal?: string } = {};

    if (nama.trim().length < 2) {
      galatBaru.nama = 'Isi nama template terlebih dahulu (minimal 2 huruf).';
    }
    const angkaSoal = Number(jumlahSoalTeks);
    if (
      !Number.isInteger(angkaSoal) ||
      angkaSoal < 1 ||
      angkaSoal > 200
    ) {
      galatBaru.jumlahSoal = 'Jumlah soal harus berupa angka antara 1 sampai 200.';
    }

    setGalatLangkah1(galatBaru);
    if (galatBaru.nama) {
      inputNamaRef.current?.focus();
      return;
    }
    if (galatBaru.jumlahSoal) {
      inputJumlahSoalRef.current?.focus();
      return;
    }

    // Perbarui saran blok jika belum ada blok
    if (blokJawaban.length === 0) {
      const saran = sarankanBlokBerikutnya([], angkaSoal);
      setDraftJawaban((prev) => ({
        ...prev,
        nomorAwal: saran.nomorAwal,
        jumlahNomor: saran.jumlahNomor,
        jumlahPilihan,
      }));
    }

    pindahLangkah(2);
  };

  // --- Handler Langkah 2 & 3 ---
  const prosesFotoLjkKosong = async (gambarRgba: GambarMentahRgba) => {
    setSedangProses(true);
    setGalatUmum(null);
    setPesanProses('Sedang mencari keempat sudut kertas LJK...');

    try {
      const previewUrl = ubahRgbaKeDataUrl(gambarRgba, 0.82);
      setFotoMentahRgba(gambarRgba);
      setFotoMentahUrl(previewUrl);

      const hasilDeteksi = await deteksiKertasDiWorker(gambarRgba, {
        jenisPenanda,
        sertakanGambarLurus: false,
      });

      if (hasilDeteksi.berhasil && hasilDeteksi.sudut) {
        setSudut(hasilDeteksi.sudut);
        setInfoDeteksiSudut(
          hasilDeteksi.metode === 'penanda-sudut'
            ? 'Keempat penanda sudut ditemukan otomatis. Silakan periksa atau geser jika kurang pas.'
            : 'Keempat tepi kertas ditemukan otomatis. Silakan periksa atau geser jika kurang pas.',
        );
      } else {
        setSudut(buatSudutBawaan(gambarRgba.lebar, gambarRgba.tinggi));
        setInfoDeteksiSudut(
          'Pojok kertas belum terdeteksi otomatis. Silakan geser 4 lingkaran biru ke keempat sudut kertas LJK.',
        );
      }

      pindahLangkah(3);
    } catch (err) {
      setGalatUmum(
        err instanceof Error
          ? err.message
          : 'Gagal memproses foto LJK kosong. Coba pilih foto lain.',
      );
    } finally {
      setSedangProses(false);
      setPesanProses('');
    }
  };

  const handlePilihFotoKosong = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setSedangProses(true);
    setPesanProses('Membaca foto dari perangkat...');
    try {
      const rgba = await ubahFileGambarKeRgba(file, 1600);
      await prosesFotoLjkKosong(rgba);
    } catch (err) {
      setSedangProses(false);
      setPesanProses('');
      setGalatUmum(
        err instanceof Error
          ? err.message
          : 'Foto tidak dapat dibuka. Pastikan file berupa gambar.',
      );
    }
  };

  const handlePakaiContohKosong = async () => {
    setSedangProses(true);
    setGalatUmum(null);
    setPesanProses('Menyiapkan contoh foto LJK kosong...');
    try {
      const templateDasarContoh: TemplateLJK = {
        ...TEMPLATE_CONTOH_40_SOAL,
        jenisPenanda,
      };
      const rgba = await buatContohLjkDiWorker(templateDasarContoh, {
        jawabanDiisi: Array(40).fill(''),
        kemiringanDerajat: 3,
        perspektif: 0.03,
        bayangan: 25,
        tanpaPenandaSudut: jenisPenanda === 'tepi-kertas',
      });
      await prosesFotoLjkKosong(rgba);
    } catch (err) {
      setSedangProses(false);
      setPesanProses('');
      setGalatUmum(
        err instanceof Error
          ? err.message
          : 'Gagal menyiapkan contoh LJK kosong.',
      );
    }
  };

  const handleDeteksiUlangSudut = async () => {
    if (!fotoMentahRgba) return;
    await prosesFotoLjkKosong(fotoMentahRgba);
  };

  const handleLuruskanDanLanjut = async () => {
    if (!fotoMentahRgba || !sudut) return;

    setSedangProses(true);
    setGalatUmum(null);
    setPesanProses('Sedang meluruskan kertas LJK...');
    try {
      const ukuranBaru = hitungUkuranStandarDariSudut(sudut);
      const hasil = await deteksiKertasDiWorker(fotoMentahRgba, {
        jenisPenanda,
        ukuranStandar: ukuranBaru,
        sudutManual: sudut,
        sertakanGambarLurus: true,
      });

      if (!hasil.berhasil || !hasil.gambarLurus) {
        throw new Error(
          'Posisi 4 sudut belum valid. Pastikan keempat sudut membentuk kotak kertas yang wajar.',
        );
      }

      // Jika proporsi kertas berubah dibanding sebelumnya, skalakan blok yang sudah ada agar tetap di dalam gambar
      if (
        ukuranBaru.lebar !== ukuranStandar.lebar ||
        ukuranBaru.tinggi !== ukuranStandar.tinggi
      ) {
        const skalaX = ukuranBaru.lebar / Math.max(1, ukuranStandar.lebar);
        const skalaY = ukuranBaru.tinggi / Math.max(1, ukuranStandar.tinggi);
        const skalaR = Math.min(skalaX, skalaY);

        setBlokJawaban((prev) =>
          prev.map((b) => ({
            ...b,
            titikBulatanPertama: {
              x: Math.round(b.titikBulatanPertama.x * skalaX),
              y: Math.round(b.titikBulatanPertama.y * skalaY),
            },
            titikBulatanTerakhir: {
              x: Math.round(b.titikBulatanTerakhir.x * skalaX),
              y: Math.round(b.titikBulatanTerakhir.y * skalaY),
            },
            radiusBulatan: Math.max(5, Math.round(b.radiusBulatan * skalaR)),
          })),
        );

        setBlokIdentitas((prev) =>
          prev.map((k) => ({
            ...k,
            titikDigitPertama: {
              x: Math.round(k.titikDigitPertama.x * skalaX),
              y: Math.round(k.titikDigitPertama.y * skalaY),
            },
            titikDigitTerakhir: {
              x: Math.round(k.titikDigitTerakhir.x * skalaX),
              y: Math.round(k.titikDigitTerakhir.y * skalaY),
            },
            radiusBulatan: Math.max(5, Math.round(k.radiusBulatan * skalaR)),
          })),
        );

        setDraftJawaban((prev) => ({
          ...prev,
          titikPertama: null,
          titikTerakhir: null,
        }));
        setDraftIdentitas((prev) => ({
          ...prev,
          titikPertama: null,
          titikTerakhir: null,
        }));
        setUkuranStandar(ukuranBaru);
      }

      const blobJpeg = await ubahRgbaKeJpegBlob(hasil.gambarLurus, 0.84);
      setFotoLurusBlob(blobJpeg);
      pindahLangkah(4);
    } catch (err) {
      setGalatUmum(
        err instanceof Error
          ? err.message
          : 'Gagal meluruskan kertas. Periksa posisi keempat sudut.',
      );
    } finally {
      setSedangProses(false);
      setPesanProses('');
    }
  };

  // --- Handler Langkah 4 (Blok Jawaban) ---
  const handleKetukGambarJawaban = (titik: Titik) => {
    setGalatUmum(null);
    if (targetKetukJawaban === 'pertama') {
      setDraftJawaban((prev) => ({
        ...prev,
        titikPertama: titik,
      }));
      setTargetKetukJawaban('terakhir');
    } else {
      setDraftJawaban((prev) => ({
        ...prev,
        titikTerakhir: titik,
      }));
    }
  };

  const handleGeserTitikJawaban = (
    target: 'pertama' | 'terakhir',
    dx: number,
    dy: number,
  ) => {
    setDraftJawaban((prev) => {
      const titikAsal =
        target === 'pertama' ? prev.titikPertama : prev.titikTerakhir;
      if (!titikAsal) return prev;
      const baru: Titik = {
        x: Math.max(0, Math.min(ukuranStandar.lebar - 1, titikAsal.x + dx)),
        y: Math.max(0, Math.min(ukuranStandar.tinggi - 1, titikAsal.y + dy)),
      };
      return target === 'pertama'
        ? { ...prev, titikPertama: baru }
        : { ...prev, titikTerakhir: baru };
    });
  };

  const handleTambahBlokJawaban = () => {
    if (!draftJawaban.titikPertama || !draftJawaban.titikTerakhir) {
      setGalatUmum('Ketuk dulu bulatan pertama dan bulatan terakhir di blok ini.');
      return;
    }

    const blokBaru: BlokJawaban = {
      nomorAwal: Math.max(1, Math.round(draftJawaban.nomorAwal)),
      jumlahNomor: Math.max(1, Math.round(draftJawaban.jumlahNomor)),
      jumlahPilihan,
      radiusBulatan: draftJawaban.radiusBulatan,
      titikBulatanPertama: draftJawaban.titikPertama,
      titikBulatanTerakhir: draftJawaban.titikTerakhir,
    };

    const daftarBaru = [...blokJawaban, blokBaru].sort(
      (a, b) => a.nomorAwal - b.nomorAwal,
    );
    setBlokJawaban(daftarBaru);

    const saranBerikut = sarankanBlokBerikutnya(daftarBaru, jumlahSoalAngka);
    setDraftJawaban({
      nomorAwal: saranBerikut.nomorAwal,
      jumlahNomor: saranBerikut.jumlahNomor,
      jumlahPilihan,
      radiusBulatan: draftJawaban.radiusBulatan,
      titikPertama: null,
      titikTerakhir: null,
    });
    setTargetKetukJawaban('pertama');
    setGalatUmum(null);
  };

  const handleHapusBlokJawaban = (indeks: number) => {
    const daftarBaru = blokJawaban.filter((_, i) => i !== indeks);
    setBlokJawaban(daftarBaru);
    const saran = sarankanBlokBerikutnya(daftarBaru, jumlahSoalAngka);
    setDraftJawaban((prev) => ({
      ...prev,
      nomorAwal: saran.nomorAwal,
      jumlahNomor: saran.jumlahNomor,
    }));
  };

  const handleLanjutDariBlokJawaban = () => {
    if (blokJawaban.length === 0) {
      setGalatUmum('Tambahkan minimal satu blok jawaban terlebih dahulu.');
      return;
    }
    if (!validasiBlok.lengkap) {
      setGalatUmum(validasiBlok.pesanRingkas);
      return;
    }
    pindahLangkah(5);
  };

  // --- Handler Langkah 5 (Blok Identitas Opsional) ---
  const handleKetukGambarIdentitas = (titik: Titik) => {
    setGalatUmum(null);
    if (targetKetukIdentitas === 'pertama') {
      setDraftIdentitas((prev) => ({ ...prev, titikPertama: titik }));
      setTargetKetukIdentitas('terakhir');
    } else {
      setDraftIdentitas((prev) => ({ ...prev, titikTerakhir: titik }));
    }
  };

  const handleTambahKolomIdentitas = () => {
    if (!draftIdentitas.titikPertama || !draftIdentitas.titikTerakhir) {
      setGalatUmum('Ketuk dulu bulatan angka 0 dan angka 9 untuk kolom ini.');
      return;
    }
    const kolomBaru: BlokIdentitas = {
      kolomKe: blokIdentitas.length + 1,
      jumlahDigit: 10,
      radiusBulatan: draftIdentitas.radiusBulatan,
      titikDigitPertama: draftIdentitas.titikPertama,
      titikDigitTerakhir: draftIdentitas.titikTerakhir,
    };
    const daftarBaru = [...blokIdentitas, kolomBaru];
    setBlokIdentitas(daftarBaru);
    setDraftIdentitas({
      kolomKe: daftarBaru.length + 1,
      jumlahDigit: 10,
      radiusBulatan: draftIdentitas.radiusBulatan,
      titikPertama: null,
      titikTerakhir: null,
    });
    setTargetKetukIdentitas('pertama');
    setGalatUmum(null);
  };

  const handleHapusKolomIdentitas = (indeks: number) => {
    const daftarBaru = blokIdentitas
      .filter((_, i) => i !== indeks)
      .map((item, i) => ({ ...item, kolomKe: i + 1 }));
    setBlokIdentitas(daftarBaru);
    setDraftIdentitas((prev) => ({
      ...prev,
      kolomKe: daftarBaru.length + 1,
    }));
  };

  // --- Handler Langkah 6 (Uji Template & Simpan) ---
  const jalankanUjiTemplate = async (gambarRgba: GambarMentahRgba) => {
    setSedangProses(true);
    setGalatUmum(null);
    setPesanProses('Sedang membaca LJK uji memakai template baru...');

    try {
      const hasil = await bacaLjkDiWorker(gambarRgba, {
        template: draftTemplate,
        pengaturan,
        sertakanGambarLurus: true,
      });

      const urlLurus = hasil.gambarLurus
        ? ubahRgbaKeDataUrl(hasil.gambarLurus, 0.85)
        : null;

      setHasilUji({ hasil, fotoLurusUrl: urlLurus });
    } catch (err) {
      setGalatUmum(
        err instanceof Error
          ? err.message
          : 'Gagal menguji template. Coba foto ulang.',
      );
    } finally {
      setSedangProses(false);
      setPesanProses('');
    }
  };

  const handlePilihFotoUji = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setSedangProses(true);
    setPesanProses('Membaca foto LJK terisi...');
    try {
      const rgba = await ubahFileGambarKeRgba(file, 1600);
      await jalankanUjiTemplate(rgba);
    } catch (err) {
      setSedangProses(false);
      setPesanProses('');
      setGalatUmum(
        err instanceof Error ? err.message : 'Gagal membuka foto uji.',
      );
    }
  };

  const handleSimulasiUjiTemplate = async () => {
    setSedangProses(true);
    setGalatUmum(null);
    setPesanProses('Menyiapkan simulasi LJK terisi untuk menguji template...');
    try {
      const hurufTersedia = HURUF_PILIHAN.slice(0, jumlahPilihan);
      const jawabanSimulasi = Array.from({ length: jumlahSoalAngka }, (_, i) =>
        hurufTersedia[i % hurufTersedia.length],
      );
      const idSimulasi =
        blokIdentitas.length > 0
          ? Array.from({ length: blokIdentitas.length }, (_, i) =>
              String((i + 1) % 10),
            ).join('')
          : undefined;

      const rgba = await buatContohLjkDiWorker(draftTemplate, {
        jawabanDiisi: jawabanSimulasi,
        identitasDigit: idSimulasi,
        kemiringanDerajat: 3,
        perspektif: 0.03,
        bayangan: 30,
        tanpaPenandaSudut: jenisPenanda === 'tepi-kertas',
      });
      await jalankanUjiTemplate(rgba);
    } catch (err) {
      setSedangProses(false);
      setPesanProses('');
      setGalatUmum(
        err instanceof Error
          ? err.message
          : 'Gagal menjalankan simulasi uji template.',
      );
    }
  };

  const handleSimpanTemplate = async () => {
    if (nama.trim().length < 2) {
      setGalatUmum('Nama template belum diisi.');
      pindahLangkah(1);
      return;
    }
    if (!validasiBlok.lengkap) {
      setGalatUmum(validasiBlok.pesanRingkas);
      pindahLangkah(4);
      return;
    }

    setSedangProses(true);
    setPesanProses('Menyimpan template ke perangkat...');
    try {
      const payload = {
        nama: nama.trim(),
        jumlahSoal: jumlahSoalAngka,
        jumlahPilihan,
        ukuranStandar,
        jenisPenanda,
        blokJawaban,
        ...(blokIdentitas.length > 0 ? { blokIdentitas } : {}),
        ...(fotoLurusBlob ? { gambarContoh: fotoLurusBlob } : {}),
      };

      if (modeUbah && templateAwal) {
        await perbaruiTemplate(templateAwal.id, payload);
        onSelesai(`Template "${payload.nama}" berhasil diperbarui.`);
      } else {
        await simpanTemplateBaru(payload);
        onSelesai(`Template "${payload.nama}" berhasil disimpan.`);
      }
    } catch (err) {
      setGalatUmum(
        err instanceof Error ? err.message : 'Gagal menyimpan template.',
      );
    } finally {
      setSedangProses(false);
      setPesanProses('');
    }
  };

  const bisaKlikLangkah = (target: NomorLangkah): boolean => {
    if (target === 1 || target === 2) return true;
    if (target === 3) return Boolean(fotoMentahUrl && sudut);
    if (target === 4 || target === 5) return Boolean(fotoLurusUrl);
    if (target === 6) return Boolean(fotoLurusUrl && validasiBlok.lengkap);
    return false;
  };

  const nomorAkhirDraft = Math.min(
    jumlahSoalAngka,
    draftJawaban.nomorAwal + Math.max(1, draftJawaban.jumlahNomor) - 1,
  );

  const labelPanduanJawaban =
    !draftJawaban.titikPertama || targetKetukJawaban === 'pertama'
      ? `Ketuk 1/2: bulatan No. ${draftJawaban.nomorAwal} pilihan A`
      : !draftJawaban.titikTerakhir
        ? `Ketuk 2/2: bulatan No. ${nomorAkhirDraft} pilihan ${hurufPilihanTerakhir}`
        : 'Periksa lingkaran biru. Ketuk ulang untuk geser, atau tekan Tambah Blok.';

  const labelPanduanIdentitas =
    !draftIdentitas.titikPertama || targetKetukIdentitas === 'pertama'
      ? `Ketuk 1/2: bulatan angka 0 (Kolom ${draftIdentitas.kolomKe})`
      : !draftIdentitas.titikTerakhir
        ? `Ketuk 2/2: bulatan angka 9 (Kolom ${draftIdentitas.kolomKe})`
        : 'Periksa 10 lingkaran biru, lalu tekan Tambah Kolom.';

  return (
    <div className="space-y-4">
      {/* Indikator tahapan 1..6 */}
      <nav aria-label="Tahapan membuat template" className="overflow-x-auto pb-1">
        <ol className="grid grid-cols-6 gap-1.5 min-w-[300px]">
          {DAFTAR_LANGKAH.map((item) => {
            const aktif = langkah === item.nomor;
            const selesai = langkah > item.nomor;
            const bisa = bisaKlikLangkah(item.nomor);
            return (
              <li key={item.nomor}>
                <button
                  type="button"
                  disabled={!bisa || sedangProses}
                  aria-current={aktif ? 'step' : undefined}
                  onClick={() => {
                    if (bisa) pindahLangkah(item.nomor);
                  }}
                  className={`flex min-h-12 w-full flex-col items-center justify-center rounded-xl border px-1 py-1.5 text-center transition-colors ${
                    aktif
                      ? 'border-blue-900 bg-blue-900 text-white font-bold shadow-xs'
                      : selesai
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-950 font-bold hover:bg-emerald-100'
                        : bisa
                          ? 'border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
                          : 'border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed'
                  }`}
                >
                  <span className="text-xs leading-none">
                    {selesai ? '✓' : item.nomor}
                  </span>
                  <span className="mt-1 text-[10px] leading-tight">
                    {item.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Status pemrosesan */}
      {sedangProses ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-3.5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-blue-950"
        >
          <progress
            aria-label={pesanProses || 'Sedang memproses...'}
            className="loading-spinner shrink-0"
          />
          <p className="text-sm font-bold">
            {pesanProses || 'Sedang memproses...'}
          </p>
        </div>
      ) : null}

      {/* Pesan galat */}
      {galatUmum ? (
        <div
          role="alert"
          className="flex items-start justify-between gap-3 rounded-2xl border border-red-300 bg-red-50 p-4 text-sm font-medium text-red-950"
        >
          <span>{galatUmum}</span>
          <button
            type="button"
            onClick={() => setGalatUmum(null)}
            className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-xl px-2.5 text-xs font-bold hover:bg-red-100"
          >
            Tutup
          </button>
        </div>
      ) : null}

      {/* ==================== LANGKAH 1: NAMA & DASAR ==================== */}
      {langkah === 1 ? (
        <form
          onSubmit={handleLanjutLangkah1}
          noValidate
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-5"
        >
          <div>
            <h2
              ref={judulLangkahRef}
              tabIndex={-1}
              className="text-lg font-bold text-slate-900 focus:outline-none"
            >
              Langkah 1: Nama &amp; Dasar Template
            </h2>
            <p className="mt-1 text-sm text-slate-700">
              Beri nama yang mudah diingat agar template ini bisa dipakai
              berulang kali untuk berbagai ujian.
            </p>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="nama-template"
              className="block text-sm font-bold text-slate-900"
            >
              Nama Template <span aria-hidden="true">*</span>
            </label>
            <input
              ref={inputNamaRef}
              id="nama-template"
              name="namaTemplate"
              type="text"
              required
              enterKeyHint="next"
              value={nama}
              onChange={(e) => {
                setNama(e.target.value);
                if (galatLangkah1.nama) {
                  setGalatLangkah1((prev) => ({ ...prev, nama: undefined }));
                }
              }}
              aria-invalid={Boolean(galatLangkah1.nama)}
              aria-describedby={
                galatLangkah1.nama ? 'galat-nama-template' : 'bantuan-nama'
              }
              placeholder="Contoh: LJK PTS 40 Soal"
              className="min-h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3.5 text-base font-medium text-slate-900"
            />
            {galatLangkah1.nama ? (
              <p
                id="galat-nama-template"
                role="alert"
                className="text-sm font-semibold text-red-700"
              >
                {galatLangkah1.nama}
              </p>
            ) : (
              <p id="bantuan-nama" className="text-xs text-slate-600">
                Misalnya: LJK Ulangan 40 Soal atau LJK Sekolah 50 Soal.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <label
              htmlFor="jumlah-soal"
              className="block text-sm font-bold text-slate-900"
            >
              Jumlah Soal Total <span aria-hidden="true">*</span>
            </label>
            <input
              ref={inputJumlahSoalRef}
              id="jumlah-soal"
              name="jumlahSoal"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              required
              enterKeyHint="done"
              value={jumlahSoalTeks}
              onChange={(e) => {
                const hanyaAngka = e.target.value.replace(/[^0-9]/g, '');
                setJumlahSoalTeks(hanyaAngka);
                if (galatLangkah1.jumlahSoal) {
                  setGalatLangkah1((prev) => ({
                    ...prev,
                    jumlahSoal: undefined,
                  }));
                }
              }}
              aria-invalid={Boolean(galatLangkah1.jumlahSoal)}
              aria-describedby={
                galatLangkah1.jumlahSoal ? 'galat-jumlah-soal' : undefined
              }
              className="min-h-12 w-full rounded-xl border-2 border-slate-300 bg-white px-3.5 text-base font-bold text-slate-900"
            />
            {galatLangkah1.jumlahSoal ? (
              <p
                id="galat-jumlah-soal"
                role="alert"
                className="text-sm font-semibold text-red-700"
              >
                {galatLangkah1.jumlahSoal}
              </p>
            ) : null}

            <div className="grid grid-cols-4 gap-2" role="group" aria-label="Pilihan cepat jumlah soal">
              {[20, 30, 40, 50].map((angka) => (
                <button
                  key={angka}
                  type="button"
                  onClick={() => {
                    setJumlahSoalTeks(String(angka));
                    setGalatLangkah1((prev) => ({
                      ...prev,
                      jumlahSoal: undefined,
                    }));
                  }}
                  className={`min-h-12 rounded-xl border text-sm font-bold transition-colors ${
                    jumlahSoalTeks === String(angka)
                      ? 'border-blue-900 bg-blue-50 text-blue-950'
                      : 'border-slate-300 bg-slate-50 text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  {angka} soal
                </button>
              ))}
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-bold text-slate-900">
              Jumlah Pilihan Jawaban
            </legend>
            <div className="grid grid-cols-2 gap-2.5">
              {([4, 5] as const).map((jml) => (
                <label
                  key={jml}
                  htmlFor={`pilihan-${jml}`}
                  className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl border-2 px-3.5 py-2.5 text-sm font-bold ${
                    jumlahPilihan === jml
                      ? 'border-blue-900 bg-blue-50 text-blue-950'
                      : 'border-slate-200 bg-white text-slate-800'
                  }`}
                >
                  <input
                    id={`pilihan-${jml}`}
                    type="radio"
                    name="jumlahPilihan"
                    value={jml}
                    checked={jumlahPilihan === jml}
                    onChange={() => setJumlahPilihan(jml)}
                    className="h-5 w-5 shrink-0"
                  />
                  <span>{jml === 4 ? 'A sampai D (4)' : 'A sampai E (5)'}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="text-sm font-bold text-slate-900">
              Ciri Pojok Lembar LJK
            </legend>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <label
                htmlFor="penanda-kotak"
                className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl border-2 px-3.5 py-3 text-sm font-bold ${
                  jenisPenanda === 'penanda-sudut'
                    ? 'border-blue-900 bg-blue-50 text-blue-950'
                    : 'border-slate-200 bg-white text-slate-800'
                }`}
              >
                <input
                  id="penanda-kotak"
                  type="radio"
                  name="jenisPenanda"
                  value="penanda-sudut"
                  checked={jenisPenanda === 'penanda-sudut'}
                  onChange={() => setJenisPenanda('penanda-sudut')}
                  className="h-5 w-5 shrink-0"
                />
                <span>Ada 4 kotak hitam di pojok</span>
              </label>

              <label
                htmlFor="penanda-tepi"
                className={`flex min-h-12 cursor-pointer items-center gap-2.5 rounded-xl border-2 px-3.5 py-3 text-sm font-bold ${
                  jenisPenanda === 'tepi-kertas'
                    ? 'border-blue-900 bg-blue-50 text-blue-950'
                    : 'border-slate-200 bg-white text-slate-800'
                }`}
              >
                <input
                  id="penanda-tepi"
                  type="radio"
                  name="jenisPenanda"
                  value="tepi-kertas"
                  checked={jenisPenanda === 'tepi-kertas'}
                  onChange={() => setJenisPenanda('tepi-kertas')}
                  className="h-5 w-5 shrink-0"
                />
                <span>Tepi kertas biasa (tanpa kotak)</span>
              </label>
            </div>
          </fieldset>

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={onBatal}
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-base font-bold text-slate-900 hover:bg-slate-200"
            >
              Batal
            </button>
            <button
              type="submit"
              className="inline-flex min-h-12 flex-[2] items-center justify-center gap-1.5 rounded-xl bg-blue-900 px-4 py-3 text-base font-bold text-white hover:bg-blue-800 active:bg-blue-950"
            >
              <span>Lanjut: Foto LJK</span>
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </form>
      ) : null}

      {/* ==================== LANGKAH 2: FOTO LJK KOSONG ==================== */}
      {langkah === 2 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div>
            <h2
              ref={judulLangkahRef}
              tabIndex={-1}
              className="text-lg font-bold text-slate-900 focus:outline-none"
            >
              Langkah 2: Foto LJK Kosong
            </h2>
            <p className="mt-1 text-sm text-slate-700">
              Potret satu lembar LJK yang masih kosong (belum diisi siswa) untuk
              dijadikan acuan letak bulatan.
            </p>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950 space-y-1.5">
            <p className="font-bold">Panduan pengambilan foto:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Letakkan kertas rata di atas meja (sebaiknya meja gelap).</li>
              <li>Pastikan cahaya merata dan tidak tertutup bayangan tangan.</li>
              <li>Foto lurus dari atas agar keempat pojok kertas masuk bingkai.</li>
            </ul>
          </div>

          {fotoLurusUrl ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 space-y-3">
              <p className="text-sm font-bold text-emerald-950">
                Foto LJK kosong sudah tersedia:
              </p>
              <img
                src={fotoLurusUrl}
                alt="Pratinjau foto LJK kosong yang tersimpan"
                className="mx-auto max-h-52 max-w-full rounded-lg border border-emerald-300 object-contain"
              />
              <button
                type="button"
                onClick={() => pindahLangkah(4)}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-base font-bold text-white hover:bg-emerald-800"
              >
                <span>Pakai Foto Ini &amp; Lanjut Tandai Blok</span>
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          ) : null}

          <div className="space-y-2.5">
            <button
              type="button"
              disabled={sedangProses}
              onClick={() => inputKameraKosongRef.current?.click()}
              className="inline-flex min-h-14 w-full items-center justify-center gap-2.5 rounded-xl bg-blue-900 px-4 py-3 text-base font-bold text-white hover:bg-blue-800 active:bg-blue-950 disabled:opacity-50"
            >
              <Camera className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>Ambil Foto dari Kamera</span>
            </button>

            <button
              type="button"
              disabled={sedangProses}
              onClick={() => inputGaleriKosongRef.current?.click()}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2.5 rounded-xl border-2 border-blue-900 bg-white px-4 py-3 text-base font-bold text-blue-900 hover:bg-blue-50 disabled:opacity-50"
            >
              <Upload className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span>Unggah Foto dari Galeri</span>
            </button>

            <button
              type="button"
              disabled={sedangProses}
              onClick={() => {
                void handlePakaiContohKosong();
              }}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-100 disabled:opacity-50"
            >
              <span>Atau Pakai Contoh LJK Kosong (40 Soal) untuk Latihan</span>
            </button>

            <input
              ref={inputKameraKosongRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                void handlePilihFotoKosong(e);
              }}
              className="sr-only"
              aria-label="Ambil foto LJK kosong dengan kamera"
            />
            <input
              ref={inputGaleriKosongRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                void handlePilihFotoKosong(e);
              }}
              className="sr-only"
              aria-label="Unggah foto LJK kosong dari galeri"
            />
          </div>

          <button
            type="button"
            onClick={() => pindahLangkah(1)}
            className="inline-flex min-h-12 w-full items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-base font-bold text-slate-900 hover:bg-slate-200"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            <span>Kembali ke Langkah 1</span>
          </button>
        </section>
      ) : null}

      {/* ==================== LANGKAH 3: LURUSKAN KERTAS ==================== */}
      {langkah === 3 && fotoMentahUrl && fotoMentahRgba && sudut ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div>
            <h2
              ref={judulLangkahRef}
              tabIndex={-1}
              className="text-lg font-bold text-slate-900 focus:outline-none"
            >
              Langkah 3: Luruskan Kertas
            </h2>
            <p className="mt-1 text-sm text-slate-700">
              Pastikan keempat lingkaran biru jatuh tepat di 4{' '}
              {jenisPenanda === 'penanda-sudut'
                ? 'pusat kotak hitam sudut'
                : 'pojok kertas LJK'}
              .
            </p>
          </div>

          {infoDeteksiSudut ? (
            <div className="rounded-xl bg-blue-50 px-3.5 py-2.5 text-xs font-medium text-blue-950">
              {infoDeteksiSudut}
            </div>
          ) : null}

          <CornerAdjuster
            fotoUrl={fotoMentahUrl}
            lebarGambar={fotoMentahRgba.lebar}
            tinggiGambar={fotoMentahRgba.tinggi}
            sudut={sudut}
            onChange={setSudut}
          />

          <button
            type="button"
            disabled={sedangProses}
            onClick={() => {
              void handleDeteksiUlangSudut();
            }}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-100"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            <span>Deteksi Ulang Otomatis</span>
          </button>

          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              onClick={() => pindahLangkah(2)}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-1 rounded-xl border border-slate-300 bg-slate-100 px-3 py-3 text-base font-bold text-slate-900 hover:bg-slate-200"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              <span>Ganti Foto</span>
            </button>
            <button
              type="button"
              disabled={sedangProses}
              onClick={() => {
                void handleLuruskanDanLanjut();
              }}
              className="inline-flex min-h-12 flex-[2] items-center justify-center gap-1.5 rounded-xl bg-blue-900 px-4 py-3 text-base font-bold text-white hover:bg-blue-800 active:bg-blue-950 disabled:opacity-50"
            >
              <span>Luruskan &amp; Lanjut</span>
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </section>
      ) : null}

      {/* ==================== LANGKAH 4: TANDAI BLOK JAWABAN ==================== */}
      {langkah === 4 && fotoLurusUrl ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div>
            <h2
              ref={judulLangkahRef}
              tabIndex={-1}
              className="text-lg font-bold text-slate-900 focus:outline-none"
            >
              Langkah 4: Tandai Blok Jawaban
            </h2>
            <p className="mt-1 text-sm text-slate-700">
              Satu blok adalah satu kolom nomor (misalnya nomor 1–10). Ketuk
              bulatan pertama dan terakhir, lalu aplikasi menghitung semua
              bulatan lain secara otomatis.
            </p>
          </div>

          {/* Progres cakupan soal */}
          <div
            className={`flex items-center gap-2.5 rounded-xl border px-3.5 py-3 text-sm font-bold ${
              validasiBlok.lengkap
                ? 'border-emerald-300 bg-emerald-50 text-emerald-950'
                : 'border-amber-300 bg-amber-50 text-amber-950'
            }`}
          >
            {validasiBlok.lengkap ? (
              <CheckCircle2
                className="h-5 w-5 shrink-0 text-emerald-700"
                aria-hidden="true"
              />
            ) : (
              <Crosshair
                className="h-5 w-5 shrink-0 text-amber-700"
                aria-hidden="true"
              />
            )}
            <span>{validasiBlok.pesanRingkas}</span>
          </div>

          {/* Pengaturan blok yang sedang ditandai */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-3">
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <label
                  htmlFor="blok-nomor-awal"
                  className="block text-xs font-bold text-slate-900"
                >
                  Nomor Awal Blok
                </label>
                <input
                  id="blok-nomor-awal"
                  type="number"
                  min={1}
                  max={jumlahSoalAngka}
                  value={draftJawaban.nomorAwal}
                  onChange={(e) =>
                    setDraftJawaban((prev) => ({
                      ...prev,
                      nomorAwal: Math.max(1, Number(e.target.value) || 1),
                    }))
                  }
                  className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-bold text-slate-900"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="blok-jumlah-nomor"
                  className="block text-xs font-bold text-slate-900"
                >
                  Jumlah Nomor di Blok
                </label>
                <input
                  id="blok-jumlah-nomor"
                  type="number"
                  min={1}
                  max={jumlahSoalAngka}
                  value={draftJawaban.jumlahNomor}
                  onChange={(e) =>
                    setDraftJawaban((prev) => ({
                      ...prev,
                      jumlahNomor: Math.max(1, Number(e.target.value) || 1),
                    }))
                  }
                  className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-base font-bold text-slate-900"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                <label htmlFor="radius-bulatan-jawaban">
                  Ukuran lingkaran bantu
                </label>
                <span className="rounded bg-blue-100 px-2 py-0.5 text-blue-950">
                  Ukuran {draftJawaban.radiusBulatan}
                </span>
              </div>
              <input
                id="radius-bulatan-jawaban"
                type="range"
                min={5}
                max={28}
                step={1}
                value={draftJawaban.radiusBulatan}
                onChange={(e) =>
                  setDraftJawaban((prev) => ({
                    ...prev,
                    radiusBulatan: Number(e.target.value),
                  }))
                }
                className="h-12 w-full cursor-pointer"
              />
            </div>

            {/* Pemilih titik yang sedang diketuk */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTargetKetukJawaban('pertama')}
                aria-pressed={targetKetukJawaban === 'pertama'}
                className={`min-h-12 rounded-xl border-2 px-2.5 py-2 text-xs font-bold transition-colors ${
                  targetKetukJawaban === 'pertama'
                    ? 'border-orange-600 bg-orange-50 text-orange-950'
                    : 'border-slate-300 bg-white text-slate-800'
                }`}
              >
                1. Titik No. {draftJawaban.nomorAwal}A{' '}
                {draftJawaban.titikPertama ? '✓' : ''}
              </button>
              <button
                type="button"
                onClick={() => setTargetKetukJawaban('terakhir')}
                aria-pressed={targetKetukJawaban === 'terakhir'}
                className={`min-h-12 rounded-xl border-2 px-2.5 py-2 text-xs font-bold transition-colors ${
                  targetKetukJawaban === 'terakhir'
                    ? 'border-sky-600 bg-sky-50 text-sky-950'
                    : 'border-slate-300 bg-white text-slate-800'
                }`}
              >
                2. Titik No. {nomorAkhirDraft}
                {hurufPilihanTerakhir} {draftJawaban.titikTerakhir ? '✓' : ''}
              </button>
            </div>
          </div>

          {/* Kanvas ketuk gambar lurus */}
          <BubbleGridMarker
            mode="jawaban"
            fotoLurusUrl={fotoLurusUrl}
            ukuranStandar={ukuranStandar}
            blokJawabanTersimpan={blokJawaban}
            blokIdentitasTersimpan={blokIdentitas}
            draftJawaban={draftJawaban}
            ketukanAktif
            labelPanduanKetuk={labelPanduanJawaban}
            onKetukGambar={handleKetukGambarJawaban}
          />

          {/* Geser halus titik aktif (nudge 2px) */}
          {(targetKetukJawaban === 'pertama' && draftJawaban.titikPertama) ||
          (targetKetukJawaban === 'terakhir' && draftJawaban.titikTerakhir) ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <span className="text-xs font-bold text-slate-800">
                Geser halus titik{' '}
                {targetKetukJawaban === 'pertama' ? 'pertama' : 'terakhir'}:
              </span>
              <div className="flex items-center gap-1.5">
                {[
                  { label: '←', nama: 'kiri', dx: -2, dy: 0 },
                  { label: '↑', nama: 'atas', dx: 0, dy: -2 },
                  { label: '↓', nama: 'bawah', dx: 0, dy: 2 },
                  { label: '→', nama: 'kanan', dx: 2, dy: 0 },
                ].map((btn) => (
                  <button
                    key={btn.nama}
                    type="button"
                    aria-label={`Geser ke ${btn.nama}`}
                    onClick={() =>
                      handleGeserTitikJawaban(
                        targetKetukJawaban,
                        btn.dx,
                        btn.dy,
                      )
                    }
                    className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl border border-slate-300 bg-white text-base font-bold text-slate-900 hover:bg-slate-100"
                  >
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* Tombol simpan blok draft */}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={!draftJawaban.titikPertama && !draftJawaban.titikTerakhir}
              onClick={() => {
                setDraftJawaban((prev) => ({
                  ...prev,
                  titikPertama: null,
                  titikTerakhir: null,
                }));
                setTargetKetukJawaban('pertama');
              }}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-slate-200 disabled:opacity-45"
            >
              <Undo2 className="h-4 w-4" aria-hidden="true" />
              <span>Ulangi Titik Blok Ini</span>
            </button>

            <button
              type="button"
              disabled={!draftJawaban.titikPertama || !draftJawaban.titikTerakhir}
              onClick={handleTambahBlokJawaban}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-45"
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
              <span>
                Tambah Blok No. {draftJawaban.nomorAwal}–{nomorAkhirDraft}
              </span>
            </button>
          </div>

          {/* Daftar blok tersimpan */}
          {blokJawaban.length > 0 ? (
            <div className="space-y-2 border-t border-slate-200 pt-3">
              <h3 className="text-sm font-bold text-slate-900">
                Blok yang Sudah Ditambahkan ({blokJawaban.length})
              </h3>
              <ul className="space-y-2">
                {blokJawaban.map((blok, idx) => (
                  <li
                    key={`blok-${idx}-${blok.nomorAwal}`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2"
                  >
                    <div className="text-sm">
                      <p className="font-bold text-slate-900">
                        Blok {idx + 1}: Nomor {blok.nomorAwal}–
                        {blok.nomorAwal + blok.jumlahNomor - 1}
                      </p>
                      <p className="text-xs text-slate-700">
                        {blok.jumlahNomor} soal &middot; Pilihan A–
                        {HURUF_PILIHAN[blok.jumlahPilihan - 1]} &middot; Ukuran
                        bulatan {blok.radiusBulatan}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Hapus Blok ${idx + 1} Nomor ${blok.nomorAwal} sampai ${blok.nomorAwal + blok.jumlahNomor - 1}`}
                      onClick={() => handleHapusBlokJawaban(idx)}
                      className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-xl text-red-700 hover:bg-red-100"
                    >
                      <Trash2 className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => pindahLangkah(fotoMentahUrl && sudut ? 3 : 2)}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-1 rounded-xl border border-slate-300 bg-slate-100 px-3 py-3 text-base font-bold text-slate-900 hover:bg-slate-200"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              <span>Kembali</span>
            </button>
            <button
              type="button"
              onClick={handleLanjutDariBlokJawaban}
              className="inline-flex min-h-12 flex-[2] items-center justify-center gap-1.5 rounded-xl bg-blue-900 px-4 py-3 text-base font-bold text-white hover:bg-blue-800 active:bg-blue-950"
            >
              <span>Lanjut: Area Identitas</span>
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </section>
      ) : null}

      {/* ==================== LANGKAH 5: AREA IDENTITAS (OPSIONAL) ==================== */}
      {langkah === 5 && fotoLurusUrl ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div>
            <h2
              ref={judulLangkahRef}
              tabIndex={-1}
              className="text-lg font-bold text-slate-900 focus:outline-none"
            >
              Langkah 5: Area Identitas Siswa (Opsional)
            </h2>
            <p className="mt-1 text-sm text-slate-700">
              Jika LJK sekolah Anda punya kolom bulatan nomor induk / nomor
              peserta (digit 0–9), tandai tiap kolomnya di sini. Jika tidak ada,
              langsung tekan tombol <strong>Lewati &amp; Uji Template</strong>.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-slate-900">
                <label htmlFor="radius-bulatan-id">
                  Ukuran bulatan digit (Kolom {draftIdentitas.kolomKe})
                </label>
                <span className="rounded bg-blue-100 px-2 py-0.5 text-blue-950">
                  Ukuran {draftIdentitas.radiusBulatan}
                </span>
              </div>
              <input
                id="radius-bulatan-id"
                type="range"
                min={5}
                max={22}
                step={1}
                value={draftIdentitas.radiusBulatan}
                onChange={(e) =>
                  setDraftIdentitas((prev) => ({
                    ...prev,
                    radiusBulatan: Number(e.target.value),
                  }))
                }
                className="h-12 w-full cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTargetKetukIdentitas('pertama')}
                aria-pressed={targetKetukIdentitas === 'pertama'}
                className={`min-h-12 rounded-xl border-2 px-2.5 py-2 text-xs font-bold ${
                  targetKetukIdentitas === 'pertama'
                    ? 'border-orange-600 bg-orange-50 text-orange-950'
                    : 'border-slate-300 bg-white text-slate-800'
                }`}
              >
                1. Angka 0 (atas) {draftIdentitas.titikPertama ? '✓' : ''}
              </button>
              <button
                type="button"
                onClick={() => setTargetKetukIdentitas('terakhir')}
                aria-pressed={targetKetukIdentitas === 'terakhir'}
                className={`min-h-12 rounded-xl border-2 px-2.5 py-2 text-xs font-bold ${
                  targetKetukIdentitas === 'terakhir'
                    ? 'border-sky-600 bg-sky-50 text-sky-950'
                    : 'border-slate-300 bg-white text-slate-800'
                }`}
              >
                2. Angka 9 (bawah) {draftIdentitas.titikTerakhir ? '✓' : ''}
              </button>
            </div>
          </div>

          <BubbleGridMarker
            mode="identitas"
            fotoLurusUrl={fotoLurusUrl}
            ukuranStandar={ukuranStandar}
            blokJawabanTersimpan={blokJawaban}
            blokIdentitasTersimpan={blokIdentitas}
            draftIdentitas={draftIdentitas}
            ketukanAktif
            labelPanduanKetuk={labelPanduanIdentitas}
            onKetukGambar={handleKetukGambarIdentitas}
          />

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={
                !draftIdentitas.titikPertama && !draftIdentitas.titikTerakhir
              }
              onClick={() => {
                setDraftIdentitas((prev) => ({
                  ...prev,
                  titikPertama: null,
                  titikTerakhir: null,
                }));
                setTargetKetukIdentitas('pertama');
              }}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-900 hover:bg-slate-200 disabled:opacity-45"
            >
              <Undo2 className="h-4 w-4" aria-hidden="true" />
              <span>Ulangi Kolom Ini</span>
            </button>

            <button
              type="button"
              disabled={
                !draftIdentitas.titikPertama || !draftIdentitas.titikTerakhir
              }
              onClick={handleTambahKolomIdentitas}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-purple-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-purple-800 disabled:opacity-45"
            >
              <Plus className="h-5 w-5" aria-hidden="true" />
              <span>Tambah Kolom Digit {draftIdentitas.kolomKe}</span>
            </button>
          </div>

          {blokIdentitas.length > 0 ? (
            <div className="space-y-2 border-t border-slate-200 pt-3">
              <h3 className="text-sm font-bold text-slate-900">
                Kolom Identitas ({blokIdentitas.length} digit)
              </h3>
              <ul className="space-y-2">
                {blokIdentitas.map((kolom, idx) => (
                  <li
                    key={`id-col-${kolom.kolomKe}`}
                    className="flex items-center justify-between gap-2 rounded-xl border border-purple-200 bg-purple-50/70 px-3.5 py-2"
                  >
                    <span className="text-sm font-bold text-slate-900">
                      Kolom Digit ke-{kolom.kolomKe} (angka 0–9)
                    </span>
                    <button
                      type="button"
                      aria-label={`Hapus kolom digit ke-${kolom.kolomKe}`}
                      onClick={() => handleHapusKolomIdentitas(idx)}
                      className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-xl text-red-700 hover:bg-red-100"
                    >
                      <Trash2 className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => pindahLangkah(4)}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-1 rounded-xl border border-slate-300 bg-slate-100 px-3 py-3 text-base font-bold text-slate-900 hover:bg-slate-200"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              <span>Kembali</span>
            </button>
            <button
              type="button"
              onClick={() => pindahLangkah(6)}
              className="inline-flex min-h-12 flex-[2] items-center justify-center gap-1.5 rounded-xl bg-blue-900 px-4 py-3 text-base font-bold text-white hover:bg-blue-800 active:bg-blue-950"
            >
              <span>
                {blokIdentitas.length === 0
                  ? 'Lewati & Uji Template'
                  : 'Lanjut: Uji Template'}
              </span>
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </section>
      ) : null}

      {/* ==================== LANGKAH 6: UJI TEMPLATE & SIMPAN ==================== */}
      {langkah === 6 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div>
            <h2
              ref={judulLangkahRef}
              tabIndex={-1}
              className="text-lg font-bold text-slate-900 focus:outline-none"
            >
              Langkah 6: Uji Template &amp; Simpan
            </h2>
            <p className="mt-1 text-sm text-slate-700">
              Potret satu lembar LJK yang sudah diisi untuk memastikan posisi
              bulatan terbaca tepat. Jika sudah sesuai, tekan{' '}
              <strong>Simpan Template</strong>.
            </p>
          </div>

          {/* Ringkasan template */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-800 space-y-1">
            <p className="font-bold text-slate-900">{nama.trim()}</p>
            <p>
              {jumlahSoalAngka} soal &middot; {blokJawaban.length} blok &middot;
              Pilihan A–{hurufPilihanTerakhir}
              {blokIdentitas.length > 0
                ? ` · Identitas ${blokIdentitas.length} digit`
                : ''}
            </p>
          </div>

          {/* Tombol uji template */}
          <div className="space-y-2.5">
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                disabled={sedangProses}
                onClick={() => inputKameraUjiRef.current?.click()}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-blue-900 bg-white px-4 py-3 text-sm font-bold text-blue-900 hover:bg-blue-50 disabled:opacity-50"
              >
                <Camera className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>Foto LJK Terisi</span>
              </button>
              <button
                type="button"
                disabled={sedangProses}
                onClick={() => inputGaleriUjiRef.current?.click()}
                className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-blue-900 bg-white px-4 py-3 text-sm font-bold text-blue-900 hover:bg-blue-50 disabled:opacity-50"
              >
                <Upload className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span>Unggah LJK Terisi</span>
              </button>
            </div>

            <button
              type="button"
              disabled={sedangProses}
              onClick={() => {
                void handleSimulasiUjiTemplate();
              }}
              className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-bold text-slate-800 hover:bg-slate-100 disabled:opacity-50"
            >
              <span>Uji Cepat dengan Simulasi LJK Terisi</span>
            </button>

            <input
              ref={inputKameraUjiRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => {
                void handlePilihFotoUji(e);
              }}
              className="sr-only"
              aria-label="Potret LJK terisi untuk menguji template"
            />
            <input
              ref={inputGaleriUjiRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                void handlePilihFotoUji(e);
              }}
              className="sr-only"
              aria-label="Unggah foto LJK terisi untuk menguji template"
            />
          </div>

          {/* Hasil Uji Template */}
          {hasilUji ? (
            <div className="space-y-3 border-t border-slate-200 pt-4">
              {hasilUji.hasil.peringatan.length > 0 ? (
                <div
                  role="alert"
                  className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-sm text-amber-950 space-y-1"
                >
                  <div className="flex items-center gap-2 font-bold">
                    <AlertTriangle
                      className="h-5 w-5 shrink-0 text-amber-700"
                      aria-hidden="true"
                    />
                    <span>Catatan Pengujian</span>
                  </div>
                  <ul className="list-disc pl-5 space-y-1">
                    {hasilUji.hasil.peringatan.map((p, i) => (
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
                    Uji template selesai dalam{' '}
                    {formatDetik(hasilUji.hasil.waktuProsesMs)}. Periksa
                    kecocokan lingkaran di foto bawah.
                  </span>
                </div>
              )}

              {hasilUji.hasil.identitas ? (
                <p className="text-sm text-slate-800">
                  <strong>Identitas siswa terbaca:</strong>{' '}
                  <span className="rounded bg-purple-100 px-2 py-0.5 font-bold text-purple-950">
                    {hasilUji.hasil.identitas.nilaiTerbaca}
                  </span>
                </p>
              ) : null}

              {hasilUji.fotoLurusUrl ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900">
                      Hasil Pembacaan pada Foto
                    </h3>
                    <button
                      type="button"
                      onClick={() => setTampilkanTandaUji((v) => !v)}
                      className="inline-flex min-h-12 items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-xs font-bold text-slate-900 hover:bg-slate-200"
                    >
                      {tampilkanTandaUji ? (
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
                      src={hasilUji.fotoLurusUrl}
                      alt="Foto LJK uji dengan tanda lingkaran hasil pembacaan"
                      className="block h-auto w-full"
                    />
                    {tampilkanTandaUji ? (
                      <svg
                        viewBox={`0 0 ${ukuranStandar.lebar} ${ukuranStandar.tinggi}`}
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 h-full w-full"
                      >
                        {hasilUji.hasil.hasilPerNomor.map((item) => (
                          <g key={`uji-no-${item.nomor}`}>
                            {item.bulatan.map((b) => {
                              const terbaca =
                                item.statusMentah === 'terjawab' &&
                                item.jawabanTerbaca === b.label;
                              const perluPerhatian =
                                item.statusMentah !== 'terjawab' &&
                                b.status !== 'kosong';
                              if (terbaca) {
                                return (
                                  <g key={`u-${item.nomor}-${b.label}`}>
                                    <circle
                                      cx={b.pusat.x}
                                      cy={b.pusat.y}
                                      r={b.radius + 4}
                                      fill="rgba(22, 163, 74, 0.25)"
                                      stroke="#15803d"
                                      strokeWidth="4"
                                    />
                                    <text
                                      x={b.pusat.x + b.radius + 6}
                                      y={b.pusat.y + 6}
                                      fill="#15803d"
                                      fontSize="19"
                                      fontWeight="bold"
                                    >
                                      ✓
                                    </text>
                                  </g>
                                );
                              }
                              if (perluPerhatian) {
                                return (
                                  <g key={`u-${item.nomor}-${b.label}`}>
                                    <circle
                                      cx={b.pusat.x}
                                      cy={b.pusat.y}
                                      r={b.radius + 4}
                                      fill="rgba(234, 179, 8, 0.28)"
                                      stroke="#a16207"
                                      strokeWidth="4"
                                    />
                                    <text
                                      x={b.pusat.x + b.radius + 6}
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
                              return null;
                            })}
                          </g>
                        ))}
                      </svg>
                    ) : null}
                  </div>

                  {/* Ringkasan jawaban terbaca per nomor */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <p className="mb-2 text-xs font-bold text-slate-800">
                      Jawaban terbaca per nomor:
                    </p>
                    <div className="grid grid-cols-5 gap-1.5 text-center text-xs">
                      {hasilUji.hasil.hasilPerNomor.map((item) => {
                        const tampil =
                          item.statusMentah === 'terjawab'
                            ? item.jawabanTerbaca
                            : item.statusMentah === 'kosong'
                              ? '-'
                              : '?';
                        return (
                          <div
                            key={`ring-${item.nomor}`}
                            className={`rounded-lg border px-1.5 py-1 font-bold ${
                              item.statusMentah === 'terjawab'
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
                                : 'border-amber-200 bg-amber-50 text-amber-950'
                            }`}
                          >
                            {item.nomor}. {tampil}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => pindahLangkah(5)}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-1 rounded-xl border border-slate-300 bg-slate-100 px-3 py-3 text-base font-bold text-slate-900 hover:bg-slate-200"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              <span>Kembali</span>
            </button>
            <button
              type="button"
              disabled={sedangProses}
              onClick={() => {
                void handleSimpanTemplate();
              }}
              className="inline-flex min-h-14 flex-[2] items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-base font-bold text-white shadow-sm hover:bg-emerald-800 active:bg-emerald-900 disabled:opacity-50"
            >
              <Check className="h-5 w-5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
              <span>{modeUbah ? 'Simpan Perubahan' : 'Simpan Template'}</span>
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
