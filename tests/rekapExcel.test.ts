import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import * as XLSX from 'xlsx';
import {
  KUNCI_CONTOH_40_SOAL,
  TEMPLATE_CONTOH_40_SOAL,
} from '../src/omr/sampleTemplate.ts';
import type { HasilScan, Ujian } from '../src/types/ljk.ts';
import {
  ambilDaftarKelasUnik,
  buatBufferExcel,
  buatNamaFileExcel,
  hitungStatistikRekap,
  saringDanUrutkanHasil,
} from '../src/utils/rekapExcel.ts';

function buatContohUjian(): Ujian {
  return {
    id: 'ujian-rekap-1',
    nama: 'PTS Matematika / Kelas IX',
    kelas: 'IX',
    idTemplate: TEMPLATE_CONTOH_40_SOAL.id,
    salinanTemplate: TEMPLATE_CONTOH_40_SOAL,
    kunciJawaban: KUNCI_CONTOH_40_SOAL,
    tanggalDibuat: '2026-11-21T08:00:00.000Z',
  };
}

function buatContohHasil(
  id: string,
  kelas: string,
  identitas: string,
  benar: number,
  salah: number,
  kosong: number,
): HasilScan {
  const jumlah = KUNCI_CONTOH_40_SOAL.length;
  const jawabanSetelahKoreksi = KUNCI_CONTOH_40_SOAL.map((k, idx) => {
    if (idx < benar) return k;
    if (idx < benar + salah) return k === 'A' ? 'B' : 'A';
    return '';
  });
  const statusPerNomor = KUNCI_CONTOH_40_SOAL.map((_, idx) => {
    if (idx < benar) return 'benar' as const;
    if (idx < benar + salah) return 'salah' as const;
    return 'kosong' as const;
  });
  const nilai = Math.round((benar / jumlah) * 100);
  return {
    id,
    idUjian: 'ujian-rekap-1',
    kelas,
    identitasSiswa: identitas,
    jawabanTerbaca: jawabanSetelahKoreksi,
    jawabanSetelahKoreksi,
    statusPerNomor,
    benar,
    salah,
    kosong,
    perluDicek: kosong,
    nilai,
    tanggalScan: '2026-11-21T09:00:00.000Z',
  };
}

describe('Rekap Ujian & Ekspor Excel SheetJS (Tahap 7)', () => {
  it('menghitung statistik, menyaring per kelas, dan membersihkan nama file Excel', () => {
    const daftar: HasilScan[] = [
      buatContohHasil('1', 'IX-B', '02 - Citra', 30, 8, 2), // nilai 75
      buatContohHasil('2', 'IX-A', '01 - Ani', 40, 0, 0), // nilai 100
      buatContohHasil('3', 'IX-A', '02 - Budi', 32, 6, 2), // nilai 80
    ];

    assert.deepEqual(ambilDaftarKelasUnik(daftar), ['IX-A', 'IX-B']);

    const statSemua = hitungStatistikRekap(daftar);
    assert.deepEqual(statSemua, {
      jumlahSiswa: 3,
      rataRata: 85,
      tertinggi: 100,
      terendah: 75,
      jumlahPerluDicek: 2,
    });

    const hanyaIXA = saringDanUrutkanHasil(daftar, 'IX-A');
    assert.equal(hanyaIXA.length, 2);
    assert.equal(hanyaIXA[0].identitasSiswa, '01 - Ani');
    assert.equal(hanyaIXA[1].identitasSiswa, '02 - Budi');
    assert.equal(hitungStatistikRekap(hanyaIXA).rataRata, 90);

    const namaFile = buatNamaFileExcel(
      'PTS Matematika / Kelas IX: Semester 1',
      new Date(2026, 10, 21),
    );
    assert.equal(namaFile, 'Nilai_PTS_Matematika_Kelas_IX_Semester_1_2026-11-21.xlsx');
  });

  it('menghasilkan file Excel (.xlsx) 2 lembar (Rekap & Jawaban) yang cocok 100% saat dibaca kembali', async () => {
    const ujian = buatContohUjian();
    const daftar: HasilScan[] = [
      buatContohHasil('s2', 'IX-B', '01 - Dewi', 36, 4, 0), // 90
      buatContohHasil('s1', 'IX-A', '01 - Adi', 32, 6, 2), // 80
    ];

    const buffer = await buatBufferExcel(ujian, daftar);
    assert.ok(buffer.byteLength > 1000, 'File xlsx seharusnya tidak kosong');

    // Baca ulang dengan SheetJS untuk memastikan valid di Excel / Google Sheets
    const wb = XLSX.read(buffer, { type: 'array' });
    assert.deepEqual(wb.SheetNames, ['Rekap', 'Jawaban']);

    const rowsRekap = XLSX.utils.sheet_to_json<Array<string | number>>(
      wb.Sheets['Rekap'],
      { header: 1 },
    );
    assert.deepEqual(rowsRekap[0], [
      'Kelas',
      'Nama / No. Absen',
      'Benar',
      'Salah',
      'Kosong',
      'Nilai',
    ]);
    // Terurut per kelas: IX-A dulu lalu IX-B
    assert.deepEqual(rowsRekap[1], ['IX-A', '01 - Adi', 32, 6, 2, 80]);
    assert.deepEqual(rowsRekap[2], ['IX-B', '01 - Dewi', 36, 4, 0, 90]);

    const rowsJawaban = XLSX.utils.sheet_to_json<Array<string | number>>(
      wb.Sheets['Jawaban'],
      { header: 1 },
    );
    assert.equal(rowsJawaban[0][0], 'Kelas');
    assert.equal(rowsJawaban[0][1], 'Nama / No. Absen');
    assert.equal(rowsJawaban[0][2], '1');
    assert.equal(rowsJawaban[0][41], '40');
    assert.equal(rowsJawaban[0][42], 'Nilai');

    // Baris 2 wajib berisi KUNCI JAWABAN di atas jawaban siswa
    assert.equal(rowsJawaban[1][1], 'KUNCI JAWABAN');
    assert.equal(rowsJawaban[1][2], KUNCI_CONTOH_40_SOAL[0]);
    assert.equal(rowsJawaban[1][41], KUNCI_CONTOH_40_SOAL[39]);

    // Baris 3 siswa pertama (Adi: 32 benar, 6 salah, 2 kosong -> nomor 39 & 40 '-')
    assert.equal(rowsJawaban[2][0], 'IX-A');
    assert.equal(rowsJawaban[2][1], '01 - Adi');
    assert.equal(rowsJawaban[2][2], KUNCI_CONTOH_40_SOAL[0]);
    assert.equal(rowsJawaban[2][40], '-');
    assert.equal(rowsJawaban[2][41], '-');
    assert.equal(rowsJawaban[2][42], 80);
  });

  it('menangani 9 kelas x 44 siswa (396 siswa) dengan cepat dan mengekspor seluruhnya ke Excel', async () => {
    const ujian = buatContohUjian();
    const daftar396: HasilScan[] = [];
    const hurufKelas = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'];

    for (let k = 0; k < 9; k++) {
      for (let s = 1; s <= 44; s++) {
        const benar = 20 + ((k * 7 + s) % 21); // 20..40
        const kosong = s % 5 === 0 ? 1 : 0;
        const salah = 40 - benar - kosong;
        daftar396.push(
          buatContohHasil(
            `k${k}-s${s}`,
            `IX-${hurufKelas[k]}`,
            `${String(s).padStart(2, '0')} - Siswa ${k + 1}-${s}`,
            benar,
            salah,
            kosong,
          ),
        );
      }
    }

    const mulai = performance.now();
    const kelasList = ambilDaftarKelasUnik(daftar396);
    const stat = hitungStatistikRekap(daftar396);
    const buffer = await buatBufferExcel(ujian, daftar396);
    const durasiMs = performance.now() - mulai;

    assert.equal(kelasList.length, 9);
    assert.equal(stat.jumlahSiswa, 396);
    assert.ok(durasiMs < 3000, `Proses 396 siswa terlalu lambat: ${durasiMs} ms`);

    const wb = XLSX.read(buffer, { type: 'array' });
    const rowsRekap = XLSX.utils.sheet_to_json<Array<string | number>>(
      wb.Sheets['Rekap'],
      { header: 1 },
    );
    assert.equal(rowsRekap.length, 397); // 1 header + 396 siswa
  });
});
