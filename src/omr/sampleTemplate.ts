import type { CV } from '@techstark/opencv-js';
import type { TemplateLJK } from '../types/ljk.ts';
import {
  hitungPosisiSemuaIdentitas,
  hitungPosisiSemuaSoal,
} from './geometry.ts';
import type { GambarMentahRgba } from './types.ts';

/**
 * Template contoh standar 40 soal, 4 blok (10 soal/blok), 5 pilihan (A-E),
 * dilengkapi 4 penanda hitam di sudut dan 4 kolom identitas digit (0-9).
 * Digunakan untuk verifikasi mesin pembaca Tahap 3.
 */
export const TEMPLATE_CONTOH_40_SOAL: TemplateLJK = {
  id: 'contoh-template-40-soal',
  nama: 'Contoh LJK 40 Soal (4 Blok, A–E)',
  jumlahSoal: 40,
  jumlahPilihan: 5,
  ukuranStandar: { lebar: 1000, tinggi: 1414 },
  jenisPenanda: 'penanda-sudut',
  blokJawaban: [
    {
      nomorAwal: 1,
      jumlahNomor: 10,
      titikBulatanPertama: { x: 110, y: 520 },
      titikBulatanTerakhir: { x: 380, y: 880 },
      jumlahPilihan: 5,
      radiusBulatan: 15,
    },
    {
      nomorAwal: 11,
      jumlahNomor: 10,
      titikBulatanPertama: { x: 590, y: 520 },
      titikBulatanTerakhir: { x: 860, y: 880 },
      jumlahPilihan: 5,
      radiusBulatan: 15,
    },
    {
      nomorAwal: 21,
      jumlahNomor: 10,
      titikBulatanPertama: { x: 110, y: 980 },
      titikBulatanTerakhir: { x: 380, y: 1340 },
      jumlahPilihan: 5,
      radiusBulatan: 15,
    },
    {
      nomorAwal: 31,
      jumlahNomor: 10,
      titikBulatanPertama: { x: 590, y: 980 },
      titikBulatanTerakhir: { x: 860, y: 1340 },
      jumlahPilihan: 5,
      radiusBulatan: 15,
    },
  ],
  blokIdentitas: [0, 1, 2, 3].map((idx) => ({
    kolomKe: idx + 1,
    titikDigitPertama: { x: 640 + idx * 52, y: 120 },
    titikDigitTerakhir: { x: 640 + idx * 52, y: 410 },
    jumlahDigit: 10,
    radiusBulatan: 11,
  })),
  tanggalDibuat: '2026-11-21T00:00:00.000Z',
  tanggalDiubah: '2026-11-21T00:00:00.000Z',
};

export const KUNCI_CONTOH_40_SOAL: string[] = [
  'A', 'B', 'C', 'D', 'E', 'A', 'C', 'B', 'D', 'E',
  'B', 'A', 'D', 'C', 'E', 'C', 'B', 'A', 'E', 'D',
  'D', 'E', 'A', 'B', 'C', 'A', 'B', 'C', 'D', 'E',
  'E', 'D', 'C', 'B', 'A', 'C', 'A', 'D', 'B', 'E',
];

export type GayaIsianBulatan = 'penuh' | 'tipis' | 'bekas-hapus';

export interface OpsiGambarContohLJK {
  /** Jawaban yang dihitamkan penuh per nomor (index 0..39). String bisa berisi 2 huruf untuk ganda, '' untuk kosong. */
  jawabanDiisi: string[];
  /** Nomor 1-based dengan arsiran pensil tipis (kegelapan sedang -> ragu). */
  arsiranTipis?: Record<number, string>;
  /** Nomor 1-based dengan bekas hapus samar (ragu). */
  bekasHapus?: Record<number, string>;
  /** 4 digit identitas siswa (mis. '2407'). */
  identitasDigit?: string;
  /** Kemiringan kertas dalam derajat (mis. 4 atau -6). */
  kemiringanDerajat?: number;
  /** Distorsi perspektif ringan (0..0.15). */
  perspektif?: number;
  /** Kekuatan gradien bayangan diagonal (0..90). */
  bayangan?: number;
  /** Penggelapan global (mis. 0.25 untuk simulasi foto terlalu gelap). */
  faktorCahaya?: number;
  /** Geser seluruh isi kisi (piksel) untuk simulasi ketidaksejajaran. */
  geserIsiX?: number;
  geserIsiY?: number;
  /** Sembunyikan penanda sudut untuk menguji deteksi tepi kertas. */
  tanpaPenandaSudut?: boolean;
}

/**
 * Menghasilkan foto contoh LJK realistis (kertas di atas meja dengan penanda sudut,
 * garis lingkaran bulatan, huruf A-E tercetak di dalam bulatan kosong, variasi arsiran,
 * perspektif miring, dan bayangan) memakai OpenCV.js.
 */
export function buatFotoContohLjkDenganOpenCv(
  cv: CV,
  template: TemplateLJK,
  opsi: OpsiGambarContohLJK,
): GambarMentahRgba {
  const W = template.ukuranStandar.lebar;
  const H = template.ukuranStandar.tinggi;
  const marginKertas = 54;
  const ukuranPenanda = 36;
  const lembarW = W + marginKertas * 2;
  const lembarH = H + marginKertas * 2;

  const lembar = new cv.Mat(
    lembarH,
    lembarW,
    cv.CV_8UC4,
    new cv.Scalar(246, 245, 240, 255),
  );

  try {
    // 1. Gambar 4 penanda hitam di sudut sehingga pusat penanda jatuh tepat di sudut area W x H
    if (!opsi.tanpaPenandaSudut) {
      const setengah = Math.round(ukuranPenanda / 2);
      const pusatPenanda: Array<[number, number]> = [
        [marginKertas, marginKertas],
        [marginKertas + W - 1, marginKertas],
        [marginKertas + W - 1, marginKertas + H - 1],
        [marginKertas, marginKertas + H - 1],
      ];
      for (const [px, py] of pusatPenanda) {
        cv.rectangle(
          lembar,
          new cv.Point(px - setengah, py - setengah),
          new cv.Point(px + setengah, py + setengah),
          new cv.Scalar(18, 18, 18, 255),
          -1,
        );
      }
    }

    // Header dekoratif LJK
    cv.putText(
      lembar,
      'LEMBAR JAWABAN KOMPUTER (CONTOH UJI)',
      new cv.Point(marginKertas + 70, marginKertas + 70),
      cv.FONT_HERSHEY_SIMPLEX,
      0.75,
      new cv.Scalar(45, 45, 45, 255),
      2,
    );

    const geserX = opsi.geserIsiX ?? 0;
    const geserY = opsi.geserIsiY ?? 0;

    // 2. Gambar semua bulatan soal + huruf cetakan + isian
    const semuaSoal = hitungPosisiSemuaSoal(template);
    for (const soal of semuaSoal) {
      const idx = soal.nomor - 1;
      const isian = (opsi.jawabanDiisi[idx] ?? '').toUpperCase();
      const tipis = (opsi.arsiranTipis?.[soal.nomor] ?? '').toUpperCase();
      const hapus = (opsi.bekasHapus?.[soal.nomor] ?? '').toUpperCase();

      // Nomor soal di sebelah kiri bulatan A
      const titikA = soal.pilihan[0].pusat;
      cv.putText(
        lembar,
        String(soal.nomor).padStart(2, '0'),
        new cv.Point(
          Math.round(marginKertas + titikA.x + geserX - 54),
          Math.round(marginKertas + titikA.y + geserY + 6),
        ),
        cv.FONT_HERSHEY_SIMPLEX,
        0.55,
        new cv.Scalar(55, 55, 55, 255),
        1,
      );

      for (const pil of soal.pilihan) {
        const cx = Math.round(marginKertas + pil.pusat.x + geserX);
        const cy = Math.round(marginKertas + pil.pusat.y + geserY);
        const r = Math.round(pil.radius);

        // Garis pinggir bulatan LJK
        cv.circle(
          lembar,
          new cv.Point(cx, cy),
          r,
          new cv.Scalar(85, 85, 85, 255),
          2,
        );

        // Huruf tipis tercetak di tengah bulatan (seperti LJK sekolah asli)
        cv.putText(
          lembar,
          pil.label,
          new cv.Point(cx - 5, cy + 5),
          cv.FONT_HERSHEY_SIMPLEX,
          0.42,
          new cv.Scalar(145, 145, 145, 255),
          1,
        );

        if (isian.includes(pil.label)) {
          // Arsiran penuh pensil 2B
          cv.circle(
            lembar,
            new cv.Point(cx, cy),
            Math.max(3, Math.round(r * 0.82)),
            new cv.Scalar(38, 38, 40, 255),
            -1,
          );
        } else if (tipis.includes(pil.label)) {
          // Pensil terlalu tipis (~0.32 kegelapan)
          cv.circle(
            lembar,
            new cv.Point(cx, cy),
            Math.max(3, Math.round(r * 0.72)),
            new cv.Scalar(185, 185, 185, 255),
            -1,
          );
        } else if (hapus.includes(pil.label)) {
          // Bekas hapus samar (~0.28 kegelapan)
          cv.circle(
            lembar,
            new cv.Point(cx, cy),
            Math.max(3, Math.round(r * 0.68)),
            new cv.Scalar(194, 194, 194, 255),
            -1,
          );
        }
      }
    }

    // 3. Gambar blok identitas jika ada
    const semuaIdentitas = hitungPosisiSemuaIdentitas(template);
    const digitTarget = (opsi.identitasDigit ?? '').trim();
    for (let k = 0; k < semuaIdentitas.length; k++) {
      const kolom = semuaIdentitas[k];
      const digitDiisi = digitTarget[k] ?? '';
      for (const d of kolom.digit) {
        const cx = Math.round(marginKertas + d.pusat.x + geserX);
        const cy = Math.round(marginKertas + d.pusat.y + geserY);
        const r = Math.round(d.radius);

        cv.circle(
          lembar,
          new cv.Point(cx, cy),
          r,
          new cv.Scalar(90, 90, 90, 255),
          2,
        );
        if (digitDiisi === d.label) {
          cv.circle(
            lembar,
            new cv.Point(cx, cy),
            Math.max(3, Math.round(r * 0.8)),
            new cv.Scalar(35, 35, 38, 255),
            -1,
          );
        }
      }
    }

    // 4. Tempatkan kertas di atas latar meja gelap dengan kemiringan & perspektif
    const kanvasW = 1280;
    const kanvasH = 1680;
    const kanvas = new cv.Mat(
      kanvasH,
      kanvasW,
      cv.CV_8UC4,
      new cv.Scalar(68, 56, 48, 255),
    );

    try {
      const rad = ((opsi.kemiringanDerajat ?? 0) * Math.PI) / 180;
      const persp = opsi.perspektif ?? 0;

      const skala = 0.84;
      const hw = (lembarW * skala) / 2;
      const hh = (lembarH * skala) / 2;
      const cxKanvas = kanvasW / 2;
      const cyKanvas = kanvasH / 2;

      const sudutLokal: Array<[number, number]> = [
        [-hw * (1 - persp), -hh],
        [hw * (1 - persp), -hh],
        [hw * (1 + persp * 0.5), hh],
        [-hw * (1 + persp * 0.5), hh],
      ];

      const dstCoords: number[] = [];
      for (const [lx, ly] of sudutLokal) {
        const rx = lx * Math.cos(rad) - ly * Math.sin(rad) + cxKanvas;
        const ry = lx * Math.sin(rad) + ly * Math.cos(rad) + cyKanvas;
        dstCoords.push(rx, ry);
      }

      const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [
        0,
        0,
        lembarW - 1,
        0,
        lembarW - 1,
        lembarH - 1,
        0,
        lembarH - 1,
      ]);
      const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, dstCoords);
      const Hmat = cv.getPerspectiveTransform(srcPts, dstPts);

      try {
        cv.warpPerspective(
          lembar,
          kanvas,
          Hmat,
          new cv.Size(kanvasW, kanvasH),
          cv.INTER_LINEAR,
          cv.BORDER_TRANSPARENT,
        );
      } finally {
        srcPts.delete();
        dstPts.delete();
        Hmat.delete();
      }

      // 5. Terapkan bayangan miring & faktor cahaya jika diminta
      const bayangan = opsi.bayangan ?? 0;
      const faktorCahaya = opsi.faktorCahaya ?? 1;
      const data = new Uint8ClampedArray(kanvas.data);

      if (bayangan > 0 || faktorCahaya !== 1) {
        for (let y = 0; y < kanvasH; y++) {
          const fy = y / kanvasH;
          for (let x = 0; x < kanvasW; x++) {
            const fx = x / kanvasW;
            const kurangBayangan = bayangan * (0.5 * fx + 0.5 * fy);
            const idx = (y * kanvasW + x) * 4;
            data[idx] = Math.max(
              0,
              Math.min(255, Math.round((data[idx] - kurangBayangan) * faktorCahaya)),
            );
            data[idx + 1] = Math.max(
              0,
              Math.min(
                255,
                Math.round((data[idx + 1] - kurangBayangan) * faktorCahaya),
              ),
            );
            data[idx + 2] = Math.max(
              0,
              Math.min(
                255,
                Math.round((data[idx + 2] - kurangBayangan) * faktorCahaya),
              ),
            );
          }
        }
      }

      return { lebar: kanvasW, tinggi: kanvasH, data };
    } finally {
      kanvas.delete();
    }
  } finally {
    lembar.delete();
  }
}
