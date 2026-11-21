import Dexie, { type EntityTable } from 'dexie';
import {
  PENGATURAN_AWAL,
  type HasilScan,
  type PengaturanAplikasi,
  type TemplateLJK,
  type Ujian,
} from '../types/ljk.ts';

export class KoreksiLJKDatabase extends Dexie {
  templates!: EntityTable<TemplateLJK, 'id'>;
  ujians!: EntityTable<Ujian, 'id'>;
  hasilScans!: EntityTable<HasilScan, 'id'>;
  pengaturan!: EntityTable<PengaturanAplikasi, 'id'>;

  constructor(namaDb = 'KoreksiLJKDB') {
    super(namaDb);

    this.version(1).stores({
      templates: 'id, nama, tanggalDiubah, tanggalDibuat',
      ujians: 'id, nama, kelas, idTemplate, tanggalDibuat',
      hasilScans:
        'id, idUjian, kelas, [idUjian+kelas], [idUjian+identitasSiswa], tanggalScan',
      pengaturan: 'id',
    });
  }
}

export const db = new KoreksiLJKDatabase();

export function buatId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalkanPengaturan(
  input?: Partial<PengaturanAplikasi>,
): PengaturanAplikasi {
  const gabungan: PengaturanAplikasi = {
    ...PENGATURAN_AWAL,
    ...input,
    id: 'utama',
  };

  // Pastikan ambang berada di rentang aman dan ambangKosong < ambangTerisi
  const ambangKosong = Math.min(
    0.45,
    Math.max(0.05, Number(gabungan.ambangKosong) || PENGATURAN_AWAL.ambangKosong),
  );
  const ambangTerisi = Math.min(
    0.85,
    Math.max(
      ambangKosong + 0.05,
      Number(gabungan.ambangTerisi) || PENGATURAN_AWAL.ambangTerisi,
    ),
  );

  const batasRaguPersen = Math.min(
    50,
    Math.max(5, Math.round(Number(gabungan.batasRaguPersen) || PENGATURAN_AWAL.batasRaguPersen)),
  );

  const poinBenar = Number.isFinite(Number(gabungan.poinBenar))
    ? Number(gabungan.poinBenar)
    : PENGATURAN_AWAL.poinBenar;
  const poinSalah = Number.isFinite(Number(gabungan.poinSalah))
    ? Number(gabungan.poinSalah)
    : PENGATURAN_AWAL.poinSalah;
  const poinKosong = Number.isFinite(Number(gabungan.poinKosong))
    ? Number(gabungan.poinKosong)
    : PENGATURAN_AWAL.poinKosong;

  return {
    id: 'utama',
    ambangTerisi: Number(ambangTerisi.toFixed(2)),
    ambangKosong: Number(ambangKosong.toFixed(2)),
    batasRaguPersen,
    poinBenar,
    poinSalah,
    poinKosong,
    skalaNilai: gabungan.skalaNilai === 10 ? 10 : 100,
    simpanFotoScan: Boolean(gabungan.simpanFotoScan),
    ...(gabungan.terakhirCadangan
      ? { terakhirCadangan: gabungan.terakhirCadangan }
      : {}),
  };
}

export async function ambilPengaturan(
  database: KoreksiLJKDatabase = db,
): Promise<PengaturanAplikasi> {
  const tersimpan = await database.pengaturan.get('utama');
  return normalkanPengaturan(tersimpan);
}

export async function simpanPengaturan(
  perubahan: Partial<Omit<PengaturanAplikasi, 'id'>>,
  database: KoreksiLJKDatabase = db,
): Promise<PengaturanAplikasi> {
  const saatIni = await ambilPengaturan(database);
  const terbaru = normalkanPengaturan({ ...saatIni, ...perubahan });
  await database.pengaturan.put(terbaru);
  return terbaru;
}

export async function resetPengaturanKeAwal(
  database: KoreksiLJKDatabase = db,
): Promise<PengaturanAplikasi> {
  const saatIni = await ambilPengaturan(database);
  const awal: PengaturanAplikasi = {
    ...PENGATURAN_AWAL,
    ...(saatIni.terakhirCadangan
      ? { terakhirCadangan: saatIni.terakhirCadangan }
      : {}),
  };
  await database.pengaturan.put(awal);
  return awal;
}

export async function hapusSemuaData(
  database: KoreksiLJKDatabase = db,
): Promise<void> {
  await database.transaction(
    'rw',
    [database.templates, database.ujians, database.hasilScans, database.pengaturan],
    async () => {
      await database.templates.clear();
      await database.ujians.clear();
      await database.hasilScans.clear();
      await database.pengaturan.clear();
      await database.pengaturan.put({ ...PENGATURAN_AWAL });
    },
  );
}
