import { hitungNilaiAkhir } from '../omr/decision.ts';
import type { HasilBacaNomor } from '../omr/types.ts';
import type {
  HasilScan,
  PengaturanAplikasi,
  StatusJawaban,
} from '../types/ljk.ts';
import { buatId, db, type KoreksiLJKDatabase } from './database.ts';

export interface HasilHitungUlang {
  statusPerNomor: StatusJawaban[];
  benar: number;
  salah: number;
  kosong: number;
  perluDicek: number;
  nilai: number;
}

/**
 * Menghitung ulang status per nomor dan ringkasan nilai dari daftar jawaban
 * setelah koreksi manual guru.
 *
 * Aturan PRD Bagian 9:
 * - Jika nomor belum dikoreksi manual dan bacaan mesin berstatus 'ganda' atau 'ragu',
 *   tetap dipertahankan sebagai 'ganda'/'ragu' (dihitung salah & masuk Perlu Dicek).
 * - Jika guru sudah mengoreksi nomor tersebut (memilih A-E atau Kosong),
 *   status langsung dihitung dari jawaban pilihan guru dibanding kunci jawaban.
 */
export function hitungUlangHasilDariKoreksi(
  jawabanSetelahKoreksi: string[],
  kunciJawaban: string[],
  statusMentahAwal: Array<HasilBacaNomor['statusMentah'] | StatusJawaban>,
  nomorSudahDikoreksi: ReadonlySet<number>,
  pengaturan: Pick<
    PengaturanAplikasi,
    'poinBenar' | 'poinSalah' | 'poinKosong' | 'skalaNilai'
  >,
): HasilHitungUlang {
  const jumlahSoal = kunciJawaban.length;
  const statusPerNomor: StatusJawaban[] = [];
  let benar = 0;
  let salah = 0;
  let kosong = 0;
  let perluDicek = 0;

  for (let i = 0; i < jumlahSoal; i++) {
    const nomor = i + 1;
    const dikoreksi = nomorSudahDikoreksi.has(nomor);
    const mentah = statusMentahAwal[i];
    const jawaban = (jawabanSetelahKoreksi[i] ?? '').trim().toUpperCase();
    const kunci = (kunciJawaban[i] ?? '').trim().toUpperCase();

    if (!dikoreksi && mentah === 'ganda') {
      statusPerNomor.push('ganda');
      salah++;
      perluDicek++;
      continue;
    }

    if (!dikoreksi && mentah === 'ragu') {
      statusPerNomor.push('ragu');
      salah++;
      perluDicek++;
      continue;
    }

    if (jawaban.length === 0) {
      statusPerNomor.push('kosong');
      kosong++;
      perluDicek++;
    } else if (kunci.length > 0 && jawaban === kunci) {
      statusPerNomor.push('benar');
      benar++;
    } else {
      statusPerNomor.push('salah');
      salah++;
    }
  }

  const nilai = hitungNilaiAkhir(
    benar,
    salah,
    kosong,
    jumlahSoal,
    pengaturan,
  );

  return {
    statusPerNomor,
    benar,
    salah,
    kosong,
    perluDicek,
    nilai,
  };
}

/**
 * Mencari hasil scan yang sudah ada pada ujian yang sama dengan identitas siswa
 * yang sama (tidak peka huruf besar/kecil). Mengembalikan null jika identitas kosong.
 */
export async function cariDuplikatSiswa(
  idUjian: string,
  identitasSiswa: string,
  kecualiId?: string,
  database: KoreksiLJKDatabase = db,
): Promise<HasilScan | null> {
  const normal = identitasSiswa.trim().toLowerCase();
  if (!normal) return null;

  const semua = await database.hasilScans
    .where('idUjian')
    .equals(idUjian)
    .toArray();

  return (
    semua.find(
      (item) =>
        item.id !== kecualiId &&
        item.identitasSiswa.trim().toLowerCase() === normal,
    ) ?? null
  );
}

export interface InputSimpanHasilScan {
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
  simpanFotoScan: boolean;
}

export async function simpanHasilScanBaru(
  input: InputSimpanHasilScan,
  database: KoreksiLJKDatabase = db,
): Promise<HasilScan> {
  const hasil: HasilScan = {
    id: buatId(),
    idUjian: input.idUjian,
    kelas: input.kelas.trim(),
    identitasSiswa: input.identitasSiswa.trim(),
    jawabanTerbaca: [...input.jawabanTerbaca],
    jawabanSetelahKoreksi: [...input.jawabanSetelahKoreksi],
    statusPerNomor: [...input.statusPerNomor],
    benar: input.benar,
    salah: input.salah,
    kosong: input.kosong,
    perluDicek: input.perluDicek,
    nilai: input.nilai,
    ...(input.simpanFotoScan && input.fotoLurus
      ? { fotoLurus: input.fotoLurus }
      : {}),
    tanggalScan: new Date().toISOString(),
  };

  await database.hasilScans.put(hasil);
  return hasil;
}

export async function timpaHasilScan(
  idLama: string,
  input: InputSimpanHasilScan,
  database: KoreksiLJKDatabase = db,
): Promise<HasilScan> {
  const lama = await database.hasilScans.get(idLama);
  const hasil: HasilScan = {
    id: lama ? lama.id : idLama,
    idUjian: input.idUjian,
    kelas: input.kelas.trim(),
    identitasSiswa: input.identitasSiswa.trim(),
    jawabanTerbaca: [...input.jawabanTerbaca],
    jawabanSetelahKoreksi: [...input.jawabanSetelahKoreksi],
    statusPerNomor: [...input.statusPerNomor],
    benar: input.benar,
    salah: input.salah,
    kosong: input.kosong,
    perluDicek: input.perluDicek,
    nilai: input.nilai,
    ...(input.simpanFotoScan && input.fotoLurus
      ? { fotoLurus: input.fotoLurus }
      : {}),
    tanggalScan: new Date().toISOString(),
  };

  await database.hasilScans.put(hasil);
  return hasil;
}

export async function perbaruiHasilScan(
  id: string,
  perubahan: Partial<Omit<HasilScan, 'id' | 'idUjian'>>,
  database: KoreksiLJKDatabase = db,
): Promise<HasilScan> {
  const lama = await database.hasilScans.get(id);
  if (!lama) {
    throw new Error('Data hasil scan yang ingin diperbarui tidak ditemukan.');
  }
  const terbaru: HasilScan = {
    ...lama,
    ...perubahan,
    id: lama.id,
    idUjian: lama.idUjian,
    ...(typeof perubahan.kelas === 'string'
      ? { kelas: perubahan.kelas.trim() }
      : {}),
    ...(typeof perubahan.identitasSiswa === 'string'
      ? { identitasSiswa: perubahan.identitasSiswa.trim() }
      : {}),
  };
  await database.hasilScans.put(terbaru);
  return terbaru;
}

export async function hapusHasilScan(
  id: string,
  database: KoreksiLJKDatabase = db,
): Promise<void> {
  await database.hasilScans.delete(id);
}
