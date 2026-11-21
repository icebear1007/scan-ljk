import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, describe, it } from 'node:test';
import type { CV } from '@techstark/opencv-js';
import { KoreksiLJKDatabase, buatId } from '../src/db/database.ts';
import {
  aturSatuKunciGrid,
  buatKunciKosong,
  ekstrakKunciDariHasilScan,
  hapusUjian,
  hitungDistribusiKunci,
  parseKetikCepatKunci,
  perbaruiUjian,
  simpanUjianBaru,
  validasiKunciJawaban,
} from '../src/db/ujians.ts';
import { muatOpenCv } from '../src/omr/cvLoader.ts';
import { bacaLjkDenganOpenCv } from '../src/omr/cvPipeline.ts';
import {
  KUNCI_CONTOH_40_SOAL,
  TEMPLATE_CONTOH_40_SOAL,
  buatFotoContohLjkDenganOpenCv,
} from '../src/omr/sampleTemplate.ts';
import { PENGATURAN_AWAL, type HasilScan } from '../src/types/ljk.ts';

describe('Ujian & 3 Cara Mengisi Kunci Jawaban (Tahap 5)', () => {
  let cv: CV;
  let testDb: KoreksiLJKDatabase;

  before(async () => {
    cv = await muatOpenCv();
  });

  beforeEach(async () => {
    testDb = new KoreksiLJKDatabase(`TestUjian_${buatId()}`);
    await testDb.open();
  });

  afterEach(async () => {
    testDb.close();
    await testDb.delete();
  });

  it('ketiga cara mengisi kunci (ketik cepat, ketuk grid, dan scan LJK kunci) menghasilkan data yang persis sama', () => {
    // 1. Cara Ketik Cepat (dengan variasi huruf kecil & spasi)
    const teksCepat = KUNCI_CONTOH_40_SOAL.join('').toLowerCase();
    const dariKetik = parseKetikCepatKunci(teksCepat, 40, 5);
    assert.equal(dariKetik.karakterTidakSah.length, 0);
    assert.equal(dariKetik.kelebihanHuruf, 0);

    // 2. Cara Ketuk di Grid (satu per satu)
    let dariGrid = buatKunciKosong(40);
    for (let i = 0; i < KUNCI_CONTOH_40_SOAL.length; i++) {
      dariGrid = aturSatuKunciGrid(dariGrid, i + 1, KUNCI_CONTOH_40_SOAL[i], 5);
    }

    // 3. Cara Scan LJK Kunci (memotret LJK kunci dengan kemiringan & bayangan ringan)
    const fotoKunci = buatFotoContohLjkDenganOpenCv(
      cv,
      TEMPLATE_CONTOH_40_SOAL,
      {
        jawabanDiisi: KUNCI_CONTOH_40_SOAL,
        kemiringanDerajat: 3,
        perspektif: 0.03,
        bayangan: 35,
      },
    );
    const hasilBacaKunci = bacaLjkDenganOpenCv(cv, fotoKunci, {
      template: TEMPLATE_CONTOH_40_SOAL,
      pengaturan: PENGATURAN_AWAL,
      sertakanGambarLurus: false,
    });
    assert.equal(hasilBacaKunci.berhasil, true);
    const dariScan = ekstrakKunciDariHasilScan(hasilBacaKunci, 40, 5);
    assert.equal(dariScan.nomorPerluDilengkapi.length, 0);

    // Kriteria Selesai PRD Bagian 13: ketiganya harus menghasilkan array kunci yang persis sama
    assert.deepEqual(dariKetik.kunci, KUNCI_CONTOH_40_SOAL);
    assert.deepEqual(dariGrid, KUNCI_CONTOH_40_SOAL);
    assert.deepEqual(dariScan.kunci, KUNCI_CONTOH_40_SOAL);
    assert.deepEqual(dariKetik.kunci, dariGrid);
    assert.deepEqual(dariGrid, dariScan.kunci);
  });

  it('mendeteksi huruf di luar pilihan template dan menghitung validasi serta distribusi kunci', () => {
    // Template A-D (4 pilihan), tetapi guru tidak sengaja mengetik huruf E dan X
    const parsed = parseKetikCepatKunci('1.A 2.B 3.E 4.C 5.X 6.D', 4, 4);
    assert.deepEqual(parsed.kunci, ['A', 'B', 'C', 'D']);
    assert.deepEqual(parsed.karakterTidakSah, ['E', 'X']);

    const valid = validasiKunciJawaban(parsed.kunci, 4, 4);
    assert.equal(valid.lengkap, true);
    assert.equal(valid.terisi, 4);

    const distribusi = hitungDistribusiKunci(parsed.kunci, 4);
    assert.deepEqual(distribusi, { A: 1, B: 1, C: 1, D: 1 });
  });

  it('menyimpan, mengubah, dan menghapus ujian (beserta hasil scan terkait) secara atomik', async () => {
    const ujian = await simpanUjianBaru(
      {
        nama: 'PTS Matematika Semester Ganjil',
        kelas: 'IX-A',
        template: TEMPLATE_CONTOH_40_SOAL,
        kunciJawaban: KUNCI_CONTOH_40_SOAL,
      },
      testDb,
    );

    assert.equal(await testDb.ujians.count(), 1);
    assert.equal(ujian.salinanTemplate.nama, TEMPLATE_CONTOH_40_SOAL.nama);
    assert.deepEqual(ujian.kunciJawaban, KUNCI_CONTOH_40_SOAL);

    // Tambah 1 hasil scan terkait
    const scan: HasilScan = {
      id: buatId(),
      idUjian: ujian.id,
      kelas: 'IX-A',
      identitasSiswa: '01 - Ani',
      jawabanTerbaca: KUNCI_CONTOH_40_SOAL,
      jawabanSetelahKoreksi: KUNCI_CONTOH_40_SOAL,
      statusPerNomor: Array(40).fill('benar'),
      benar: 40,
      salah: 0,
      kosong: 0,
      perluDicek: 0,
      nilai: 100,
      tanggalScan: new Date().toISOString(),
    };
    await testDb.hasilScans.put(scan);

    // Ubah kunci nomor 1 dan nama kelas
    const kunciBaru = [...KUNCI_CONTOH_40_SOAL];
    kunciBaru[0] = 'E';
    const diubah = await perbaruiUjian(
      ujian.id,
      {
        nama: 'PTS Matematika (Revisi)',
        kelas: 'IX-A, IX-B',
        template: TEMPLATE_CONTOH_40_SOAL,
        kunciJawaban: kunciBaru,
      },
      testDb,
    );
    assert.equal(diubah.nama, 'PTS Matematika (Revisi)');
    assert.equal(diubah.kunciJawaban[0], 'E');

    // Hapus ujian -> ikut menghapus hasil scan terkait
    await hapusUjian(ujian.id, testDb);
    assert.equal(await testDb.ujians.count(), 0);
    assert.equal(await testDb.hasilScans.count(), 0);
  });
});
