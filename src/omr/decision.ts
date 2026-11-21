import type { PengaturanAplikasi, StatusJawaban } from '../types/ljk.ts';
import type {
  HasilBacaIdentitas,
  HasilBacaKolomIdentitas,
  HasilBacaNomor,
  PengukuranBulatan,
  RingkasanPenilaian,
  StatusBulatan,
} from './types.ts';

/**
 * Selisih minimal rasio gelap antara bulatan tergelap dan bulatan lain di baris
 * yang sama agar benar-benar yakin lebih gelap (aturan relatif per baris).
 */
export const SELISIH_RELATIF_MINIMAL = 0.12;

export function klasifikasiStatusBulatan(
  rasioGelap: number,
  pengaturan: Pick<PengaturanAplikasi, 'ambangTerisi' | 'ambangKosong'>,
): StatusBulatan {
  if (rasioGelap >= pengaturan.ambangTerisi) return 'terisi';
  if (rasioGelap < pengaturan.ambangKosong) return 'kosong';
  return 'ragu';
}

export function putuskanJawabanSatuNomor(
  nomor: number,
  pengukuranMentah: Array<Omit<PengukuranBulatan, 'status'>>,
  pengaturan: Pick<PengaturanAplikasi, 'ambangTerisi' | 'ambangKosong'>,
): HasilBacaNomor {
  const bulatan: PengukuranBulatan[] = pengukuranMentah.map((item) => ({
    ...item,
    status: klasifikasiStatusBulatan(item.rasioGelap, pengaturan),
  }));

  const terisi = bulatan.filter((b) => b.status === 'terisi');
  const raguList = bulatan.filter((b) => b.status === 'ragu');

  // 1. Dua bulatan atau lebih melampaui ambang terisi => ganda
  if (terisi.length >= 2) {
    return {
      nomor,
      bulatan,
      jawabanTerbaca: '',
      statusMentah: 'ganda',
    };
  }

  // 2. Tepat satu bulatan melampaui ambang terisi => cek aturan relatif terhadap baris
  if (terisi.length === 1) {
    const kandidat = terisi[0];
    const lainnya = bulatan.filter((b) => b.label !== kandidat.label);
    const rasioTerbesarLain = lainnya.reduce(
      (maks, b) => Math.max(maks, b.rasioGelap),
      0,
    );
    const selisihTerhadapKedua = kandidat.rasioGelap - rasioTerbesarLain;

    // Jika masih ada bekas samar/ragu di baris sama ATAU selisih terlalu tipis,
    // tandai ragu dan jangan menebak (PRD Bagian 8 & 12).
    if (raguList.length > 0 || selisihTerhadapKedua < SELISIH_RELATIF_MINIMAL) {
      return {
        nomor,
        bulatan,
        jawabanTerbaca: '',
        statusMentah: 'ragu',
      };
    }

    return {
      nomor,
      bulatan,
      jawabanTerbaca: kandidat.label,
      statusMentah: 'terjawab',
    };
  }

  // 3. Tidak ada yang mencapai ambang terisi, tetapi ada yang di zona ragu (0.20 - 0.45)
  if (raguList.length > 0) {
    return {
      nomor,
      bulatan,
      jawabanTerbaca: '',
      statusMentah: 'ragu',
    };
  }

  // 4. Semua bulatan di bawah ambang kosong
  return {
    nomor,
    bulatan,
    jawabanTerbaca: '',
    statusMentah: 'kosong',
  };
}

export function putuskanIdentitas(
  kolomMentah: Array<{
    kolomKe: number;
    bulatan: Array<Omit<PengukuranBulatan, 'status'>>;
  }>,
  pengaturan: Pick<PengaturanAplikasi, 'ambangTerisi' | 'ambangKosong'>,
): HasilBacaIdentitas {
  const perKolom: HasilBacaKolomIdentitas[] = kolomMentah.map((kolom) => {
    const keputusan = putuskanJawabanSatuNomor(
      kolom.kolomKe,
      kolom.bulatan,
      pengaturan,
    );
    const berhasilSatu = keputusan.statusMentah === 'terjawab';
    return {
      kolomKe: kolom.kolomKe,
      digitTerbaca: berhasilSatu ? keputusan.jawabanTerbaca : '?',
      ragu: !berhasilSatu,
      bulatan: keputusan.bulatan,
    };
  });

  const nilaiTerbaca = perKolom.map((k) => k.digitTerbaca).join('');
  return { nilaiTerbaca, perKolom };
}

/**
 * Memutuskan nama siswa dari kisi huruf A-Z (mis. 20 kolom x 26 baris).
 * - Memakai median tiap kolom sebagai dasar warna huruf cetakan kosong agar
 *   kolom kosong tetap terbaca sebagai spasi (' ') meski huruf cetakan A-Z agak tebal.
 * - Kolom kosong berarti spasi; spasi di awal/akhir dipangkas dan spasi beruntun dirapikan.
 * - Kolom yang ambigu (ganda atau arsiran samar) ditandai '?'.
 */
export function putuskanNamaSiswa(
  kolomMentah: Array<{
    kolomKe: number;
    bulatan: Array<Omit<PengukuranBulatan, 'status'>>;
  }>,
  pengaturan: Pick<PengaturanAplikasi, 'ambangTerisi' | 'ambangKosong'>,
): HasilBacaIdentitas {
  const perKolom: HasilBacaKolomIdentitas[] = kolomMentah.map((kolom) => {
    const nilaiUrut = kolom.bulatan
      .map((b) => b.rasioGelap)
      .sort((a, b) => a - b);
    const tengah = Math.floor(nilaiUrut.length / 2);
    const median =
      nilaiUrut.length === 0
        ? 0
        : nilaiUrut.length % 2 === 1
          ? nilaiUrut[tengah]
          : (nilaiUrut[tengah - 1] + nilaiUrut[tengah]) / 2;

    // Ambang adaptif terhadap tingkat gelap huruf cetakan kosong di kolom itu
    const ambangTerisiKolom = Math.min(
      0.85,
      Math.max(pengaturan.ambangTerisi, median + 0.26),
    );
    const ambangRaguKolom = Math.min(
      ambangTerisiKolom - 0.04,
      Math.max(pengaturan.ambangKosong, median + 0.2),
    );

    const bulatan: PengukuranBulatan[] = kolom.bulatan.map((item) => ({
      ...item,
      status:
        item.rasioGelap >= ambangTerisiKolom
          ? 'terisi'
          : item.rasioGelap < ambangRaguKolom
            ? 'kosong'
            : 'ragu',
    }));

    const terisi = bulatan.filter((b) => b.status === 'terisi');
    const raguList = bulatan.filter((b) => b.status === 'ragu');

    // 1. Tepat satu huruf jelas terisi
    if (terisi.length === 1) {
      const kandidat = terisi[0];
      const maksLain = bulatan.reduce(
        (maks, b) => (b.label === kandidat.label ? maks : Math.max(maks, b.rasioGelap)),
        0,
      );
      const selisih = kandidat.rasioGelap - maksLain;

      if (
        selisih >= 0.25 ||
        (raguList.length === 0 && selisih >= SELISIH_RELATIF_MINIMAL)
      ) {
        return {
          kolomKe: kolom.kolomKe,
          digitTerbaca: kandidat.label,
          ragu: false,
          bulatan,
        };
      }
      return {
        kolomKe: kolom.kolomKe,
        digitTerbaca: '?',
        ragu: true,
        bulatan,
      };
    }

    // 2. Lebih dari satu huruf terisi atau ada arsiran samar yang mencolok -> ragu
    if (terisi.length >= 2 || raguList.length > 0) {
      return {
        kolomKe: kolom.kolomKe,
        digitTerbaca: '?',
        ragu: true,
        bulatan,
      };
    }

    // 3. Semua bulatan di kolom ini kosong -> spasi
    return {
      kolomKe: kolom.kolomKe,
      digitTerbaca: ' ',
      ragu: false,
      bulatan,
    };
  });

  const nilaiTerbaca = perKolom
    .map((k) => k.digitTerbaca)
    .join('')
    .trim()
    .replace(/\s{2,}/g, ' ');

  return { nilaiTerbaca, perKolom };
}

export function hitungPenilaianDariBacaan(
  hasilPerNomor: HasilBacaNomor[],
  kunciJawaban: string[],
  pengaturan: Pick<
    PengaturanAplikasi,
    'poinBenar' | 'poinSalah' | 'poinKosong' | 'skalaNilai'
  >,
): { statusPerNomor: StatusJawaban[]; ringkasan: RingkasanPenilaian } {
  const statusPerNomor: StatusJawaban[] = [];
  let benar = 0;
  let salah = 0;
  let kosong = 0;
  let perluDicek = 0;

  for (let i = 0; i < hasilPerNomor.length; i++) {
    const item = hasilPerNomor[i];
    const kunci = (kunciJawaban[i] ?? '').trim().toUpperCase();

    if (item.statusMentah === 'kosong') {
      statusPerNomor.push('kosong');
      kosong++;
      perluDicek++;
    } else if (item.statusMentah === 'ganda') {
      statusPerNomor.push('ganda');
      salah++;
      perluDicek++;
    } else if (item.statusMentah === 'ragu') {
      statusPerNomor.push('ragu');
      salah++;
      perluDicek++;
    } else {
      const jawaban = item.jawabanTerbaca.trim().toUpperCase();
      if (kunci.length > 0 && jawaban === kunci) {
        statusPerNomor.push('benar');
        benar++;
      } else {
        statusPerNomor.push('salah');
        salah++;
      }
    }
  }

  const jumlahSoal = hasilPerNomor.length;
  const nilai = hitungNilaiAkhir(
    benar,
    salah,
    kosong,
    jumlahSoal,
    pengaturan,
  );

  return {
    statusPerNomor,
    ringkasan: { benar, salah, kosong, perluDicek, nilai },
  };
}

export function hitungNilaiAkhir(
  benar: number,
  salah: number,
  kosong: number,
  jumlahSoal: number,
  pengaturan: Pick<
    PengaturanAplikasi,
    'poinBenar' | 'poinSalah' | 'poinKosong' | 'skalaNilai'
  >,
): number {
  if (jumlahSoal <= 0 || pengaturan.poinBenar <= 0) return 0;

  const skorMentah =
    benar * pengaturan.poinBenar +
    salah * pengaturan.poinSalah +
    kosong * pengaturan.poinKosong;
  const skorMaksimal = jumlahSoal * pengaturan.poinBenar;
  const nilaiProporsional = Math.max(
    0,
    (skorMentah / skorMaksimal) * pengaturan.skalaNilai,
  );

  if (pengaturan.skalaNilai === 10) {
    return Math.round(nilaiProporsional * 10) / 10;
  }
  return Math.round(nilaiProporsional);
}
