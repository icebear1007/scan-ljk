import type {
  PengaturanAplikasi,
  StatusJawaban,
  TemplateLJK,
  Titik,
} from '../types/ljk.ts';

export interface EmpatSudut {
  kiriAtas: Titik;
  kananAtas: Titik;
  kananBawah: Titik;
  kiriBawah: Titik;
}

export type MetodeDeteksiKertas =
  | 'penanda-sudut'
  | 'tepi-kertas'
  | 'manual'
  | 'gagal';

export type StatusBulatan = 'terisi' | 'kosong' | 'ragu';

export interface PengukuranBulatan {
  label: string;
  pusat: Titik;
  radius: number;
  rasioGelap: number;
  status: StatusBulatan;
}

export interface HasilBacaNomor {
  nomor: number;
  bulatan: PengukuranBulatan[];
  jawabanTerbaca: string;
  statusMentah: 'terjawab' | 'kosong' | 'ganda' | 'ragu';
}

export interface HasilBacaKolomIdentitas {
  kolomKe: number;
  digitTerbaca: string;
  ragu: boolean;
  bulatan: PengukuranBulatan[];
}

export interface HasilBacaIdentitas {
  nilaiTerbaca: string;
  perKolom: HasilBacaKolomIdentitas[];
}

export type KodePeringatanKualitas =
  | 'kertas-tidak-ditemukan'
  | 'terlalu-gelap'
  | 'terlalu-terang'
  | 'berbayang-kuat'
  | 'kontras-rendah'
  | 'banyak-ragu'
  | 'kemiringan-berlebihan'
  | 'posisi-bergeser';

export interface PeringatanKualitas {
  kode: KodePeringatanKualitas;
  pesan: string;
  perluFotoUlang: boolean;
}

export interface MetrikKualitasFoto {
  kecerahanRataRata: number;
  kontrasStdDev: number;
  rasioRagu: number;
  kemiringanDerajat: number;
  skorPergeseran: number;
}

export interface RingkasanPenilaian {
  benar: number;
  salah: number;
  kosong: number;
  perluDicek: number;
  nilai: number;
}

export interface GambarMentahRgba {
  lebar: number;
  tinggi: number;
  data: Uint8ClampedArray;
}

export interface HasilDeteksiKertas {
  berhasil: boolean;
  metode: MetodeDeteksiKertas;
  sudut: EmpatSudut | null;
  kemiringanDerajat: number;
  ukuranLurus?: TemplateLJK['ukuranStandar'];
  gambarLurus?: GambarMentahRgba;
  peringatan: PeringatanKualitas[];
  waktuProsesMs: number;
}

export interface HasilBacaLJK {
  berhasil: boolean;
  perluFotoUlang: boolean;
  peringatan: PeringatanKualitas[];
  metodeDeteksi: MetodeDeteksiKertas;
  sudutTerdeteksi: EmpatSudut | null;
  metrikKualitas: MetrikKualitasFoto;
  hasilPerNomor: HasilBacaNomor[];
  identitas?: HasilBacaIdentitas;
  jawabanTerbaca: string[];
  statusPerNomor: StatusJawaban[];
  ringkasanNilai?: RingkasanPenilaian;
  gambarLurus?: GambarMentahRgba;
  waktuProsesMs: number;
}

export interface OpsiBacaLJK {
  template: TemplateLJK;
  pengaturan: PengaturanAplikasi;
  kunciJawaban?: string[];
  sudutManual?: EmpatSudut;
  sertakanGambarLurus?: boolean;
}

export interface OpsiDeteksiKertas {
  jenisPenanda: TemplateLJK['jenisPenanda'];
  /** Jika dikosongkan, ukuran lurus dihitung otomatis mengikuti rasio asli kertas. */
  ukuranStandar?: TemplateLJK['ukuranStandar'];
  sudutManual?: EmpatSudut;
  sertakanGambarLurus?: boolean;
}
