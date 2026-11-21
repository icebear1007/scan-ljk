export const BATAS_PERSEN_RUANG_HAMPIR_PENUH = 80;
export const BATAS_SISA_BYTE_HAMPIR_PENUH = 50 * 1024 * 1024; // 50 MB
export const HARI_PENGINGAT_CADANGAN = 7;

export interface EvaluasiRuangPenyimpanan {
  terpakai: number;
  kuota: number;
  sisa: number;
  persenTerpakai: number;
  hampirPenuh: boolean;
  pesanPeringatan?: string;
}

export interface EvaluasiPengingatCadangan {
  perluPengingat: boolean;
  hariSejakCadangan: number | null;
  judul: string;
  pesan: string;
}

/**
 * Mengevaluasi status penggunaan ruang penyimpanan browser/perangkat
 * agar guru mendapat peringatan sebelum penyimpanan penuh.
 */
export function evaluasiRuangPenyimpanan(
  terpakai: number,
  kuota: number,
): EvaluasiRuangPenyimpanan {
  if (!Number.isFinite(kuota) || kuota <= 0) {
    return {
      terpakai: Math.max(0, Number.isFinite(terpakai) ? terpakai : 0),
      kuota: 0,
      sisa: 0,
      persenTerpakai: 0,
      hampirPenuh: false,
    };
  }

  const terpakaiAman = Math.max(0, Number.isFinite(terpakai) ? terpakai : 0);
  const sisa = Math.max(0, kuota - terpakaiAman);
  const persenTerpakai = Math.min(
    100,
    Number(((terpakaiAman / kuota) * 100).toFixed(1)),
  );

  const hampirPenuh =
    persenTerpakai >= BATAS_PERSEN_RUANG_HAMPIR_PENUH ||
    sisa < BATAS_SISA_BYTE_HAMPIR_PENUH;

  return {
    terpakai: terpakaiAman,
    kuota,
    sisa,
    persenTerpakai,
    hampirPenuh,
    ...(hampirPenuh
      ? {
          pesanPeringatan:
            'Ruang penyimpanan perangkat hampir penuh. Cadangkan data terlebih dahulu, lalu matikan opsi "Simpan foto hasil scan" di Pengaturan atau hapus ujian lama.',
        }
      : {}),
  };
}

/**
 * Mengecek apakah guru perlu diingatkan untuk membuat cadangan data berkala.
 * Pengingat aktif bila sudah ada hasil scan (atau minimal 2 ujian) dan belum pernah
 * dicadangkan atau cadangan terakhir berumur 7 hari atau lebih.
 */
export function evaluasiPengingatCadangan(params: {
  jumlahUjian: number;
  jumlahHasilScan: number;
  terakhirCadangan?: string;
  sekarang?: Date;
}): EvaluasiPengingatCadangan {
  const { jumlahUjian, jumlahHasilScan, terakhirCadangan } = params;
  const sekarang = params.sekarang ?? new Date();

  const adaDataPenting = jumlahHasilScan >= 1 || jumlahUjian >= 2;
  if (!adaDataPenting) {
    return {
      perluPengingat: false,
      hariSejakCadangan: null,
      judul: '',
      pesan: '',
    };
  }

  if (!terakhirCadangan) {
    return {
      perluPengingat: true,
      hariSejakCadangan: null,
      judul: 'Belum Ada Cadangan Data',
      pesan:
        'Anda sudah memiliki data koreksi di perangkat ini. Buat file cadangan sekarang agar nilai siswa tetap aman bila HP diganti.',
    };
  }

  const tanggalTerakhir = new Date(terakhirCadangan);
  if (Number.isNaN(tanggalTerakhir.getTime())) {
    return {
      perluPengingat: true,
      hariSejakCadangan: null,
      judul: 'Buat Cadangan Data',
      pesan:
        'Buat file cadangan sekarang agar data ujian dan hasil koreksi Anda selalu aman.',
    };
  }

  const selisihMs = Math.max(0, sekarang.getTime() - tanggalTerakhir.getTime());
  const hariSejakCadangan = Math.floor(selisihMs / (24 * 60 * 60 * 1000));

  if (hariSejakCadangan >= HARI_PENGINGAT_CADANGAN) {
    return {
      perluPengingat: true,
      hariSejakCadangan,
      judul: 'Waktunya Mencadangkan Data',
      pesan: `Cadangan terakhir dibuat ${hariSejakCadangan} hari yang lalu. Buat cadangan baru agar hasil koreksi terbaru tetap aman.`,
    };
  }

  return {
    perluPengingat: false,
    hariSejakCadangan,
    judul: '',
    pesan: '',
  };
}

/**
 * Mengubah durasi dalam milidetik menjadi teks detik berbahasa Indonesia yang ramah dibaca.
 */
export function formatDetik(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0,0 detik';
  if (ms < 100) return 'kurang dari 0,1 detik';
  return `${(ms / 1000).toFixed(1).replace('.', ',')} detik`;
}

/**
 * Mengubah jumlah byte menjadi satuan ukuran yang mudah dimengerti.
 */
export function formatUkuranByte(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${Math.round(bytes)} B`;
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2).replace('.', ',')} GB`;
}

/**
 * Meminta izin penyimpanan persisten ke browser agar data IndexedDB tidak dihapus
 * otomatis saat ruang HP menipis.
 */
export async function mintaPenyimpananPersisten(): Promise<boolean | null> {
  if (typeof navigator === 'undefined' || !navigator.storage) {
    return null;
  }
  try {
    if (typeof navigator.storage.persisted === 'function') {
      const sudahPersisten = await navigator.storage.persisted();
      if (sudahPersisten) return true;
    }
    if (typeof navigator.storage.persist === 'function') {
      return await navigator.storage.persist();
    }
    return null;
  } catch {
    return null;
  }
}
