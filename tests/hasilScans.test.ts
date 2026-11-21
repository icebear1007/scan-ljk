import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import { afterEach, before, beforeEach, describe, it } from 'node:test';
import type { CV } from '@techstark/opencv-js';
import { KoreksiLJKDatabase, buatId } from '../src/db/database.ts';
import {
  cariDuplikatSiswa,
  hitungUlangHasilDariKoreksi,
  perbaruiHasilScan,
  simpanHasilScanBaru,
  timpaHasilScan,
} from '../src/db/hasilScans.ts';
import { simpanUjianBaru } from '../src/db/ujians.ts';
import { muatOpenCv } from '../src/omr/cvLoader.ts';
import { bacaLjkDenganOpenCv } from '../src/omr/cvPipeline.ts';
import {
  KUNCI_CONTOH_40_SOAL,
  TEMPLATE_CONTOH_40_SOAL,
  buatFotoContohLjkDenganOpenCv,
} from '../src/omr/sampleTemplate.ts';
import { PENGATURAN_AWAL } from '../src/types/ljk.ts';

describe('Hasil Scan, Koreksi Manual, dan Deteksi Duplikat (Tahap 6)', () => {
  let cv: CV;
  let testDb: KoreksiLJKDatabase;

  before(async () => {
    cv = await muatOpenCv();
  });

  beforeEach(async () => {
    testDb = new KoreksiLJKDatabase(`TestHasilScan_${buatId()}`);
    await testDb.open();
  });

  afterEach(async () => {
    testDb.close();
    await testDb.delete();
  });

  it('angka benar, salah, kosong, dan nilai cocok 100% dengan perhitungan manual pada 5 LJK contoh', () => {
    // 5 lembar siswa dengan kombinasi benar, salah, kosong, ganda, dan ragu yang dihitung manual
    const kasus = [
      {
        nama: 'Siswa 1 (sempurna 40/40)',
        jawaban: [...KUNCI_CONTOH_40_SOAL],
        arsiranTipis: undefined,
        harapan: { benar: 40, salah: 0, kosong: 0, perluDicek: 0, nilai: 100 },
      },
      {
        nama: 'Siswa 2 (32 benar, 5 salah, 3 kosong)',
        jawaban: KUNCI_CONTOH_40_SOAL.map((k, i) => {
          if (i < 5) return k === 'A' ? 'B' : 'A'; // 5 salah
          if (i >= 5 && i < 8) return ''; // 3 kosong
          return k;
        }),
        arsiranTipis: undefined,
        harapan: { benar: 32, salah: 5, kosong: 3, perluDicek: 3, nilai: 80 },
      },
      {
        nama: 'Siswa 3 (35 benar, 2 salah, 1 kosong, 2 ganda)',
        jawaban: KUNCI_CONTOH_40_SOAL.map((k, i) => {
          if (i === 0 || i === 1) return k === 'E' ? 'D' : 'E'; // 2 salah
          if (i === 2) return ''; // 1 kosong
          if (i === 3 || i === 4) return 'AB'; // 2 ganda -> dihitung salah & perlu dicek
          return k;
        }),
        arsiranTipis: undefined,
        harapan: { benar: 35, salah: 4, kosong: 1, perluDicek: 3, nilai: 88 },
      },
      {
        nama: 'Siswa 4 (37 benar, 1 pensil tipis/ragu, 2 kosong)',
        jawaban: KUNCI_CONTOH_40_SOAL.map((k, i) => {
          if (i === 10) return ''; // akan diisi tipis di nomor 11
          if (i === 11 || i === 12) return ''; // 2 kosong
          return k;
        }),
        arsiranTipis: { 11: KUNCI_CONTOH_40_SOAL[10] },
        harapan: { benar: 37, salah: 1, kosong: 2, perluDicek: 3, nilai: 93 },
      },
      {
        nama: 'Siswa 5 (0 benar, 20 salah, 20 kosong)',
        jawaban: KUNCI_CONTOH_40_SOAL.map((k, i) => {
          if (i < 20) return k === 'A' ? 'C' : 'A';
          return '';
        }),
        arsiranTipis: undefined,
        harapan: { benar: 0, salah: 20, kosong: 20, perluDicek: 20, nilai: 0 },
      },
    ];

    for (const item of kasus) {
      const foto = buatFotoContohLjkDenganOpenCv(cv, TEMPLATE_CONTOH_40_SOAL, {
        jawabanDiisi: item.jawaban,
        arsiranTipis: item.arsiranTipis,
        kemiringanDerajat: 3,
        perspektif: 0.03,
        bayangan: 30,
      });

      const hasil = bacaLjkDenganOpenCv(cv, foto, {
        template: TEMPLATE_CONTOH_40_SOAL,
        pengaturan: PENGATURAN_AWAL,
        kunciJawaban: KUNCI_CONTOH_40_SOAL,
        sertakanGambarLurus: false,
      });

      assert.equal(hasil.berhasil, true, `${item.nama} gagal dibaca`);
      assert.deepEqual(
        hasil.ringkasanNilai,
        item.harapan,
        `Ketidakcocokan pada ${item.nama}`,
      );
    }
  });

  it('mengubah satu nomor secara manual langsung menghitung ulang nilai dan tersimpan di Dexie', async () => {
    const ujian = await simpanUjianBaru(
      {
        nama: 'UH Bahasa Indonesia',
        kelas: 'VII-A',
        template: TEMPLATE_CONTOH_40_SOAL,
        kunciJawaban: KUNCI_CONTOH_40_SOAL,
      },
      testDb,
    );

    const statusAwal = Array(40).fill('benar') as Array<
      'benar' | 'salah' | 'kosong' | 'ganda' | 'ragu'
    >;
    statusAwal[0] = 'salah';
    statusAwal[1] = 'ganda';
    statusAwal[2] = 'ragu';

    const jawabanTerbaca = [...KUNCI_CONTOH_40_SOAL];
    jawabanTerbaca[0] = 'E'; // salah (kunci A)
    jawabanTerbaca[1] = ''; // ganda
    jawabanTerbaca[2] = ''; // ragu

    const awal = hitungUlangHasilDariKoreksi(
      jawabanTerbaca,
      KUNCI_CONTOH_40_SOAL,
      statusAwal,
      new Set(),
      PENGATURAN_AWAL,
    );
    assert.deepEqual(awal, {
      statusPerNomor: statusAwal,
      benar: 37,
      salah: 3,
      kosong: 0,
      perluDicek: 2,
      nilai: 93,
    });

    // Guru mengoreksi nomor 2 (tadinya ganda) menjadi kunci yang benar ('B')
    const jawabanKoreksi = [...jawabanTerbaca];
    jawabanKoreksi[1] = KUNCI_CONTOH_40_SOAL[1];
    const sesudah = hitungUlangHasilDariKoreksi(
      jawabanKoreksi,
      KUNCI_CONTOH_40_SOAL,
      statusAwal,
      new Set([2]),
      PENGATURAN_AWAL,
    );

    assert.equal(sesudah.benar, 38);
    assert.equal(sesudah.salah, 2);
    assert.equal(sesudah.perluDicek, 1); // tinggal nomor 3 (ragu)
    assert.equal(sesudah.nilai, 95);
    assert.equal(sesudah.statusPerNomor[1], 'benar');

    // Simpan ke Dexie dan pastikan tersimpan utuh
    const tersimpan = await simpanHasilScanBaru(
      {
        idUjian: ujian.id,
        kelas: 'VII-A',
        identitasSiswa: '05 - Siti',
        jawabanTerbaca,
        jawabanSetelahKoreksi: jawabanKoreksi,
        ...sesudah,
        simpanFotoScan: false,
        fotoLurus: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }),
      },
      testDb,
    );
    // Pastikan opsi simpanFotoScan: false benar-benar tidak menyimpan Blob foto
    assert.equal(tersimpan.fotoLurus, undefined);

    const dibaca = await testDb.hasilScans.get(tersimpan.id);
    assert.equal(dibaca?.nilai, 95);
    assert.equal(dibaca?.jawabanSetelahKoreksi[1], KUNCI_CONTOH_40_SOAL[1]);

    // Koreksi lanjutan nomor 3 (ragu -> kosong)
    jawabanKoreksi[2] = '';
    const sesudah2 = hitungUlangHasilDariKoreksi(
      jawabanKoreksi,
      KUNCI_CONTOH_40_SOAL,
      statusAwal,
      new Set([2, 3]),
      PENGATURAN_AWAL,
    );
    const diperbarui = await perbaruiHasilScan(
      tersimpan.id,
      {
        jawabanSetelahKoreksi: jawabanKoreksi,
        ...sesudah2,
      },
      testDb,
    );
    assert.equal(diperbarui.statusPerNomor[2], 'kosong');
    assert.equal(diperbarui.kosong, 1);
    assert.equal(diperbarui.salah, 1);
  });

  it('mendeteksi siswa yang sama di-scan dua kali dan mendukung menimpa atau menyimpan tambahan', async () => {
    const ujian = await simpanUjianBaru(
      {
        nama: 'PTS IPA',
        kelas: 'VIII-C',
        template: TEMPLATE_CONTOH_40_SOAL,
        kunciJawaban: KUNCI_CONTOH_40_SOAL,
      },
      testDb,
    );

    const scan1 = await simpanHasilScanBaru(
      {
        idUjian: ujian.id,
        kelas: 'VIII-C',
        identitasSiswa: '12 - Ahmad',
        jawabanTerbaca: KUNCI_CONTOH_40_SOAL,
        jawabanSetelahKoreksi: KUNCI_CONTOH_40_SOAL,
        statusPerNomor: Array(40).fill('benar'),
        benar: 40,
        salah: 0,
        kosong: 0,
        perluDicek: 0,
        nilai: 100,
        simpanFotoScan: true,
        fotoLurus: new Blob([new Uint8Array([255, 216])], { type: 'image/jpeg' }),
      },
      testDb,
    );
    assert.ok(scan1.fotoLurus instanceof Blob);

    // Cek deteksi duplikat (tidak peka huruf besar/kecil & spasi pinggir)
    const duplikat = await cariDuplikatSiswa(
      ujian.id,
      '  12 - ahmad ',
      undefined,
      testDb,
    );
    assert.equal(duplikat?.id, scan1.id);

    // Identitas kosong tidak dianggap duplikat
    assert.equal(
      await cariDuplikatSiswa(ujian.id, '   ', undefined, testDb),
      null,
    );

    // Opsi 1: Timpa hasil lama
    await timpaHasilScan(
      scan1.id,
      {
        idUjian: ujian.id,
        kelas: 'VIII-C',
        identitasSiswa: '12 - Ahmad',
        jawabanTerbaca: KUNCI_CONTOH_40_SOAL,
        jawabanSetelahKoreksi: KUNCI_CONTOH_40_SOAL,
        statusPerNomor: Array(40).fill('benar'),
        benar: 38,
        salah: 2,
        kosong: 0,
        perluDicek: 0,
        nilai: 95,
        simpanFotoScan: false,
      },
      testDb,
    );
    assert.equal(await testDb.hasilScans.count(), 1);
    assert.equal((await testDb.hasilScans.get(scan1.id))?.nilai, 95);

    // Opsi 2: Simpan sebagai tambahan
    await simpanHasilScanBaru(
      {
        idUjian: ujian.id,
        kelas: 'VIII-C',
        identitasSiswa: '12 - Ahmad',
        jawabanTerbaca: KUNCI_CONTOH_40_SOAL,
        jawabanSetelahKoreksi: KUNCI_CONTOH_40_SOAL,
        statusPerNomor: Array(40).fill('benar'),
        benar: 39,
        salah: 1,
        kosong: 0,
        perluDicek: 0,
        nilai: 98,
        simpanFotoScan: false,
      },
      testDb,
    );
    assert.equal(await testDb.hasilScans.count(), 2);
  });
});
