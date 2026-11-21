import type {
  BlokIdentitas,
  BlokJawaban,
  TemplateLJK,
  Titik,
} from '../types/ljk.ts';
import type { EmpatSudut } from './types.ts';

export const HURUF_PILIHAN = ['A', 'B', 'C', 'D', 'E'] as const;

export interface PosisiBulatanSoal {
  nomor: number;
  pilihan: Array<{
    label: string;
    pusat: Titik;
    radius: number;
  }>;
}

export interface PosisiKolomIdentitas {
  kolomKe: number;
  digit: Array<{
    label: string;
    pusat: Titik;
    radius: number;
  }>;
}

export function hitungPosisiBulatanBlok(
  blok: BlokJawaban,
): PosisiBulatanSoal[] {
  const hasil: PosisiBulatanSoal[] = [];
  const jumlahNomor = Math.max(1, Math.round(blok.jumlahNomor));
  const jumlahPilihan = Math.min(
    HURUF_PILIHAN.length,
    Math.max(2, Math.round(blok.jumlahPilihan)),
  );

  const dx = blok.titikBulatanTerakhir.x - blok.titikBulatanPertama.x;
  const dy = blok.titikBulatanTerakhir.y - blok.titikBulatanPertama.y;

  for (let baris = 0; baris < jumlahNomor; baris++) {
    const fraksiBaris = jumlahNomor > 1 ? baris / (jumlahNomor - 1) : 0;
    const y = blok.titikBulatanPertama.y + fraksiBaris * dy;

    const pilihan: PosisiBulatanSoal['pilihan'] = [];
    for (let kolom = 0; kolom < jumlahPilihan; kolom++) {
      const fraksiKolom =
        jumlahPilihan > 1 ? kolom / (jumlahPilihan - 1) : 0;
      const x = blok.titikBulatanPertama.x + fraksiKolom * dx;
      pilihan.push({
        label: HURUF_PILIHAN[kolom],
        pusat: { x, y },
        radius: blok.radiusBulatan,
      });
    }

    hasil.push({
      nomor: blok.nomorAwal + baris,
      pilihan,
    });
  }

  return hasil;
}

export function hitungPosisiSemuaSoal(
  template: TemplateLJK,
): PosisiBulatanSoal[] {
  const semua: PosisiBulatanSoal[] = [];
  for (const blok of template.blokJawaban) {
    semua.push(...hitungPosisiBulatanBlok(blok));
  }
  return semua.sort((a, b) => a.nomor - b.nomor);
}

export function hitungPosisiKolomIdentitas(
  blok: BlokIdentitas,
): PosisiKolomIdentitas {
  const jumlahDigit = Math.max(2, Math.round(blok.jumlahDigit));
  const dx = blok.titikDigitTerakhir.x - blok.titikDigitPertama.x;
  const dy = blok.titikDigitTerakhir.y - blok.titikDigitPertama.y;

  const digit: PosisiKolomIdentitas['digit'] = [];
  for (let i = 0; i < jumlahDigit; i++) {
    const fraksi = jumlahDigit > 1 ? i / (jumlahDigit - 1) : 0;
    digit.push({
      label: String(i),
      pusat: {
        x: blok.titikDigitPertama.x + fraksi * dx,
        y: blok.titikDigitPertama.y + fraksi * dy,
      },
      radius: blok.radiusBulatan,
    });
  }

  return {
    kolomKe: blok.kolomKe,
    digit,
  };
}

export function hitungPosisiSemuaIdentitas(
  template: TemplateLJK,
): PosisiKolomIdentitas[] {
  if (!template.blokIdentitas || template.blokIdentitas.length === 0) {
    return [];
  }
  return template.blokIdentitas
    .map(hitungPosisiKolomIdentitas)
    .sort((a, b) => a.kolomKe - b.kolomKe);
}

export function urutkanEmpatSudut(titik: Titik[]): EmpatSudut {
  if (titik.length !== 4) {
    throw new Error('Diperlukan tepat 4 titik sudut kertas.');
  }

  // Urutkan berdasarkan koordinat y (2 titik atas, 2 titik bawah)
  const urutY = [...titik].sort((a, b) => a.y - b.y);
  const duaAtas = urutY.slice(0, 2).sort((a, b) => a.x - b.x);
  const duaBawah = urutY.slice(2, 4).sort((a, b) => a.x - b.x);

  return {
    kiriAtas: duaAtas[0],
    kananAtas: duaAtas[1],
    kananBawah: duaBawah[1],
    kiriBawah: duaBawah[0],
  };
}

export function jarakTitik(a: Titik, b: Titik): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function luasSegiEmpat(sudut: EmpatSudut): number {
  const pts = [
    sudut.kiriAtas,
    sudut.kananAtas,
    sudut.kananBawah,
    sudut.kiriBawah,
  ];
  let jumlah = 0;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    jumlah += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(jumlah) / 2;
}

export function sudutGarisDerajat(a: Titik, b: Titik): number {
  return (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
}

export interface EvaluasiSegiEmpat {
  sah: boolean;
  rasioArea: number;
  kemiringanDerajat: number;
  rasioDistorsiSisi: number;
}

export function evaluasiGeometriSegiEmpat(
  sudut: EmpatSudut,
  lebarGambar: number,
  tinggiGambar: number,
): EvaluasiSegiEmpat {
  const areaGambar = Math.max(1, lebarGambar * tinggiGambar);
  const area = luasSegiEmpat(sudut);
  const rasioArea = area / areaGambar;

  const lebarAtas = jarakTitik(sudut.kiriAtas, sudut.kananAtas);
  const lebarBawah = jarakTitik(sudut.kiriBawah, sudut.kananBawah);
  const tinggiKiri = jarakTitik(sudut.kiriAtas, sudut.kiriBawah);
  const tinggiKanan = jarakTitik(sudut.kananAtas, sudut.kananBawah);

  const sisiTerkecil = Math.min(lebarAtas, lebarBawah, tinggiKiri, tinggiKanan);
  const batasSisiMin = Math.min(lebarGambar, tinggiGambar) * 0.15;

  const rasioLebar =
    Math.max(lebarAtas, lebarBawah) / Math.max(1, Math.min(lebarAtas, lebarBawah));
  const rasioTinggi =
    Math.max(tinggiKiri, tinggiKanan) /
    Math.max(1, Math.min(tinggiKiri, tinggiKanan));
  const rasioDistorsiSisi = Math.max(rasioLebar, rasioTinggi);

  const sudutAtas = Math.abs(sudutGarisDerajat(sudut.kiriAtas, sudut.kananAtas));
  const sudutBawah = Math.abs(
    sudutGarisDerajat(sudut.kiriBawah, sudut.kananBawah),
  );
  const kemiringanDerajat = Math.max(sudutAtas, sudutBawah);

  // Cek urutan cembung dasar (kiri harus di kiri kanan, atas di atas bawah)
  const urutanValid =
    sudut.kiriAtas.x < sudut.kananAtas.x &&
    sudut.kiriBawah.x < sudut.kananBawah.x &&
    sudut.kiriAtas.y < sudut.kiriBawah.y &&
    sudut.kananAtas.y < sudut.kananBawah.y;

  const sah =
    urutanValid &&
    rasioArea >= 0.15 &&
    sisiTerkecil >= batasSisiMin &&
    rasioDistorsiSisi <= 2.2;

  return {
    sah,
    rasioArea,
    kemiringanDerajat: Number(kemiringanDerajat.toFixed(1)),
    rasioDistorsiSisi: Number(rasioDistorsiSisi.toFixed(2)),
  };
}
