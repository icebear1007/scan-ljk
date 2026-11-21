import type { WorkBook } from 'xlsx';
import type { HasilScan, Ujian } from '../types/ljk.ts';

export interface StatistikRekap {
  jumlahSiswa: number;
  rataRata: number | null;
  tertinggi: number | null;
  terendah: number | null;
  jumlahPerluDicek: number;
}

const pembandingNatural = new Intl.Collator('id-ID', {
  numeric: true,
  sensitivity: 'base',
});

export function ambilDaftarKelasUnik(daftarScan: HasilScan[]): string[] {
  const unik = new Set<string>();
  for (const item of daftarScan) {
    const kelas = item.kelas.trim();
    if (kelas) unik.add(kelas);
  }
  return [...unik].sort((a, b) => pembandingNatural.compare(a, b));
}

export function urutkanHasilRekap(daftarScan: HasilScan[]): HasilScan[] {
  return [...daftarScan].sort((a, b) => {
    const bandingKelas = pembandingNatural.compare(a.kelas, b.kelas);
    if (bandingKelas !== 0) return bandingKelas;

    const namaA = a.identitasSiswa.trim();
    const namaB = b.identitasSiswa.trim();
    if (namaA && namaB) {
      const bandingNama = pembandingNatural.compare(namaA, namaB);
      if (bandingNama !== 0) return bandingNama;
    } else if (namaA && !namaB) {
      return -1;
    } else if (!namaA && namaB) {
      return 1;
    }

    return a.tanggalScan.localeCompare(b.tanggalScan);
  });
}

export function saringDanUrutkanHasil(
  daftarScan: HasilScan[],
  filterKelas: string,
  kataKunci = '',
): HasilScan[] {
  const kueri = kataKunci.trim().toLowerCase();
  const disaring = daftarScan.filter((item) => {
    if (filterKelas && filterKelas !== 'SEMUA') {
      if (item.kelas.trim() !== filterKelas) return false;
    }
    if (kueri) {
      const cocokNama = item.identitasSiswa.toLowerCase().includes(kueri);
      const cocokKelas = item.kelas.toLowerCase().includes(kueri);
      if (!cocokNama && !cocokKelas) return false;
    }
    return true;
  });

  return urutkanHasilRekap(disaring);
}

export function hitungStatistikRekap(daftarScan: HasilScan[]): StatistikRekap {
  if (daftarScan.length === 0) {
    return {
      jumlahSiswa: 0,
      rataRata: null,
      tertinggi: null,
      terendah: null,
      jumlahPerluDicek: 0,
    };
  }

  let totalNilai = 0;
  let tertinggi = -Infinity;
  let terendah = Infinity;
  let jumlahPerluDicek = 0;

  for (const item of daftarScan) {
    totalNilai += item.nilai;
    if (item.nilai > tertinggi) tertinggi = item.nilai;
    if (item.nilai < terendah) terendah = item.nilai;
    if (item.perluDicek > 0) jumlahPerluDicek++;
  }

  const rataRata = Math.round((totalNilai / daftarScan.length) * 10) / 10;

  return {
    jumlahSiswa: daftarScan.length,
    rataRata,
    tertinggi,
    terendah,
    jumlahPerluDicek,
  };
}

export function buatNamaFileExcel(
  namaUjian: string,
  tanggal = new Date(),
): string {
  const bersih = namaUjian
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 60);

  const labelUjian = bersih || 'Ujian';
  const tahun = tanggal.getFullYear();
  const bulan = String(tanggal.getMonth() + 1).padStart(2, '0');
  const hari = String(tanggal.getDate()).padStart(2, '0');

  return `Nilai_${labelUjian}_${tahun}-${bulan}-${hari}.xlsx`;
}

export interface DataLembarExcel {
  barisRekap: Array<Array<string | number>>;
  barisJawaban: Array<Array<string | number>>;
}

/**
 * Menyusun data tabel untuk 2 lembar Excel sesuai PRD Bagian 10:
 * - Lembar 1 (Rekap): Kelas, Nama / No. Absen, Benar, Salah, Kosong, Nilai
 * - Lembar 2 (Jawaban): jawaban tiap siswa per nomor, dengan kunci jawaban di baris atas
 */
export function susunDataLembarExcel(
  ujian: Ujian,
  daftarScan: HasilScan[],
): DataLembarExcel {
  const terurut = urutkanHasilRekap(daftarScan);
  const jumlahSoal = ujian.kunciJawaban.length;

  // Lembar 1: Rekap
  const barisRekap: Array<Array<string | number>> = [
    ['Kelas', 'Nama / No. Absen', 'Benar', 'Salah', 'Kosong', 'Nilai'],
  ];

  for (const item of terurut) {
    barisRekap.push([
      item.kelas.trim() || '-',
      item.identitasSiswa.trim() || '(Belum diisi)',
      item.benar,
      item.salah,
      item.kosong,
      item.nilai,
    ]);
  }

  // Lembar 2: Jawaban per nomor dengan kunci jawaban di baris atas
  const headerNomor = Array.from({ length: jumlahSoal }, (_, i) => String(i + 1));
  const barisJawaban: Array<Array<string | number>> = [
    ['Kelas', 'Nama / No. Absen', ...headerNomor, 'Nilai'],
    [
      '',
      'KUNCI JAWABAN',
      ...ujian.kunciJawaban.map((k) => k.trim().toUpperCase() || '-'),
      '',
    ],
  ];

  for (const item of terurut) {
    const jawabanBaris = Array.from({ length: jumlahSoal }, (_, i) => {
      const jawab = (item.jawabanSetelahKoreksi[i] ?? '').trim().toUpperCase();
      if (jawab) return jawab;
      const st = item.statusPerNomor[i];
      if (st === 'ganda') return 'GANDA';
      if (st === 'ragu') return 'RAGU';
      return '-';
    });

    barisJawaban.push([
      item.kelas.trim() || '-',
      item.identitasSiswa.trim() || '(Belum diisi)',
      ...jawabanBaris,
      item.nilai,
    ]);
  }

  return { barisRekap, barisJawaban };
}

export async function buatWorkbookExcel(
  ujian: Ujian,
  daftarScan: HasilScan[],
): Promise<WorkBook> {
  const XLSX = await import('xlsx');
  const { barisRekap, barisJawaban } = susunDataLembarExcel(ujian, daftarScan);

  const wb = XLSX.utils.book_new();

  const wsRekap = XLSX.utils.aoa_to_sheet(barisRekap);
  wsRekap['!cols'] = [
    { wch: 14 }, // Kelas
    { wch: 28 }, // Nama / No. Absen
    { wch: 9 }, // Benar
    { wch: 9 }, // Salah
    { wch: 9 }, // Kosong
    { wch: 10 }, // Nilai
  ];
  XLSX.utils.book_append_sheet(wb, wsRekap, 'Rekap');

  const wsJawaban = XLSX.utils.aoa_to_sheet(barisJawaban);
  wsJawaban['!cols'] = [
    { wch: 14 },
    { wch: 28 },
    ...Array.from({ length: ujian.kunciJawaban.length }, () => ({ wch: 6 })),
    { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, wsJawaban, 'Jawaban');

  return wb;
}

export async function buatBufferExcel(
  ujian: Ujian,
  daftarScan: HasilScan[],
): Promise<Uint8Array> {
  const XLSX = await import('xlsx');
  const wb = await buatWorkbookExcel(ujian, daftarScan);
  const data = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as
    | ArrayBuffer
    | Uint8Array;
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}

export async function unduhRekapExcel(
  ujian: Ujian,
  daftarScan: HasilScan[],
): Promise<string> {
  const bytes = await buatBufferExcel(ujian, daftarScan);
  const namaFile = buatNamaFileExcel(ujian.nama);
  const salinanBytes = new Uint8Array(bytes);
  const blob = new Blob([salinanBytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

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

  return namaFile;
}
