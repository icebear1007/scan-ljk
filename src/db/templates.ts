import type { BlokJawaban, TemplateLJK } from '../types/ljk.ts';
import { buatId, db, type KoreksiLJKDatabase } from './database.ts';

export type InputSimpanTemplate = Omit<
  TemplateLJK,
  'id' | 'tanggalDibuat' | 'tanggalDiubah'
>;

export interface HasilValidasiBlok {
  lengkap: boolean;
  totalTercakup: number;
  nomorHilang: number[];
  nomorGanda: number[];
  nomorDiLuarBatas: number[];
  pesanRingkas: string;
}

export function validasiCakupanBlokJawaban(
  blokJawaban: BlokJawaban[],
  jumlahSoal: number,
): HasilValidasiBlok {
  const hitungan = new Map<number, number>();
  const nomorDiLuarBatas: number[] = [];

  for (const blok of blokJawaban) {
    for (let i = 0; i < blok.jumlahNomor; i++) {
      const no = blok.nomorAwal + i;
      if (no < 1 || no > jumlahSoal) {
        nomorDiLuarBatas.push(no);
      } else {
        hitungan.set(no, (hitungan.get(no) ?? 0) + 1);
      }
    }
  }

  const nomorHilang: number[] = [];
  const nomorGanda: number[] = [];

  for (let no = 1; no <= jumlahSoal; no++) {
    const jumlah = hitungan.get(no) ?? 0;
    if (jumlah === 0) nomorHilang.push(no);
    if (jumlah > 1) nomorGanda.push(no);
  }

  const totalTercakup = jumlahSoal - nomorHilang.length;
  const lengkap =
    blokJawaban.length > 0 &&
    nomorHilang.length === 0 &&
    nomorGanda.length === 0 &&
    nomorDiLuarBatas.length === 0;

  let pesanRingkas: string;
  if (lengkap) {
    pesanRingkas = `Semua ${jumlahSoal} soal sudah tertandai dengan lengkap.`;
  } else if (nomorGanda.length > 0) {
    pesanRingkas = `Ada nomor soal yang ditandai lebih dari sekali (contoh: no. ${nomorGanda.slice(0, 5).join(', ')}).`;
  } else if (nomorDiLuarBatas.length > 0) {
    pesanRingkas = `Ada nomor melebihi jumlah soal total (${jumlahSoal}).`;
  } else {
    pesanRingkas = `Baru ${totalTercakup} dari ${jumlahSoal} soal ditandai. Masih ada ${nomorHilang.length} nomor belum ditandai.`;
  }

  return {
    lengkap,
    totalTercakup,
    nomorHilang,
    nomorGanda,
    nomorDiLuarBatas,
    pesanRingkas,
  };
}

export function sarankanBlokBerikutnya(
  blokJawaban: BlokJawaban[],
  jumlahSoal: number,
): { nomorAwal: number; jumlahNomor: number } {
  const validasi = validasiCakupanBlokJawaban(blokJawaban, jumlahSoal);
  const nomorAwal = validasi.nomorHilang[0] ?? Math.min(jumlahSoal, 1);

  // Hitung berapa nomor berurutan yang masih kosong mulai dari nomorAwal
  let berurutanKosong = 0;
  const hilangSet = new Set(validasi.nomorHilang);
  for (let no = nomorAwal; no <= jumlahSoal && hilangSet.has(no); no++) {
    berurutanKosong++;
  }

  // Jika sebelumnya sudah ada blok, ikuti panjang blok terakhir (mis. 10 soal per kolom)
  const panjangSebelumnya =
    blokJawaban.length > 0
      ? blokJawaban[blokJawaban.length - 1].jumlahNomor
      : Math.min(10, jumlahSoal);

  const jumlahNomor = Math.max(
    1,
    Math.min(
      berurutanKosong > 0 ? berurutanKosong : jumlahSoal - nomorAwal + 1,
      panjangSebelumnya,
    ),
  );

  return { nomorAwal, jumlahNomor };
}

export async function simpanTemplateBaru(
  input: InputSimpanTemplate,
  database: KoreksiLJKDatabase = db,
): Promise<TemplateLJK> {
  const sekarang = new Date().toISOString();
  const template: TemplateLJK = {
    ...input,
    id: buatId(),
    nama: input.nama.trim(),
    tanggalDibuat: sekarang,
    tanggalDiubah: sekarang,
  };
  await database.templates.put(template);
  return template;
}

export async function perbaruiTemplate(
  id: string,
  perubahan: InputSimpanTemplate,
  database: KoreksiLJKDatabase = db,
): Promise<TemplateLJK> {
  const lama = await database.templates.get(id);
  if (!lama) {
    throw new Error('Template yang ingin diubah tidak ditemukan.');
  }
  const terbaru: TemplateLJK = {
    ...perubahan,
    id: lama.id,
    nama: perubahan.nama.trim(),
    tanggalDibuat: lama.tanggalDibuat,
    tanggalDiubah: new Date().toISOString(),
  };
  await database.templates.put(terbaru);
  return terbaru;
}

export async function duplikatTemplate(
  id: string,
  database: KoreksiLJKDatabase = db,
): Promise<TemplateLJK> {
  const asli = await database.templates.get(id);
  if (!asli) {
    throw new Error('Template yang ingin diduplikat tidak ditemukan.');
  }
  const sekarang = new Date().toISOString();
  const salinanGambar = asli.gambarContoh
    ? new Blob([await asli.gambarContoh.arrayBuffer()], {
        type: asli.gambarContoh.type,
      })
    : undefined;

  const salinan: TemplateLJK = {
    ...asli,
    id: buatId(),
    nama: `${asli.nama} (Salinan)`,
    blokJawaban: asli.blokJawaban.map((b) => ({
      ...b,
      titikBulatanPertama: { ...b.titikBulatanPertama },
      titikBulatanTerakhir: { ...b.titikBulatanTerakhir },
    })),
    ...(asli.blokNama
      ? {
          blokNama: {
            ...asli.blokNama,
            titikHurufAPertama: { ...asli.blokNama.titikHurufAPertama },
            titikHurufZTerakhir: { ...asli.blokNama.titikHurufZTerakhir },
          },
        }
      : {}),
    ...(asli.blokIdentitas
      ? {
          blokIdentitas: asli.blokIdentitas.map((b) => ({
            ...b,
            titikDigitPertama: { ...b.titikDigitPertama },
            titikDigitTerakhir: { ...b.titikDigitTerakhir },
          })),
        }
      : {}),
    ...(salinanGambar ? { gambarContoh: salinanGambar } : {}),
    tanggalDibuat: sekarang,
    tanggalDiubah: sekarang,
  };

  await database.templates.put(salinan);
  return salinan;
}

export async function hapusTemplate(
  id: string,
  database: KoreksiLJKDatabase = db,
): Promise<void> {
  await database.templates.delete(id);
}
