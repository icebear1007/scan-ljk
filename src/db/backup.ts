import type {
  HasilScan,
  PengaturanAplikasi,
  TemplateLJK,
  Ujian,
} from '../types/ljk.ts';
import {
  ambilPengaturan,
  db,
  normalkanPengaturan,
  simpanPengaturan,
  type KoreksiLJKDatabase,
} from './database.ts';

export const KODE_APLIKASI_CADANGAN = 'koreksi-ljk' as const;
export const VERSI_CADANGAN = 1 as const;

type TemplateTerserialisasi = Omit<TemplateLJK, 'gambarContoh'> & {
  gambarContoh?: string;
};

type UjianTerserialisasi = Omit<Ujian, 'salinanTemplate'> & {
  salinanTemplate: TemplateTerserialisasi;
};

type HasilScanTerserialisasi = Omit<HasilScan, 'fotoLurus'> & {
  fotoLurus?: string;
};

export interface FormatCadanganLJK {
  aplikasi: typeof KODE_APLIKASI_CADANGAN;
  versiCadangan: typeof VERSI_CADANGAN;
  tanggalDibuat: string;
  data: {
    templates: TemplateTerserialisasi[];
    ujians: UjianTerserialisasi[];
    hasilScans: HasilScanTerserialisasi[];
    pengaturan: PengaturanAplikasi;
  };
}

export interface RingkasanCadangan {
  tanggalDibuat: string;
  jumlahTemplate: number;
  jumlahUjian: number;
  jumlahHasilScan: number;
}

export async function blobKeDataUrl(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const ukuranPotongan = 0x8000;
  let biner = '';
  for (let i = 0; i < bytes.length; i += ukuranPotongan) {
    const potongan = bytes.subarray(i, i + ukuranPotongan);
    biner += String.fromCharCode(...potongan);
  }
  const tipe = blob.type || 'application/octet-stream';
  return `data:${tipe};base64,${btoa(biner)}`;
}

export function dataUrlKeBlob(dataUrl: string): Blob {
  const cocok = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl);
  if (!cocok) {
    throw new Error('Format gambar di dalam file cadangan tidak dikenali.');
  }
  const [, tipe, base64] = cocok;
  const biner = atob(base64);
  const bytes = new Uint8Array(biner.length);
  for (let i = 0; i < biner.length; i++) {
    bytes[i] = biner.charCodeAt(i);
  }
  return new Blob([bytes], { type: tipe });
}

async function serialisasiTemplate(
  template: TemplateLJK,
): Promise<TemplateTerserialisasi> {
  const { gambarContoh, ...sisa } = template;
  return {
    ...sisa,
    ...(gambarContoh
      ? { gambarContoh: await blobKeDataUrl(gambarContoh) }
      : {}),
  };
}

function deserialisasiTemplate(
  template: TemplateTerserialisasi,
): TemplateLJK {
  const { gambarContoh, ...sisa } = template;
  return {
    ...sisa,
    ...(typeof gambarContoh === 'string' && gambarContoh.length > 0
      ? { gambarContoh: dataUrlKeBlob(gambarContoh) }
      : {}),
  };
}

export async function buatObjekCadangan(
  database: KoreksiLJKDatabase = db,
): Promise<FormatCadanganLJK> {
  const [templatesMentah, ujiansMentah, hasilMentah, pengaturan] =
    await Promise.all([
      database.templates.toArray(),
      database.ujians.toArray(),
      database.hasilScans.toArray(),
      ambilPengaturan(database),
    ]);

  const templates = await Promise.all(templatesMentah.map(serialisasiTemplate));

  const ujians: UjianTerserialisasi[] = await Promise.all(
    ujiansMentah.map(async (ujian) => ({
      ...ujian,
      salinanTemplate: await serialisasiTemplate(ujian.salinanTemplate),
    })),
  );

  const hasilScans: HasilScanTerserialisasi[] = await Promise.all(
    hasilMentah.map(async (hasil) => {
      const { fotoLurus, ...sisa } = hasil;
      return {
        ...sisa,
        ...(fotoLurus ? { fotoLurus: await blobKeDataUrl(fotoLurus) } : {}),
      };
    }),
  );

  return {
    aplikasi: KODE_APLIKASI_CADANGAN,
    versiCadangan: VERSI_CADANGAN,
    tanggalDibuat: new Date().toISOString(),
    data: {
      templates,
      ujians,
      hasilScans,
      pengaturan,
    },
  };
}

export function bacaDanValidasiCadangan(teksJson: string): {
  cadangan: FormatCadanganLJK;
  ringkasan: RingkasanCadangan;
} {
  let hasilParse: unknown;
  try {
    hasilParse = JSON.parse(teksJson);
  } catch {
    throw new Error(
      'File yang dipilih bukan file cadangan yang sah (format tidak terbaca).',
    );
  }

  if (!hasilParse || typeof hasilParse !== 'object') {
    throw new Error('Isi file cadangan tidak sesuai format aplikasi.');
  }

  const objek = hasilParse as Record<string, unknown>;
  if (objek.aplikasi !== KODE_APLIKASI_CADANGAN) {
    throw new Error(
      'File ini bukan file cadangan dari aplikasi Koreksi LJK.',
    );
  }

  if (objek.versiCadangan !== VERSI_CADANGAN) {
    throw new Error(
      'Versi file cadangan ini tidak didukung oleh versi aplikasi saat ini.',
    );
  }

  const data = objek.data as Record<string, unknown> | undefined;
  if (
    !data ||
    typeof data !== 'object' ||
    !Array.isArray(data.templates) ||
    !Array.isArray(data.ujians) ||
    !Array.isArray(data.hasilScans)
  ) {
    throw new Error('Struktur data di dalam file cadangan tidak lengkap.');
  }

  const cadangan = objek as unknown as FormatCadanganLJK;
  return {
    cadangan,
    ringkasan: {
      tanggalDibuat:
        typeof cadangan.tanggalDibuat === 'string'
          ? cadangan.tanggalDibuat
          : '',
      jumlahTemplate: cadangan.data.templates.length,
      jumlahUjian: cadangan.data.ujians.length,
      jumlahHasilScan: cadangan.data.hasilScans.length,
    },
  };
}

export async function pulihkanDariCadangan(
  cadangan: FormatCadanganLJK,
  database: KoreksiLJKDatabase = db,
): Promise<RingkasanCadangan> {
  // Konversi seluruh gambar sebelum transaksi IndexedDB dibuka agar transaksi tidak terputus
  const templates: TemplateLJK[] = cadangan.data.templates.map(
    deserialisasiTemplate,
  );
  const ujians: Ujian[] = cadangan.data.ujians.map((ujian) => ({
    ...ujian,
    salinanTemplate: deserialisasiTemplate(ujian.salinanTemplate),
  }));
  const hasilScans: HasilScan[] = cadangan.data.hasilScans.map((hasil) => {
    const { fotoLurus, ...sisa } = hasil;
    return {
      ...sisa,
      ...(typeof fotoLurus === 'string' && fotoLurus.length > 0
        ? { fotoLurus: dataUrlKeBlob(fotoLurus) }
        : {}),
    };
  });
  const pengaturan = normalkanPengaturan(cadangan.data.pengaturan);

  await database.transaction(
    'rw',
    [database.templates, database.ujians, database.hasilScans, database.pengaturan],
    async () => {
      await database.templates.clear();
      await database.ujians.clear();
      await database.hasilScans.clear();
      await database.pengaturan.clear();

      if (templates.length > 0) {
        await database.templates.bulkPut(templates);
      }
      if (ujians.length > 0) {
        await database.ujians.bulkPut(ujians);
      }
      if (hasilScans.length > 0) {
        await database.hasilScans.bulkPut(hasilScans);
      }
      await database.pengaturan.put(pengaturan);
    },
  );

  return {
    tanggalDibuat: cadangan.tanggalDibuat,
    jumlahTemplate: templates.length,
    jumlahUjian: ujians.length,
    jumlahHasilScan: hasilScans.length,
  };
}

export function buatNamaFileCadangan(tanggal = new Date()): string {
  const tahun = tanggal.getFullYear();
  const bulan = String(tanggal.getMonth() + 1).padStart(2, '0');
  const hari = String(tanggal.getDate()).padStart(2, '0');
  return `Cadangan_KoreksiLJK_${tahun}-${bulan}-${hari}.json`;
}

export async function unduhFileCadangan(
  database: KoreksiLJKDatabase = db,
): Promise<{ namaFile: string; ringkasan: RingkasanCadangan }> {
  const waktuSekarang = new Date();
  await simpanPengaturan(
    { terakhirCadangan: waktuSekarang.toISOString() },
    database,
  );
  const cadangan = await buatObjekCadangan(database);
  const teks = JSON.stringify(cadangan, null, 2);
  const blob = new Blob([teks], { type: 'application/json' });
  const namaFile = buatNamaFileCadangan(waktuSekarang);

  const url = URL.createObjectURL(blob);
  try {
    const tautan = document.createElement('a');
    tautan.href = url;
    tautan.download = namaFile;
    document.body.appendChild(tautan);
    tautan.click();
    tautan.remove();
  } finally {
    URL.revokeObjectURL(url);
  }

  return {
    namaFile,
    ringkasan: {
      tanggalDibuat: cadangan.tanggalDibuat,
      jumlahTemplate: cadangan.data.templates.length,
      jumlahUjian: cadangan.data.ujians.length,
      jumlahHasilScan: cadangan.data.hasilScans.length,
    },
  };
}
