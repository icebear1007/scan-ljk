export interface Titik {
  x: number;
  y: number;
}

export interface UkuranStandar {
  lebar: number;
  tinggi: number;
}

export type JenisPenanda = 'penanda-sudut' | 'tepi-kertas';

export interface BlokJawaban {
  nomorAwal: number;
  jumlahNomor: number;
  titikBulatanPertama: Titik;
  titikBulatanTerakhir: Titik;
  jumlahPilihan: number;
  radiusBulatan: number;
}

export interface BlokNama {
  jumlahKolom: number;
  /** Pusat bulatan huruf A pada kolom pertama (ujung kiri atas area nama). */
  titikHurufAPertama: Titik;
  /** Pusat bulatan huruf Z pada kolom terakhir (ujung kanan bawah area nama). */
  titikHurufZTerakhir: Titik;
  radiusBulatan: number;
}

export interface BlokIdentitas {
  kolomKe: number;
  titikDigitPertama: Titik;
  titikDigitTerakhir: Titik;
  jumlahDigit: number;
  radiusBulatan: number;
}

export interface TemplateLJK {
  id: string;
  nama: string;
  jumlahSoal: number;
  jumlahPilihan: 4 | 5;
  ukuranStandar: UkuranStandar;
  jenisPenanda: JenisPenanda;
  blokJawaban: BlokJawaban[];
  /** Area pendeteksi nama siswa (kisi kolom x huruf A-Z, kosong = spasi). */
  blokNama?: BlokNama;
  /** Dipertahankan opsional untuk kompatibilitas template lama. */
  blokIdentitas?: BlokIdentitas[];
  gambarContoh?: Blob;
  tanggalDibuat: string;
  tanggalDiubah: string;
}

export interface Ujian {
  id: string;
  nama: string;
  kelas: string;
  idTemplate: string;
  salinanTemplate: TemplateLJK;
  kunciJawaban: string[];
  tanggalDibuat: string;
}

export type StatusJawaban = 'benar' | 'salah' | 'kosong' | 'ganda' | 'ragu';

export interface HasilScan {
  id: string;
  idUjian: string;
  kelas: string;
  identitasSiswa: string;
  jawabanTerbaca: string[];
  jawabanSetelahKoreksi: string[];
  statusPerNomor: StatusJawaban[];
  benar: number;
  salah: number;
  kosong: number;
  perluDicek: number;
  nilai: number;
  fotoLurus?: Blob;
  tanggalScan: string;
}

export type SkalaNilai = 100 | 10;

export interface PengaturanAplikasi {
  id: 'utama';
  /** Rasio kegelapan minimal (0-1) agar bulatan dianggap terisi. Nilai awal 0,45. */
  ambangTerisi: number;
  /** Rasio kegelapan maksimal (0-1) agar bulatan dianggap kosong. Nilai awal 0,20. */
  ambangKosong: number;
  /** Batas persentase nomor ragu sebelum menyarankan foto ulang. Nilai awal 20%. */
  batasRaguPersen: number;
  /** Poin untuk jawaban benar. Nilai awal 1. */
  poinBenar: number;
  /** Poin untuk jawaban salah (termasuk ganda/ragu). Nilai awal 0. */
  poinSalah: number;
  /** Poin untuk jawaban kosong. Nilai awal 0. */
  poinKosong: number;
  /** Skala nilai akhir: 0-100 atau 0-10. */
  skalaNilai: SkalaNilai;
  /** Simpan foto LJK yang sudah diluruskan di perangkat. */
  simpanFotoScan: boolean;
  /** Tanggal ISO terakhir kali pengguna mengunduh file cadangan. */
  terakhirCadangan?: string;
}

export const PENGATURAN_AWAL: PengaturanAplikasi = {
  id: 'utama',
  ambangTerisi: 0.45,
  ambangKosong: 0.2,
  batasRaguPersen: 20,
  poinBenar: 1,
  poinSalah: 0,
  poinKosong: 0,
  skalaNilai: 100,
  simpanFotoScan: true,
};
