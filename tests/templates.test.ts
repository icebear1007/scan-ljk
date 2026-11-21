import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { KoreksiLJKDatabase, buatId } from '../src/db/database.ts';
import {
  duplikatTemplate,
  hapusTemplate,
  perbaruiTemplate,
  sarankanBlokBerikutnya,
  simpanTemplateBaru,
  validasiCakupanBlokJawaban,
} from '../src/db/templates.ts';
import { TEMPLATE_CONTOH_40_SOAL } from '../src/omr/sampleTemplate.ts';
import type { Ujian } from '../src/types/ljk.ts';

describe('Manajemen Template & Validasi Blok (Tahap 4)', () => {
  let testDb: KoreksiLJKDatabase;

  beforeEach(async () => {
    testDb = new KoreksiLJKDatabase(`TestTemplate_${buatId()}`);
    await testDb.open();
  });

  afterEach(async () => {
    testDb.close();
    await testDb.delete();
  });

  it('memvalidasi cakupan 40 soal 4 blok dan menyarankan blok berikutnya dengan tepat', () => {
    // Belum ada blok
    const awal = validasiCakupanBlokJawaban([], 40);
    assert.equal(awal.lengkap, false);
    assert.equal(awal.totalTercakup, 0);
    assert.deepEqual(sarankanBlokBerikutnya([], 40), {
      nomorAwal: 1,
      jumlahNomor: 10,
    });

    // Baru 2 blok (1-20)
    const duaBlok = TEMPLATE_CONTOH_40_SOAL.blokJawaban.slice(0, 2);
    const separuh = validasiCakupanBlokJawaban(duaBlok, 40);
    assert.equal(separuh.lengkap, false);
    assert.equal(separuh.totalTercakup, 20);
    assert.deepEqual(sarankanBlokBerikutnya(duaBlok, 40), {
      nomorAwal: 21,
      jumlahNomor: 10,
    });

    // Lengkap 4 blok (1-40)
    const penuh = validasiCakupanBlokJawaban(
      TEMPLATE_CONTOH_40_SOAL.blokJawaban,
      40,
    );
    assert.equal(penuh.lengkap, true);
    assert.equal(penuh.totalTercakup, 40);
    assert.equal(penuh.nomorHilang.length, 0);
    assert.equal(penuh.nomorGanda.length, 0);

    // Nomor tumpang tindih terdeteksi
    const ganda = validasiCakupanBlokJawaban(
      [
        TEMPLATE_CONTOH_40_SOAL.blokJawaban[0],
        { ...TEMPLATE_CONTOH_40_SOAL.blokJawaban[1], nomorAwal: 10 },
      ],
      40,
    );
    assert.equal(ganda.lengkap, false);
    assert.deepEqual(ganda.nomorGanda, [10]);
  });

  it('mendukung tambah, ubah, duplikat (beserta gambar), dan hapus tanpa merusak salinan template pada ujian lama', async () => {
    const gambar = new Blob([new Uint8Array([255, 216, 255, 217])], {
      type: 'image/jpeg',
    });

    const dibuat = await simpanTemplateBaru(
      {
        nama: 'LJK Sekolah 40 Soal',
        jumlahSoal: 40,
        jumlahPilihan: 5,
        ukuranStandar: { lebar: 1000, tinggi: 1414 },
        jenisPenanda: 'penanda-sudut',
        blokJawaban: TEMPLATE_CONTOH_40_SOAL.blokJawaban,
        blokNama: {
          jumlahKolom: 20,
          titikHurufAPertama: { x: 30, y: 240 },
          titikHurufZTerakhir: { x: 450, y: 690 },
          radiusBulatan: 6,
        },
        gambarContoh: gambar,
      },
      testDb,
    );
    assert.equal(await testDb.templates.count(), 1);

    // Simpan ujian yang memakai salinan template ini
    const ujianLama: Ujian = {
      id: buatId(),
      nama: 'PAS IPA',
      kelas: 'VIII-A',
      idTemplate: dibuat.id,
      salinanTemplate: structuredClone(dibuat),
      kunciJawaban: Array(40).fill('A'),
      tanggalDibuat: new Date().toISOString(),
    };
    await testDb.ujians.put(ujianLama);

    // Duplikat template
    const duplikat = await duplikatTemplate(dibuat.id, testDb);
    assert.notEqual(duplikat.id, dibuat.id);
    assert.equal(duplikat.nama, 'LJK Sekolah 40 Soal (Salinan)');
    assert.equal(duplikat.blokJawaban.length, 4);
    assert.deepEqual(duplikat.blokNama, {
      jumlahKolom: 20,
      titikHurufAPertama: { x: 30, y: 240 },
      titikHurufZTerakhir: { x: 450, y: 690 },
      radiusBulatan: 6,
    });
    assert.ok(duplikat.gambarContoh instanceof Blob);
    assert.equal(await testDb.templates.count(), 2);

    // Ubah template asli
    const diubah = await perbaruiTemplate(
      dibuat.id,
      {
        ...dibuat,
        nama: 'LJK Sekolah 40 Soal (Revisi)',
        jumlahPilihan: 4,
      },
      testDb,
    );
    assert.equal(diubah.nama, 'LJK Sekolah 40 Soal (Revisi)');
    assert.equal(diubah.jumlahPilihan, 4);

    // Hapus template asli -> ujian lama tetap utuh memakai salinan template awal
    await hapusTemplate(dibuat.id, testDb);
    assert.equal(await testDb.templates.count(), 1);

    const ujianCek = await testDb.ujians.get(ujianLama.id);
    assert.equal(ujianCek?.salinanTemplate.nama, 'LJK Sekolah 40 Soal');
    assert.equal(ujianCek?.salinanTemplate.jumlahPilihan, 5);
  });
});
