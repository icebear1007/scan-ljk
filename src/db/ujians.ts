import { HURUF_PILIHAN } from '../omr/geometry.ts';
import type { HasilBacaLJK } from '../omr/types.ts';
import type { TemplateLJK, Ujian } from '../types/ljk.ts';
import { buatId, db, type KoreksiLJKDatabase } from './database.ts';

export interface HasilParseKetikCepat {
  kunci: string[];
  hurufValidTerbaca: number;
  karakterTidakSah: string[];
  kelebihanHuruf: number;
}

export interface HasilEkstrakScanKunci {
  kunci: string[];
  nomorTerbaca: number;
  nomorPerluDilengkapi: number[];
}

export interface HasilValidasiKunci {
  lengkap: boolean;
  terisi: number;
  nomorKosong: number[];
  nomorTidakSah: number[];
  pesan: string;
}

export function daftarHurufSah(jumlahPilihan: 4 | 5): string[] {
  return [...HURUF_PILIHAN.slice(0, jumlahPilihan)];
}

export function buatKunciKosong(jumlahSoal: number): string[] {
  return Array.from({ length: Math.max(0, jumlahSoal) }, () => '');
}

/**
 * Menyesuaikan daftar kunci ketika template berubah (mis. jumlah soal atau
 * pilihan A-D vs A-E berubah).
 */
export function sesuaikanKunciKeTemplate(
  kunciLama: string[],
  jumlahSoal: number,
  jumlahPilihan: 4 | 5,
): string[] {
  const sah = new Set(daftarHurufSah(jumlahPilihan));
  const hasil = buatKunciKosong(jumlahSoal);
  for (let i = 0; i < Math.min(kunciLama.length, jumlahSoal); i++) {
    const huruf = (kunciLama[i] ?? '').trim().toUpperCase();
    hasil[i] = sah.has(huruf) ? huruf : '';
  }
  return hasil;
}

/**
 * Mengurai teks ketik cepat (mis. "ABCDEABCDE..." atau "A B C D E") menjadi
 * array kunci sepanjang jumlahSoal. Spasi, baris baru, koma, titik, strip, dan
 * angka nomor (seperti "1.A 2.B") diabaikan; huruf alfabet di luar pilihan sah
 * dicatat pada `karakterTidakSah`.
 */
export function parseKetikCepatKunci(
  teks: string,
  jumlahSoal: number,
  jumlahPilihan: 4 | 5,
): HasilParseKetikCepat {
  const sah = new Set(daftarHurufSah(jumlahPilihan));
  const hurufTerpilih: string[] = [];
  const tidakSahSet = new Set<string>();

  for (const ch of teks.toUpperCase()) {
    if (ch >= 'A' && ch <= 'Z') {
      if (sah.has(ch)) {
        hurufTerpilih.push(ch);
      } else {
        tidakSahSet.add(ch);
      }
    }
  }

  const kunci = buatKunciKosong(jumlahSoal);
  const batas = Math.min(hurufTerpilih.length, jumlahSoal);
  for (let i = 0; i < batas; i++) {
    kunci[i] = hurufTerpilih[i];
  }

  return {
    kunci,
    hurufValidTerbaca: hurufTerpilih.length,
    karakterTidakSah: [...tidakSahSet],
    kelebihanHuruf: Math.max(0, hurufTerpilih.length - jumlahSoal),
  };
}

/**
 * Mengubah array kunci menjadi string ketik cepat yang mudah dibaca dan diedit
 * (dikelompokkan per 5 atau 10 huruf jika utuh, atau kontinu bila ada kosong).
 */
export function formatKunciKeTeksCepat(kunci: string[]): string {
  const penuh = kunci.every((h) => h.length > 0);
  if (!penuh) {
    // Jika masih ada nomor kosong di tengah, tampilkan semua huruf yang sudah terisi berurutan
    return kunci.filter((h) => h.length > 0).join('');
  }
  const potongan: string[] = [];
  for (let i = 0; i < kunci.length; i += 5) {
    potongan.push(kunci.slice(i, i + 5).join(''));
  }
  return potongan.join(' ');
}

/**
 * Mengatur satu nomor jawaban pada mode Ketuk di Grid.
 */
export function aturSatuKunciGrid(
  kunciSaatIni: string[],
  nomorSatuBased: number,
  huruf: string,
  jumlahPilihan: 4 | 5,
): string[] {
  const indeks = nomorSatuBased - 1;
  if (indeks < 0 || indeks >= kunciSaatIni.length) return kunciSaatIni;

  const sah = new Set(daftarHurufSah(jumlahPilihan));
  const bersih = huruf.trim().toUpperCase();
  const nilaiBaru = bersih === '' ? '' : sah.has(bersih) ? bersih : '';

  const salinan = [...kunciSaatIni];
  salinan[indeks] = nilaiBaru;
  return salinan;
}

/**
 * Mengekstrak kunci jawaban dari hasil pembacaan LJK kunci oleh OpenCV.js.
 */
export function ekstrakKunciDariHasilScan(
  hasilScan: HasilBacaLJK,
  jumlahSoal: number,
  jumlahPilihan: 4 | 5,
): HasilEkstrakScanKunci {
  const sah = new Set(daftarHurufSah(jumlahPilihan));
  const kunci = buatKunciKosong(jumlahSoal);
  const nomorPerluDilengkapi: number[] = [];
  let nomorTerbaca = 0;

  for (let i = 0; i < jumlahSoal; i++) {
    const item = hasilScan.hasilPerNomor[i];
    if (
      item &&
      item.statusMentah === 'terjawab' &&
      sah.has(item.jawabanTerbaca.toUpperCase())
    ) {
      kunci[i] = item.jawabanTerbaca.toUpperCase();
      nomorTerbaca++;
    } else {
      kunci[i] = '';
      nomorPerluDilengkapi.push(i + 1);
    }
  }

  return {
    kunci,
    nomorTerbaca,
    nomorPerluDilengkapi,
  };
}

export function validasiKunciJawaban(
  kunciJawaban: string[],
  jumlahSoal: number,
  jumlahPilihan: 4 | 5,
): HasilValidasiKunci {
  const sah = new Set(daftarHurufSah(jumlahPilihan));
  const nomorKosong: number[] = [];
  const nomorTidakSah: number[] = [];

  for (let i = 0; i < jumlahSoal; i++) {
    const huruf = (kunciJawaban[i] ?? '').trim().toUpperCase();
    if (!huruf) {
      nomorKosong.push(i + 1);
    } else if (!sah.has(huruf)) {
      nomorTidakSah.push(i + 1);
    }
  }

  const terisi = jumlahSoal - nomorKosong.length - nomorTidakSah.length;
  const lengkap =
    jumlahSoal > 0 && nomorKosong.length === 0 && nomorTidakSah.length === 0;

  let pesan: string;
  if (lengkap) {
    pesan = `Semua ${jumlahSoal} nomor kunci jawaban sudah lengkap.`;
  } else if (nomorTidakSah.length > 0) {
    pesan = `Ada huruf kunci di luar pilihan A–${HURUF_PILIHAN[jumlahPilihan - 1]} pada nomor ${nomorTidakSah.slice(0, 5).join(', ')}.`;
  } else {
    pesan = `Terisi ${terisi} dari ${jumlahSoal} nomor. Masih ada ${nomorKosong.length} nomor belum diisi.`;
  }

  return {
    lengkap,
    terisi,
    nomorKosong,
    nomorTidakSah,
    pesan,
  };
}

export function hitungDistribusiKunci(
  kunciJawaban: string[],
  jumlahPilihan: 4 | 5,
): Record<string, number> {
  const distribusi: Record<string, number> = {};
  for (const h of daftarHurufSah(jumlahPilihan)) {
    distribusi[h] = 0;
  }
  for (const jawaban of kunciJawaban) {
    const h = jawaban.trim().toUpperCase();
    if (h in distribusi) {
      distribusi[h]++;
    }
  }
  return distribusi;
}

async function gandakanTemplateUntukUjian(
  template: TemplateLJK,
): Promise<TemplateLJK> {
  const gambarSalinan = template.gambarContoh
    ? new Blob([await template.gambarContoh.arrayBuffer()], {
        type: template.gambarContoh.type,
      })
    : undefined;

  return {
    ...template,
    ukuranStandar: { ...template.ukuranStandar },
    blokJawaban: template.blokJawaban.map((b) => ({
      ...b,
      titikBulatanPertama: { ...b.titikBulatanPertama },
      titikBulatanTerakhir: { ...b.titikBulatanTerakhir },
    })),
    ...(template.blokNama
      ? {
          blokNama: {
            ...template.blokNama,
            titikHurufAPertama: { ...template.blokNama.titikHurufAPertama },
            titikHurufZTerakhir: { ...template.blokNama.titikHurufZTerakhir },
          },
        }
      : {}),
    ...(template.blokIdentitas
      ? {
          blokIdentitas: template.blokIdentitas.map((b) => ({
            ...b,
            titikDigitPertama: { ...b.titikDigitPertama },
            titikDigitTerakhir: { ...b.titikDigitTerakhir },
          })),
        }
      : {}),
    ...(gambarSalinan ? { gambarContoh: gambarSalinan } : {}),
  };
}

export interface InputSimpanUjian {
  nama: string;
  kelas: string;
  template: TemplateLJK;
  kunciJawaban: string[];
}

export async function simpanUjianBaru(
  input: InputSimpanUjian,
  database: KoreksiLJKDatabase = db,
): Promise<Ujian> {
  const salinanTemplate = await gandakanTemplateUntukUjian(input.template);
  const kunciNormal = sesuaikanKunciKeTemplate(
    input.kunciJawaban,
    salinanTemplate.jumlahSoal,
    salinanTemplate.jumlahPilihan,
  );

  const ujian: Ujian = {
    id: buatId(),
    nama: input.nama.trim(),
    kelas: input.kelas.trim(),
    idTemplate: salinanTemplate.id,
    salinanTemplate,
    kunciJawaban: kunciNormal,
    tanggalDibuat: new Date().toISOString(),
  };

  await database.ujians.put(ujian);
  return ujian;
}

export async function perbaruiUjian(
  id: string,
  input: InputSimpanUjian,
  database: KoreksiLJKDatabase = db,
): Promise<Ujian> {
  const lama = await database.ujians.get(id);
  if (!lama) {
    throw new Error('Ujian yang ingin diubah tidak ditemukan.');
  }

  const salinanTemplate =
    input.template.id === lama.idTemplate
      ? lama.salinanTemplate
      : await gandakanTemplateUntukUjian(input.template);

  const kunciNormal = sesuaikanKunciKeTemplate(
    input.kunciJawaban,
    salinanTemplate.jumlahSoal,
    salinanTemplate.jumlahPilihan,
  );

  const terbaru: Ujian = {
    ...lama,
    nama: input.nama.trim(),
    kelas: input.kelas.trim(),
    idTemplate: salinanTemplate.id,
    salinanTemplate,
    kunciJawaban: kunciNormal,
  };

  await database.ujians.put(terbaru);
  return terbaru;
}

export async function hapusUjian(
  id: string,
  database: KoreksiLJKDatabase = db,
): Promise<void> {
  await database.transaction(
    'rw',
    [database.ujians, database.hasilScans],
    async () => {
      await database.hasilScans.where('idUjian').equals(id).delete();
      await database.ujians.delete(id);
    },
  );
}
