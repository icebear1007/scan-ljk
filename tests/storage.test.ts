import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import {
  bacaDanValidasiCadangan,
  buatNamaFileCadangan,
  buatObjekCadangan,
  pulihkanDariCadangan,
} from '../src/db/backup.ts';
import {
  KoreksiLJKDatabase,
  ambilPengaturan,
  buatId,
  hapusSemuaData,
  resetPengaturanKeAwal,
  simpanPengaturan,
} from '../src/db/database.ts';
import {
  PENGATURAN_AWAL,
  type HasilScan,
  type TemplateLJK,
  type Ujian,
} from '../src/types/ljk.ts';

function buatContohTemplate(): TemplateLJK {
  const sekarang = new Date().toISOString();
  return {
    id: buatId(),
    nama: 'LJK UTS 40 Soal',
    jumlahSoal: 40,
    jumlahPilihan: 5,
    ukuranStandar: { lebar: 1000, tinggi: 1414 },
    jenisPenanda: 'penanda-sudut',
    blokJawaban: [
      {
        nomorAwal: 1,
        jumlahNomor: 10,
        titikBulatanPertama: { x: 120, y: 300 },
        titikBulatanTerakhir: { x: 280, y: 750 },
        jumlahPilihan: 5,
        radiusBulatan: 12,
      },
    ],
    gambarContoh: new Blob([new Uint8Array([137, 80, 78, 71, 1, 2, 3])], {
      type: 'image/png',
    }),
    tanggalDibuat: sekarang,
    tanggalDiubah: sekarang,
  };
}

describe('Penyimpanan Dexie & Cadangan/Pemulihan', () => {
  let testDb: KoreksiLJKDatabase;

  beforeEach(async () => {
    testDb = new KoreksiLJKDatabase(`TestKoreksiLJK_${buatId()}`);
    await testDb.open();
  });

  afterEach(async () => {
    testDb.close();
    await testDb.delete();
  });

  it('mengembalikan pengaturan awal dan menyimpan perubahan dengan aman', async () => {
    const awal = await ambilPengaturan(testDb);
    assert.deepEqual(awal, PENGATURAN_AWAL);

    const tersimpan = await simpanPengaturan(
      {
        ambangTerisi: 0.52,
        ambangKosong: 0.18,
        skalaNilai: 10,
        simpanFotoScan: false,
      },
      testDb,
    );
    assert.equal(tersimpan.ambangTerisi, 0.52);
    assert.equal(tersimpan.ambangKosong, 0.18);
    assert.equal(tersimpan.skalaNilai, 10);
    assert.equal(tersimpan.simpanFotoScan, false);

    // Pastikan ambangTerisi selalu minimal 0.05 di atas ambangKosong
    const dinormalkan = await simpanPengaturan(
      { ambangKosong: 0.4, ambangTerisi: 0.3 },
      testDb,
    );
    assert.ok(dinormalkan.ambangTerisi >= dinormalkan.ambangKosong + 0.05);

    const direset = await resetPengaturanKeAwal(testDb);
    assert.equal(direset.ambangTerisi, PENGATURAN_AWAL.ambangTerisi);
    assert.equal(direset.skalaNilai, 100);
  });

  it('mencadangkan, menghapus semua data, lalu memulihkan kembali secara utuh termasuk gambar Blob', async () => {
    const template = buatContohTemplate();
    await testDb.templates.put(template);

    const ujian: Ujian = {
      id: buatId(),
      nama: 'PTS Matematika',
      kelas: 'IX-A',
      idTemplate: template.id,
      salinanTemplate: template,
      kunciJawaban: ['A', 'B', 'C', 'D', 'E'],
      tanggalDibuat: new Date().toISOString(),
    };
    await testDb.ujians.put(ujian);

    const hasil: HasilScan = {
      id: buatId(),
      idUjian: ujian.id,
      kelas: 'IX-A',
      identitasSiswa: '01 - Budi',
      jawabanTerbaca: ['A', 'B', 'A', 'D', ''],
      jawabanSetelahKoreksi: ['A', 'B', 'C', 'D', ''],
      statusPerNomor: ['benar', 'benar', 'benar', 'benar', 'kosong'],
      benar: 4,
      salah: 0,
      kosong: 1,
      perluDicek: 1,
      nilai: 80,
      fotoLurus: new Blob([new Uint8Array([255, 216, 255, 224, 9, 8])], {
        type: 'image/jpeg',
      }),
      tanggalScan: new Date().toISOString(),
    };
    await testDb.hasilScans.put(hasil);
    await simpanPengaturan({ skalaNilai: 10, simpanFotoScan: false }, testDb);

    // Buat cadangan JSON
    const cadangan = await buatObjekCadangan(testDb);
    const jsonString = JSON.stringify(cadangan);

    // Validasi hasil cadangan
    const { cadangan: tervalidasi, ringkasan } =
      bacaDanValidasiCadangan(jsonString);
    assert.equal(ringkasan.jumlahTemplate, 1);
    assert.equal(ringkasan.jumlahUjian, 1);
    assert.equal(ringkasan.jumlahHasilScan, 1);

    // Hapus semua data
    await hapusSemuaData(testDb);
    assert.equal(await testDb.templates.count(), 0);
    assert.equal(await testDb.ujians.count(), 0);
    assert.equal(await testDb.hasilScans.count(), 0);
    assert.equal((await ambilPengaturan(testDb)).skalaNilai, 100);

    // Pulihkan dari cadangan
    await pulihkanDariCadangan(tervalidasi, testDb);
    assert.equal(await testDb.templates.count(), 1);
    assert.equal(await testDb.ujians.count(), 1);
    assert.equal(await testDb.hasilScans.count(), 1);

    const templatePulih = await testDb.templates.get(template.id);
    assert.equal(templatePulih?.nama, 'LJK UTS 40 Soal');
    assert.ok(templatePulih?.gambarContoh instanceof Blob);
    assert.equal(templatePulih?.gambarContoh?.type, 'image/png');
    assert.deepEqual(
      new Uint8Array(await templatePulih!.gambarContoh!.arrayBuffer()),
      new Uint8Array([137, 80, 78, 71, 1, 2, 3]),
    );

    const hasilPulih = await testDb.hasilScans.get(hasil.id);
    assert.equal(hasilPulih?.nilai, 80);
    assert.ok(hasilPulih?.fotoLurus instanceof Blob);
    assert.deepEqual(
      new Uint8Array(await hasilPulih!.fotoLurus!.arrayBuffer()),
      new Uint8Array([255, 216, 255, 224, 9, 8]),
    );

    const pengaturanPulih = await ambilPengaturan(testDb);
    assert.equal(pengaturanPulih.skalaNilai, 10);
    assert.equal(pengaturanPulih.simpanFotoScan, false);
  });

  it('menolak file cadangan yang rusak atau bukan dari Koreksi LJK', () => {
    assert.throws(
      () => bacaDanValidasiCadangan('{bukan json'),
      /bukan file cadangan/i,
    );
    assert.throws(
      () =>
        bacaDanValidasiCadangan(
          JSON.stringify({ aplikasi: 'lain', versiCadangan: 1 }),
        ),
      /bukan file cadangan dari aplikasi Koreksi LJK/i,
    );
    assert.throws(
      () =>
        bacaDanValidasiCadangan(
          JSON.stringify({ aplikasi: 'koreksi-ljk', versiCadangan: 99, data: {} }),
        ),
      /tidak didukung/i,
    );
  });

  it('membuat nama file cadangan dengan format tanggal yang rapi', () => {
    const nama = buatNamaFileCadangan(new Date(2026, 10, 21));
    assert.equal(nama, 'Cadangan_KoreksiLJK_2026-11-21.json');
  });
});
