import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  evaluasiPengingatCadangan,
  evaluasiRuangPenyimpanan,
  formatDetik,
  formatUkuranByte,
} from '../src/utils/kesehatanAplikasi.ts';

describe('Kesehatan Aplikasi (Ruang Penyimpanan, Pengingat Cadangan, & Format)', () => {
  it('mengevaluasi peringatan ruang penyimpanan hampir penuh dengan tepat', () => {
    const aman = evaluasiRuangPenyimpanan(
      40 * 1024 * 1024,
      500 * 1024 * 1024,
    );
    assert.equal(aman.hampirPenuh, false);
    assert.equal(aman.persenTerpakai, 8);
    assert.equal(aman.pesanPeringatan, undefined);

    // Memicu peringatan karena persentase >= 80%
    const penuhPersen = evaluasiRuangPenyimpanan(
      420 * 1024 * 1024,
      500 * 1024 * 1024,
    );
    assert.equal(penuhPersen.hampirPenuh, true);
    assert.equal(penuhPersen.persenTerpakai, 84);
    assert.ok(penuhPersen.pesanPeringatan?.includes('hampir penuh'));

    // Memicu peringatan karena sisa ruang < 50 MB meski persentase < 80%
    const sisaTipis = evaluasiRuangPenyimpanan(
      30 * 1024 * 1024,
      60 * 1024 * 1024,
    );
    assert.equal(sisaTipis.hampirPenuh, true);
    assert.ok(sisaTipis.pesanPeringatan);

    // Kuota 0 tidak memicu peringatan palsu
    const tanpaKuota = evaluasiRuangPenyimpanan(1000, 0);
    assert.equal(tanpaKuota.hampirPenuh, false);
  });

  it('memunculkan pengingat cadangan berkala hanya jika ada data dan sudah jatuh tempo', () => {
    const sekarang = new Date('2026-11-21T10:00:00.000Z');

    // Belum ada data penting -> tidak perlu pengingat
    const kosong = evaluasiPengingatCadangan({
      jumlahUjian: 0,
      jumlahHasilScan: 0,
      sekarang,
    });
    assert.equal(kosong.perluPengingat, false);

    // Sudah ada hasil scan tapi belum pernah mencadangkan -> ingatkan
    const belumPernah = evaluasiPengingatCadangan({
      jumlahUjian: 1,
      jumlahHasilScan: 3,
      sekarang,
    });
    assert.equal(belumPernah.perluPengingat, true);
    assert.equal(belumPernah.hariSejakCadangan, null);

    // Baru dicadangkan 3 hari lalu -> belum perlu
    const masihBaru = evaluasiPengingatCadangan({
      jumlahUjian: 2,
      jumlahHasilScan: 40,
      terakhirCadangan: '2026-11-18T10:00:00.000Z',
      sekarang,
    });
    assert.equal(masihBaru.perluPengingat, false);
    assert.equal(masihBaru.hariSejakCadangan, 3);

    // Sudah 7 hari sejak cadangan terakhir -> ingatkan kembali
    const jatuhTempo = evaluasiPengingatCadangan({
      jumlahUjian: 2,
      jumlahHasilScan: 40,
      terakhirCadangan: '2026-11-14T09:00:00.000Z',
      sekarang,
    });
    assert.equal(jatuhTempo.perluPengingat, true);
    assert.equal(jatuhTempo.hariSejakCadangan, 7);
    assert.ok(jatuhTempo.pesan.includes('7 hari'));
  });

  it('memformat durasi detik dan ukuran byte dalam bahasa Indonesia yang ramah', () => {
    assert.equal(formatDetik(45), 'kurang dari 0,1 detik');
    assert.equal(formatDetik(320), '0,3 detik');
    assert.equal(formatDetik(1480), '1,5 detik');

    assert.equal(formatUkuranByte(512), '512 B');
    assert.equal(formatUkuranByte(1536), '1,5 KB');
    assert.equal(formatUkuranByte(2.5 * 1024 * 1024), '2,5 MB');
  });
});
