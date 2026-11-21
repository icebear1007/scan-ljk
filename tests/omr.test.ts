import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import type { CV } from '@techstark/opencv-js';
import { muatOpenCv } from '../src/omr/cvLoader.ts';
import {
  bacaLjkDenganOpenCv,
  deteksiDanLuruskanKertas,
} from '../src/omr/cvPipeline.ts';
import {
  hitungNilaiAkhir,
  hitungPenilaianDariBacaan,
  putuskanJawabanSatuNomor,
} from '../src/omr/decision.ts';
import {
  hitungPosisiSemuaSoal,
  hitungUkuranStandarDariSudut,
} from '../src/omr/geometry.ts';
import {
  KUNCI_CONTOH_40_SOAL,
  TEMPLATE_CONTOH_40_SOAL,
  buatFotoContohLjkDenganOpenCv,
} from '../src/omr/sampleTemplate.ts';
import { PENGATURAN_AWAL, type TemplateLJK } from '../src/types/ljk.ts';

describe('Logika Murni Geometri & Keputusan Jawaban OMR', () => {
  it('menghitung posisi tepat 40 soal x 5 pilihan dari template 4 blok', () => {
    const semuaSoal = hitungPosisiSemuaSoal(TEMPLATE_CONTOH_40_SOAL);
    assert.equal(semuaSoal.length, 40);
    assert.equal(semuaSoal[0].nomor, 1);
    assert.equal(semuaSoal[39].nomor, 40);
    assert.equal(semuaSoal[0].pilihan.length, 5);
    assert.deepEqual(
      semuaSoal[0].pilihan.map((p) => p.label),
      ['A', 'B', 'C', 'D', 'E'],
    );
  });

  it('memutuskan terjawab, kosong, ganda, ragu, dan bekas hapus sesuai aturan PRD', () => {
    const buatBaris = (rasio: number[]) =>
      ['A', 'B', 'C', 'D', 'E'].map((label, i) => ({
        label,
        pusat: { x: i * 40, y: 100 },
        radius: 15,
        rasioGelap: rasio[i],
      }));

    // Terjawab bersih
    const terjawab = putuskanJawabanSatuNomor(
      1,
      buatBaris([0.08, 0.78, 0.06, 0.09, 0.07]),
      PENGATURAN_AWAL,
    );
    assert.equal(terjawab.statusMentah, 'terjawab');
    assert.equal(terjawab.jawabanTerbaca, 'B');

    // Kosong
    const kosong = putuskanJawabanSatuNomor(
      2,
      buatBaris([0.09, 0.11, 0.07, 0.12, 0.08]),
      PENGATURAN_AWAL,
    );
    assert.equal(kosong.statusMentah, 'kosong');
    assert.equal(kosong.jawabanTerbaca, '');

    // Ganda
    const ganda = putuskanJawabanSatuNomor(
      3,
      buatBaris([0.72, 0.08, 0.69, 0.09, 0.06]),
      PENGATURAN_AWAL,
    );
    assert.equal(ganda.statusMentah, 'ganda');
    assert.equal(ganda.jawabanTerbaca, '');

    // Pensil terlalu tipis -> ragu
    const tipis = putuskanJawabanSatuNomor(
      4,
      buatBaris([0.07, 0.09, 0.34, 0.08, 0.07]),
      PENGATURAN_AWAL,
    );
    assert.equal(tipis.statusMentah, 'ragu');
    assert.equal(tipis.jawabanTerbaca, '');

    // Ada jawaban penuh + bekas hapus samar (0.28) -> ragu, tidak menebak
    const bekasHapus = putuskanJawabanSatuNomor(
      5,
      buatBaris([0.28, 0.08, 0.79, 0.07, 0.06]),
      PENGATURAN_AWAL,
    );
    assert.equal(bekasHapus.statusMentah, 'ragu');
    assert.equal(bekasHapus.jawabanTerbaca, '');
  });

  it('menghitung nilai benar/salah/kosong untuk skala 100 dan skala 10', () => {
    assert.equal(hitungNilaiAkhir(35, 3, 2, 40, PENGATURAN_AWAL), 88);
    assert.equal(
      hitungNilaiAkhir(35, 3, 2, 40, { ...PENGATURAN_AWAL, skalaNilai: 10 }),
      8.8,
    );

    const penilaian = hitungPenilaianDariBacaan(
      [
        { nomor: 1, bulatan: [], jawabanTerbaca: 'A', statusMentah: 'terjawab' },
        { nomor: 2, bulatan: [], jawabanTerbaca: 'D', statusMentah: 'terjawab' },
        { nomor: 3, bulatan: [], jawabanTerbaca: '', statusMentah: 'kosong' },
        { nomor: 4, bulatan: [], jawabanTerbaca: '', statusMentah: 'ganda' },
        { nomor: 5, bulatan: [], jawabanTerbaca: '', statusMentah: 'ragu' },
      ],
      ['A', 'B', 'C', 'D', 'E'],
      PENGATURAN_AWAL,
    );
    assert.deepEqual(penilaian.ringkasan, {
      benar: 1,
      salah: 3, // salah biasa (1) + ganda (1) + ragu (1)
      kosong: 1,
      perluDicek: 3, // kosong + ganda + ragu
      nilai: 20,
    });
  });
});

describe('Mesin Pembaca OpenCV.js (Alur Penuh)', () => {
  let cv: CV;

  before(async () => {
    cv = await muatOpenCv();
  });

  it('mencapai akurasi >= 98% pada 10 foto LJK dengan variasi sudut, perspektif, dan bayangan', () => {
    const skenario = [
      { kemiringan: 0, perspektif: 0, bayangan: 0, id: '1234' },
      { kemiringan: 3, perspektif: 0.03, bayangan: 25, id: '0042' },
      { kemiringan: -4, perspektif: 0.04, bayangan: 40, id: '9876' },
      { kemiringan: 6, perspektif: 0.05, bayangan: 55, id: '5019' },
      { kemiringan: -7, perspektif: 0.06, bayangan: 65, id: '3310' },
      { kemiringan: 2, perspektif: 0.07, bayangan: 45, id: '7428' },
      { kemiringan: -5, perspektif: 0.02, bayangan: 70, id: '8163' },
      { kemiringan: 8, perspektif: 0.04, bayangan: 30, id: '4592' },
      { kemiringan: -3, perspektif: 0.05, bayangan: 50, id: '6001' },
      { kemiringan: 5, perspektif: 0.03, bayangan: 60, id: '2785' },
    ];

    let totalSoal = 0;
    let totalCocok = 0;

    for (let s = 0; s < skenario.length; s++) {
      const sk = skenario[s];
      // Buat pola jawaban berbeda per lembar (ada yang benar, salah, dan 1 kosong)
      const jawabanTarget = KUNCI_CONTOH_40_SOAL.map((kunci, idx) => {
        if ((idx + s) % 19 === 0) return ''; // 2 nomor kosong per lembar
        if ((idx + s) % 7 === 0) {
          return kunci === 'A' ? 'B' : 'A'; // jawaban salah
        }
        return kunci;
      });

      const foto = buatFotoContohLjkDenganOpenCv(cv, TEMPLATE_CONTOH_40_SOAL, {
        jawabanDiisi: jawabanTarget,
        identitasDigit: sk.id,
        kemiringanDerajat: sk.kemiringan,
        perspektif: sk.perspektif,
        bayangan: sk.bayangan,
      });

      const hasil = bacaLjkDenganOpenCv(cv, foto, {
        template: TEMPLATE_CONTOH_40_SOAL,
        pengaturan: PENGATURAN_AWAL,
        kunciJawaban: KUNCI_CONTOH_40_SOAL,
        sertakanGambarLurus: false,
      });

      assert.equal(hasil.berhasil, true, `Skenario ${s + 1} gagal mendeteksi kertas`);
      assert.equal(hasil.metodeDeteksi, 'penanda-sudut');
      assert.equal(
        hasil.perluFotoUlang,
        false,
        `Skenario ${s + 1} tidak seharusnya perlu foto ulang: ${JSON.stringify(hasil.peringatan)}`,
      );
      assert.ok(
        hasil.waktuProsesMs < 3000,
        `Skenario ${s + 1} terlalu lambat (${hasil.waktuProsesMs} ms)`,
      );
      assert.equal(hasil.identitas?.nilaiTerbaca, sk.id);

      for (let i = 0; i < jawabanTarget.length; i++) {
        totalSoal++;
        if (hasil.jawabanTerbaca[i] === jawabanTarget[i]) {
          totalCocok++;
        }
      }
    }

    const akurasi = (totalCocok / totalSoal) * 100;
    assert.ok(
      akurasi >= 98,
      `Akurasi keseluruhan harus >= 98%, terukur ${akurasi.toFixed(2)}% (${totalCocok}/${totalSoal})`,
    );
  });

  it('menangani kasus khusus: ganda, kosong, pensil tipis, dan bekas hapus samar', () => {
    const jawaban = [...KUNCI_CONTOH_40_SOAL];
    jawaban[2] = ''; // Nomor 3 kosong
    jawaban[4] = 'AE'; // Nomor 5 ganda (A dan E)
    jawaban[6] = ''; // Nomor 7 hanya pensil tipis
    // Nomor 9 punya jawaban penuh 'D' + bekas hapus samar di 'A'

    const foto = buatFotoContohLjkDenganOpenCv(cv, TEMPLATE_CONTOH_40_SOAL, {
      jawabanDiisi: jawaban,
      arsiranTipis: { 7: 'C' },
      bekasHapus: { 9: 'A' },
      kemiringanDerajat: 3,
      bayangan: 30,
    });

    const hasil = bacaLjkDenganOpenCv(cv, foto, {
      template: TEMPLATE_CONTOH_40_SOAL,
      pengaturan: PENGATURAN_AWAL,
      kunciJawaban: KUNCI_CONTOH_40_SOAL,
      sertakanGambarLurus: false,
    });

    assert.equal(hasil.berhasil, true);
    assert.equal(hasil.statusPerNomor[2], 'kosong');
    assert.equal(hasil.statusPerNomor[4], 'ganda');
    assert.equal(hasil.statusPerNomor[6], 'ragu');
    assert.equal(hasil.statusPerNomor[8], 'ragu');
    assert.equal(hasil.ringkasanNilai?.benar, 36);
    assert.equal(hasil.ringkasanNilai?.kosong, 1);
    assert.equal(hasil.ringkasanNilai?.salah, 3); // ganda + 2 ragu
    assert.equal(hasil.ringkasanNilai?.perluDicek, 4); // kosong + ganda + 2 ragu
    assert.equal(hasil.ringkasanNilai?.nilai, 90);
  });

  it('mendeteksi tepi kertas jika template memakai mode tepi-kertas tanpa penanda sudut', () => {
    const templateTepi: TemplateLJK = {
      ...TEMPLATE_CONTOH_40_SOAL,
      jenisPenanda: 'tepi-kertas',
    };
    const foto = buatFotoContohLjkDenganOpenCv(cv, templateTepi, {
      jawabanDiisi: KUNCI_CONTOH_40_SOAL,
      tanpaPenandaSudut: true,
      kemiringanDerajat: -4,
      perspektif: 0.04,
    });

    const deteksi = deteksiDanLuruskanKertas(cv, foto, {
      jenisPenanda: 'tepi-kertas',
      ukuranStandar: templateTepi.ukuranStandar,
      sertakanGambarLurus: true,
    });

    assert.equal(deteksi.berhasil, true);
    assert.equal(deteksi.metode, 'tepi-kertas');
    assert.equal(deteksi.gambarLurus?.lebar, 1000);
    assert.equal(deteksi.gambarLurus?.tinggi, 1414);
  });

  it('menolak foto kosong tanpa kertas dan tidak pernah menghasilkan nilai palsu', () => {
    const mejaKosong = {
      lebar: 800,
      tinggi: 1000,
      data: new Uint8ClampedArray(800 * 1000 * 4).fill(90),
    };
    for (let i = 3; i < mejaKosong.data.length; i += 4) {
      mejaKosong.data[i] = 255;
    }

    const hasil = bacaLjkDenganOpenCv(cv, mejaKosong, {
      template: TEMPLATE_CONTOH_40_SOAL,
      pengaturan: PENGATURAN_AWAL,
      kunciJawaban: KUNCI_CONTOH_40_SOAL,
    });

    assert.equal(hasil.berhasil, false);
    assert.equal(hasil.perluFotoUlang, true);
    assert.equal(hasil.ringkasanNilai, undefined);
    assert.ok(
      hasil.peringatan.some((p) => p.kode === 'kertas-tidak-ditemukan'),
    );
  });

  it('memberi peringatan pada foto terlalu gelap, terlalu miring, atau posisi bergeser', () => {
    // 1. Foto terlalu gelap
    const fotoGelap = buatFotoContohLjkDenganOpenCv(cv, TEMPLATE_CONTOH_40_SOAL, {
      jawabanDiisi: KUNCI_CONTOH_40_SOAL,
      faktorCahaya: 0.16,
    });
    const hasilGelap = bacaLjkDenganOpenCv(cv, fotoGelap, {
      template: TEMPLATE_CONTOH_40_SOAL,
      pengaturan: PENGATURAN_AWAL,
      sertakanGambarLurus: false,
    });
    assert.equal(hasilGelap.perluFotoUlang, true);
    assert.ok(hasilGelap.peringatan.some((p) => p.kode === 'terlalu-gelap'));

    // 2. Kertas miring berlebihan (24 derajat)
    const fotoMiring = buatFotoContohLjkDenganOpenCv(
      cv,
      TEMPLATE_CONTOH_40_SOAL,
      {
        jawabanDiisi: KUNCI_CONTOH_40_SOAL,
        kemiringanDerajat: 24,
      },
    );
    const hasilMiring = bacaLjkDenganOpenCv(cv, fotoMiring, {
      template: TEMPLATE_CONTOH_40_SOAL,
      pengaturan: PENGATURAN_AWAL,
      sertakanGambarLurus: false,
    });
    assert.equal(hasilMiring.perluFotoUlang, true);
    assert.ok(
      hasilMiring.peringatan.some((p) => p.kode === 'kemiringan-berlebihan'),
    );

    // 3. Posisi bulatan bergeser secara sistematis
    const fotoGeser = buatFotoContohLjkDenganOpenCv(cv, TEMPLATE_CONTOH_40_SOAL, {
      jawabanDiisi: KUNCI_CONTOH_40_SOAL,
      geserIsiX: 12,
      geserIsiY: 10,
    });
    const hasilGeser = bacaLjkDenganOpenCv(cv, fotoGeser, {
      template: TEMPLATE_CONTOH_40_SOAL,
      pengaturan: PENGATURAN_AWAL,
      sertakanGambarLurus: false,
    });
    assert.equal(hasilGeser.perluFotoUlang, true);
    assert.ok(
      hasilGeser.peringatan.some((p) => p.kode === 'posisi-bergeser'),
    );

    // 4. Bayangan gelap tidak merata di sebagian kertas
    const fotoBayangan = buatFotoContohLjkDenganOpenCv(
      cv,
      TEMPLATE_CONTOH_40_SOAL,
      {
        jawabanDiisi: KUNCI_CONTOH_40_SOAL,
        bayangan: 165,
      },
    );
    const hasilBayangan = bacaLjkDenganOpenCv(cv, fotoBayangan, {
      template: TEMPLATE_CONTOH_40_SOAL,
      pengaturan: PENGATURAN_AWAL,
      sertakanGambarLurus: false,
    });
    assert.equal(hasilBayangan.perluFotoUlang, true);
    assert.ok(
      hasilBayangan.peringatan.some((p) => p.kode === 'berbayang-kuat'),
    );
  });

  it('mempertahankan proporsi asli kertas mendatar (landscape) tanpa gepeng', () => {
    // 1. Uji rumus hitungUkuranStandarDariSudut untuk mendatar, tegak, dan persegi
    const ukuranMendatar = hitungUkuranStandarDariSudut({
      kiriAtas: { x: 7, y: 2 },
      kananAtas: { x: 1015, y: 12 },
      kananBawah: { x: 1023, y: 710 },
      kiriBawah: { x: 0, y: 713 },
    });
    assert.equal(ukuranMendatar.lebar, 1414);
    assert.ok(
      ukuranMendatar.tinggi >= 950 && ukuranMendatar.tinggi <= 1020,
      `Tinggi kertas mendatar harus proporsional (~981), terukur ${ukuranMendatar.tinggi}`,
    );

    const ukuranTegak = hitungUkuranStandarDariSudut({
      kiriAtas: { x: 0, y: 0 },
      kananAtas: { x: 1000, y: 0 },
      kananBawah: { x: 1000, y: 1414 },
      kiriBawah: { x: 0, y: 1414 },
    });
    assert.deepEqual(ukuranTegak, { lebar: 1000, tinggi: 1414 });

    // 2. Uji pelurusan & pembacaan penuh pada LJK mendatar (50 soal, 5 blok, 4 pilihan A-D)
    const templateMendatar: TemplateLJK = {
      id: 'uji-mendatar-50-soal',
      nama: 'Uji LJK Mendatar 50 Soal (A-D)',
      jumlahSoal: 50,
      jumlahPilihan: 4,
      ukuranStandar: { lebar: 1414, tinggi: 1000 },
      jenisPenanda: 'tepi-kertas',
      blokJawaban: Array.from({ length: 5 }, (_, idx) => ({
        nomorAwal: idx * 10 + 1,
        jumlahNomor: 10,
        titikBulatanPertama: { x: 85 + idx * 150, y: 720 },
        titikBulatanTerakhir: { x: 165 + idx * 150, y: 950 },
        jumlahPilihan: 4,
        radiusBulatan: 9,
      })),
      tanggalDibuat: '2026-11-21T00:00:00.000Z',
      tanggalDiubah: '2026-11-21T00:00:00.000Z',
    };

    const kunci50 = Array.from(
      { length: 50 },
      (_, i) => ['A', 'B', 'C', 'D'][i % 4],
    );
    const fotoMendatar = buatFotoContohLjkDenganOpenCv(cv, templateMendatar, {
      jawabanDiisi: kunci50,
      tanpaPenandaSudut: true,
      kemiringanDerajat: 2,
      perspektif: 0.03,
      bayangan: 25,
    });

    // Tanpa ukuranStandar paksa, deteksiDanLuruskanKertas harus otomatis menghasilkan gambar mendatar (lebar > tinggi)
    const deteksi = deteksiDanLuruskanKertas(cv, fotoMendatar, {
      jenisPenanda: 'tepi-kertas',
      sertakanGambarLurus: true,
    });
    assert.equal(deteksi.berhasil, true);
    assert.ok(
      deteksi.gambarLurus &&
        deteksi.gambarLurus.lebar > deteksi.gambarLurus.tinggi,
      `Gambar lurus harus tetap mendatar, terukur ${deteksi.gambarLurus?.lebar}x${deteksi.gambarLurus?.tinggi}`,
    );

    // Pembacaan penuh pada template mendatar harus 100% akurat
    const hasilBaca = bacaLjkDenganOpenCv(cv, fotoMendatar, {
      template: templateMendatar,
      pengaturan: PENGATURAN_AWAL,
      kunciJawaban: kunci50,
      sertakanGambarLurus: true,
    });
    assert.equal(hasilBaca.berhasil, true);
    assert.equal(hasilBaca.perluFotoUlang, false);
    assert.equal(hasilBaca.gambarLurus?.lebar, 1414);
    assert.equal(hasilBaca.gambarLurus?.tinggi, 1000);
    assert.equal(hasilBaca.ringkasanNilai?.benar, 50);
    assert.equal(hasilBaca.ringkasanNilai?.nilai, 100);
  });
});
