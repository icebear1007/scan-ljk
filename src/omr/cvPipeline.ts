import type { CV, Mat } from '@techstark/opencv-js';
import type { StatusJawaban, Titik } from '../types/ljk.ts';
import {
  hitungPenilaianDariBacaan,
  putuskanIdentitas,
  putuskanJawabanSatuNomor,
  putuskanNamaSiswa,
} from './decision.ts';
import {
  evaluasiGeometriSegiEmpat,
  hitungPosisiSemuaIdentitas,
  hitungPosisiSemuaSoal,
  hitungUkuranStandarDariSudut,
  jarakTitik,
  urutkanEmpatSudut,
} from './geometry.ts';
import type {
  EmpatSudut,
  GambarMentahRgba,
  HasilBacaLJK,
  HasilBacaNomor,
  HasilDeteksiKertas,
  MetodeDeteksiKertas,
  OpsiBacaLJK,
  OpsiDeteksiKertas,
  PengukuranBulatan,
  PeringatanKualitas,
} from './types.ts';

const LEBAR_KERJA_MAKSIMAL = 1600;

interface DapatDihapus {
  delete(): void;
}

class PoolMat {
  private daftar: DapatDihapus[] = [];

  catat<T extends DapatDihapus>(obj: T): T {
    this.daftar.push(obj);
    return obj;
  }

  bersihkan(): void {
    for (let i = this.daftar.length - 1; i >= 0; i--) {
      try {
        this.daftar[i].delete();
      } catch {
        // Abaikan jika sudah dihapus sebelumnya
      }
    }
    this.daftar = [];
  }
}

interface KandidatPenanda {
  pusat: Titik;
  area: number;
  rasioIsi: number;
  kegelapan: number;
}

function buatMatDariRgba(cv: CV, gambar: GambarMentahRgba, pool: PoolMat): Mat {
  const mat = pool.catat(new cv.Mat(gambar.tinggi, gambar.lebar, cv.CV_8UC4));
  mat.data.set(gambar.data);
  return mat;
}

function ekstrakRgbaDariMat(mat: Mat): GambarMentahRgba {
  return {
    lebar: mat.cols,
    tinggi: mat.rows,
    data: new Uint8ClampedArray(mat.data),
  };
}

function skalaSudut(sudut: EmpatSudut, faktor: number): EmpatSudut {
  return {
    kiriAtas: { x: sudut.kiriAtas.x * faktor, y: sudut.kiriAtas.y * faktor },
    kananAtas: { x: sudut.kananAtas.x * faktor, y: sudut.kananAtas.y * faktor },
    kananBawah: {
      x: sudut.kananBawah.x * faktor,
      y: sudut.kananBawah.y * faktor,
    },
    kiriBawah: { x: sudut.kiriBawah.x * faktor, y: sudut.kiriBawah.y * faktor },
  };
}

function cekKualitasPencahayaan(
  cv: CV,
  gray: Mat,
  pool: PoolMat,
): {
  kecerahanRataRata: number;
  kontrasStdDev: number;
  peringatan: PeringatanKualitas[];
} {
  const meanMat = pool.catat(new cv.Mat());
  const stdMat = pool.catat(new cv.Mat());
  cv.meanStdDev(gray, meanMat, stdMat);

  const kecerahanRataRata = Number(meanMat.doubleAt(0, 0).toFixed(1));
  const kontrasStdDev = Number(stdMat.doubleAt(0, 0).toFixed(1));
  const peringatan: PeringatanKualitas[] = [];

  if (kecerahanRataRata < 45) {
    peringatan.push({
      kode: 'terlalu-gelap',
      pesan:
        'Foto terlalu gelap. Pindah ke tempat yang lebih terang lalu foto ulang.',
      perluFotoUlang: true,
    });
  } else if (kecerahanRataRata > 245 && kontrasStdDev < 15) {
    peringatan.push({
      kode: 'terlalu-terang',
      pesan:
        'Foto terlalu terang atau silau. Hindari cahaya lampu langsung lalu foto ulang.',
      perluFotoUlang: true,
    });
  }

  if (kontrasStdDev < 12) {
    peringatan.push({
      kode: 'kontras-rendah',
      pesan:
        'Gambar terlalu buram atau kontras terlalu rendah. Pastikan foto fokus lalu foto ulang.',
      perluFotoUlang: true,
    });
  }

  return { kecerahanRataRata, kontrasStdDev, peringatan };
}

/**
 * Memeriksa apakah sebagian kertas tertutup bayangan gelap yang sangat tidak merata
 * dengan membandingkan kecerahan latar kertas (persentil ke-80) di 16 area (kisi 4x4).
 */
function cekBayanganTidakMerata(
  grayData: Uint8Array,
  lebar: number,
  tinggi: number,
): { berbayangKuat: boolean; selisihLatar: number } {
  const jumlahGrid = 4;
  const marginX = Math.floor(lebar * 0.05);
  const marginY = Math.floor(tinggi * 0.05);
  const lebarArea = Math.max(jumlahGrid, lebar - marginX * 2);
  const tinggiArea = Math.max(jumlahGrid, tinggi - marginY * 2);
  const lebarPetak = Math.floor(lebarArea / jumlahGrid);
  const tinggiPetak = Math.floor(tinggiArea / jumlahGrid);

  let latarMin = 255;
  let latarMaks = 0;

  for (let br = 0; br < jumlahGrid; br++) {
    const y0 = marginY + br * tinggiPetak;
    const y1 = Math.min(tinggi, y0 + tinggiPetak);
    for (let kl = 0; kl < jumlahGrid; kl++) {
      const x0 = marginX + kl * lebarPetak;
      const x1 = Math.min(lebar, x0 + lebarPetak);

      const hist = new Uint32Array(256);
      let total = 0;
      for (let y = y0; y < y1; y += 4) {
        const baris = y * lebar;
        for (let x = x0; x < x1; x += 4) {
          hist[grayData[baris + x]]++;
          total++;
        }
      }

      if (total === 0) continue;
      const target = Math.floor(total * 0.8);
      let kumulatif = 0;
      let latarPetak = 235;
      for (let v = 0; v < 256; v++) {
        kumulatif += hist[v];
        if (kumulatif >= target) {
          latarPetak = v;
          break;
        }
      }

      if (latarPetak < latarMin) latarMin = latarPetak;
      if (latarPetak > latarMaks) latarMaks = latarPetak;
    }
  }

  const selisihLatar = Math.max(0, latarMaks - latarMin);
  return {
    berbayangKuat: selisihLatar >= 70,
    selisihLatar,
  };
}

function rataRataIntensitasKotak(
  grayData: Uint8Array,
  lebar: number,
  x0: number,
  y0: number,
  w: number,
  h: number,
): number {
  let total = 0;
  let jumlah = 0;
  const xAkhir = x0 + w;
  const yAkhir = y0 + h;
  for (let y = y0; y < yAkhir; y++) {
    const baris = y * lebar;
    for (let x = x0; x < xAkhir; x++) {
      total += grayData[baris + x];
      jumlah++;
    }
  }
  return jumlah > 0 ? total / jumlah : 255;
}

function deteksiPenandaSudut(
  cv: CV,
  claheGray: Mat,
  pool: PoolMat,
): EmpatSudut | null {
  const lebar = claheGray.cols;
  const tinggi = claheGray.rows;
  const luasGambar = lebar * tinggi;

  const ukuranBlok = Math.max(
    31,
    Math.min(91, (Math.round(Math.min(lebar, tinggi) * 0.06) | 1)),
  );
  const biner = pool.catat(new cv.Mat());
  cv.adaptiveThreshold(
    claheGray,
    biner,
    255,
    cv.ADAPTIVE_THRESH_GAUSSIAN_C,
    cv.THRESH_BINARY_INV,
    ukuranBlok,
    18,
  );

  const kernel = pool.catat(
    cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3)),
  );
  cv.morphologyEx(biner, biner, cv.MORPH_CLOSE, kernel);

  const contours = pool.catat(new cv.MatVector());
  const hierarchy = pool.catat(new cv.Mat());
  cv.findContours(
    biner,
    contours,
    hierarchy,
    cv.RETR_LIST,
    cv.CHAIN_APPROX_SIMPLE,
  );

  const luasMin = luasGambar * 0.00012;
  const luasMaks = luasGambar * 0.025;
  const grayData = claheGray.data as Uint8Array;
  const kandidat: KandidatPenanda[] = [];

  for (let i = 0; i < contours.size(); i++) {
    const cnt = contours.get(i);
    try {
      const area = cv.contourArea(cnt);
      if (area < luasMin || area > luasMaks) continue;

      const rect = cv.boundingRect(cnt);
      if (rect.width < 8 || rect.height < 8) continue;

      const rasioAspek = rect.width / rect.height;
      if (rasioAspek < 0.55 || rasioAspek > 1.8) continue;

      const luasKotak = rect.width * rect.height;
      const rasioIsi = area / luasKotak;
      if (rasioIsi < 0.55) continue;

      // Pastikan bagian tengah penanda benar-benar gelap (bukan bingkai kosong)
      const marginX = Math.floor(rect.width * 0.2);
      const marginY = Math.floor(rect.height * 0.2);
      const meanInt = rataRataIntensitasKotak(
        grayData,
        lebar,
        rect.x + marginX,
        rect.y + marginY,
        Math.max(1, rect.width - 2 * marginX),
        Math.max(1, rect.height - 2 * marginY),
      );
      if (meanInt > 135) continue;

      kandidat.push({
        pusat: {
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
        },
        area,
        rasioIsi,
        kegelapan: 1 - meanInt / 255,
      });
    } finally {
      cnt.delete();
    }
  }

  if (kandidat.length < 4) return null;

  // Bagi ke 4 kuadran gambar; pilih kandidat terbaik di tiap kuadran yang ukurannya seragam
  const tengahX = lebar / 2;
  const tengahY = tinggi / 2;
  const kuadran: KandidatPenanda[][] = [[], [], [], []];

  for (const k of kandidat) {
    const kanan = k.pusat.x >= tengahX ? 1 : 0;
    const bawah = k.pusat.y >= tengahY ? 1 : 0;
    const idx = bawah * 2 + kanan; // 0: KA, 1: KnA, 2: KB, 3: KnB
    kuadran[idx].push(k);
  }

  if (kuadran.some((q) => q.length === 0)) return null;

  // Batasi 6 kandidat terbaik per kuadran (paling dekat ke pojok kuadran + solid & gelap)
  const pojokAcuan: Titik[] = [
    { x: 0, y: 0 },
    { x: lebar, y: 0 },
    { x: 0, y: tinggi },
    { x: lebar, y: tinggi },
  ];

  const topPerKuadran = kuadran.map((list, idx) => {
    const pojok = pojokAcuan[idx];
    return [...list]
      .sort((a, b) => {
        const skorA =
          jarakTitik(a.pusat, pojok) / Math.hypot(lebar, tinggi) -
          a.rasioIsi * 0.25 -
          a.kegelapan * 0.25;
        const skorB =
          jarakTitik(b.pusat, pojok) / Math.hypot(lebar, tinggi) -
          b.rasioIsi * 0.25 -
          b.kegelapan * 0.25;
        return skorA - skorB;
      })
      .slice(0, 6);
  });

  let terbaik: { sudut: EmpatSudut; skor: number } | null = null;

  for (const ka of topPerKuadran[0]) {
    for (const kna of topPerKuadran[1]) {
      for (const kb of topPerKuadran[2]) {
        for (const knb of topPerKuadran[3]) {
          const areaList = [ka.area, kna.area, kb.area, knb.area];
          const areaMin4 = Math.min(...areaList);
          const areaMaks4 = Math.max(...areaList);
          if (areaMaks4 / Math.max(1, areaMin4) > 3.2) continue;

          const sudut: EmpatSudut = {
            kiriAtas: ka.pusat,
            kananAtas: kna.pusat,
            kananBawah: knb.pusat,
            kiriBawah: kb.pusat,
          };

          const evalGeo = evaluasiGeometriSegiEmpat(sudut, lebar, tinggi);
          if (!evalGeo.sah) continue;

          const rataSolid =
            (ka.rasioIsi + kna.rasioIsi + kb.rasioIsi + knb.rasioIsi) / 4;
          const rataGelap =
            (ka.kegelapan + kna.kegelapan + kb.kegelapan + knb.kegelapan) / 4;
          const konsistensiUkuran = 1 - (areaMaks4 - areaMin4) / areaMaks4;

          // Lebih suka segi empat berarea besar dengan penanda seragam, solid, dan gelap
          const skor =
            evalGeo.rasioArea * 2.0 +
            rataSolid * 0.8 +
            rataGelap * 0.8 +
            konsistensiUkuran * 0.6;

          if (!terbaik || skor > terbaik.skor) {
            terbaik = { sudut, skor };
          }
        }
      }
    }
  }

  return terbaik ? terbaik.sudut : null;
}

function cariSegiEmpatTerbesarDariBiner(
  cv: CV,
  maskBiner: Mat,
  lebar: number,
  tinggi: number,
  pool: PoolMat,
): EmpatSudut | null {
  const contours = pool.catat(new cv.MatVector());
  const hierarchy = pool.catat(new cv.Mat());
  cv.findContours(
    maskBiner,
    contours,
    hierarchy,
    cv.RETR_EXTERNAL,
    cv.CHAIN_APPROX_SIMPLE,
  );

  const kandidatKontur: Array<{ index: number; area: number }> = [];
  const luasGambar = lebar * tinggi;
  const luasMin = luasGambar * 0.15;
  const luasMaks = luasGambar * 0.98;

  for (let i = 0; i < contours.size(); i++) {
    const cnt = contours.get(i);
    try {
      const area = cv.contourArea(cnt);
      if (area >= luasMin && area <= luasMaks) {
        kandidatKontur.push({ index: i, area });
      }
    } finally {
      cnt.delete();
    }
  }

  kandidatKontur.sort((a, b) => b.area - a.area);

  for (const item of kandidatKontur.slice(0, 8)) {
    const cnt = contours.get(item.index);
    const approx = new cv.Mat();
    try {
      const peri = cv.arcLength(cnt, true);
      for (const eps of [0.02, 0.03, 0.04, 0.05]) {
        cv.approxPolyDP(cnt, approx, eps * peri, true);
        if (approx.rows === 4 && cv.isContourConvex(approx)) {
          const pts: Titik[] = [];
          for (let r = 0; r < 4; r++) {
            pts.push({
              x: approx.intAt(r, 0),
              y: approx.intAt(r, 1),
            });
          }
          const sudut = urutkanEmpatSudut(pts);
          const evaluasi = evaluasiGeometriSegiEmpat(sudut, lebar, tinggi);
          if (evaluasi.sah) {
            return sudut;
          }
        }
      }
    } finally {
      cnt.delete();
      approx.delete();
    }
  }

  return null;
}

function deteksiTepiKertas(
  cv: CV,
  gray: Mat,
  claheGray: Mat,
  pool: PoolMat,
): EmpatSudut | null {
  const lebar = gray.cols;
  const tinggi = gray.rows;

  // Jalur 1: Canny pada gambar halus CLAHE
  const blur = pool.catat(new cv.Mat());
  cv.GaussianBlur(claheGray, blur, new cv.Size(5, 5), 0);

  const canny = pool.catat(new cv.Mat());
  cv.Canny(blur, canny, 40, 120);

  const kernelTepi = pool.catat(
    cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5)),
  );
  cv.dilate(canny, canny, kernelTepi);

  const dariCanny = cariSegiEmpatTerbesarDariBiner(
    cv,
    canny,
    lebar,
    tinggi,
    pool,
  );
  if (dariCanny) return dariCanny;

  // Jalur 2: Otsu pada gambar grayscale asli (kertas terang di atas meja gelap)
  const blurAsli = pool.catat(new cv.Mat());
  cv.GaussianBlur(gray, blurAsli, new cv.Size(7, 7), 0);

  const otsu = pool.catat(new cv.Mat());
  cv.threshold(blurAsli, otsu, 0, 255, cv.THRESH_BINARY | cv.THRESH_OTSU);

  const kernelTutup = pool.catat(
    cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(9, 9)),
  );
  cv.morphologyEx(otsu, otsu, cv.MORPH_CLOSE, kernelTutup);

  return cariSegiEmpatTerbesarDariBiner(cv, otsu, lebar, tinggi, pool);
}

function ukurKegelapanSatuBulatan(
  grayData: Uint8Array,
  lebar: number,
  tinggi: number,
  pusat: Titik,
  radius: number,
): number {
  const cx = Math.round(pusat.x);
  const cy = Math.round(pusat.y);
  const rDalam = Math.max(1.5, radius * 0.7);
  const rDalamKuadrat = rDalam * rDalam;

  // Hitung kecerahan latar kertas lokal (persentil ke-85 di kotak sekitar 3x radius)
  const jangkauanLatar = Math.max(12, Math.round(radius * 2.8));
  const lx0 = Math.max(0, cx - jangkauanLatar);
  const lx1 = Math.min(lebar - 1, cx + jangkauanLatar);
  const ly0 = Math.max(0, cy - jangkauanLatar);
  const ly1 = Math.min(tinggi - 1, cy + jangkauanLatar);

  const hist = new Uint32Array(256);
  let totalLatar = 0;
  for (let y = ly0; y <= ly1; y += 2) {
    const baris = y * lebar;
    for (let x = lx0; x <= lx1; x += 2) {
      hist[grayData[baris + x]]++;
      totalLatar++;
    }
  }

  let latarLokal = 235;
  if (totalLatar > 0) {
    const target = Math.floor(totalLatar * 0.85);
    let kumulatif = 0;
    for (let v = 0; v < 256; v++) {
      kumulatif += hist[v];
      if (kumulatif >= target) {
        latarLokal = v;
        break;
      }
    }
  }

  const rentangSkala = Math.max(48, latarLokal * 0.65);

  const x0 = Math.max(0, Math.floor(cx - rDalam));
  const x1 = Math.min(lebar - 1, Math.ceil(cx + rDalam));
  const y0 = Math.max(0, Math.floor(cy - rDalam));
  const y1 = Math.min(tinggi - 1, Math.ceil(cy + rDalam));

  let jumlahKegelapan = 0;
  let jumlahPiksel = 0;

  for (let y = y0; y <= y1; y++) {
    const dy = y - pusat.y;
    const baris = y * lebar;
    for (let x = x0; x <= x1; x++) {
      const dx = x - pusat.x;
      if (dx * dx + dy * dy > rDalamKuadrat) continue;

      const intensitas = grayData[baris + x];
      const selisih = latarLokal - intensitas;
      // Abaikan derau tekstur kertas sangat kecil (< 12 tingkat keabuan)
      if (selisih > 12) {
        const d = Math.min(1, selisih / rentangSkala);
        jumlahKegelapan += d;
      }
      jumlahPiksel++;
    }
  }

  if (jumlahPiksel === 0) return 0;
  return Number((jumlahKegelapan / jumlahPiksel).toFixed(3));
}

/**
 * Mengukur kekuatan garis lingkaran cetakan pada radius r untuk mengecek apakah
 * kisi bulatan benar-benar sejajar atau bergeser secara sistematis.
 */
function skorTepiLingkaranPadaOffset(
  grayData: Uint8Array,
  lebar: number,
  tinggi: number,
  sampel: Array<{ pusat: Titik; radius: number }>,
  offsetX: number,
  offsetY: number,
): number {
  const jumlahSudut = 16;
  let totalSkor = 0;
  let terukur = 0;

  for (const item of sampel) {
    const cx = item.pusat.x + offsetX;
    const cy = item.pusat.y + offsetY;
    const r = item.radius;

    let gelapTepi = 0;
    let terangLuar = 0;
    let valid = 0;

    for (let k = 0; k < jumlahSudut; k++) {
      const theta = (k / jumlahSudut) * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      const xTepi = Math.round(cx + cosT * r);
      const yTepi = Math.round(cy + sinT * r);
      const xLuar = Math.round(cx + cosT * (r + 4));
      const yLuar = Math.round(cy + sinT * (r + 4));

      if (
        xTepi < 0 ||
        xTepi >= lebar ||
        yTepi < 0 ||
        yTepi >= tinggi ||
        xLuar < 0 ||
        xLuar >= lebar ||
        yLuar < 0 ||
        yLuar >= tinggi
      ) {
        continue;
      }

      gelapTepi += grayData[yTepi * lebar + xTepi];
      terangLuar += grayData[yLuar * lebar + xLuar];
      valid++;
    }

    if (valid >= 8) {
      // Semakin gelap tepi dibanding tepat di luar lingkaran, semakin cocok posisinya
      totalSkor += (terangLuar - gelapTepi) / valid;
      terukur++;
    }
  }

  return terukur > 0 ? totalSkor / terukur : 0;
}

function cekPergeseranGrid(
  grayData: Uint8Array,
  lebar: number,
  tinggi: number,
  semuaBulatan: Array<{ pusat: Titik; radius: number }>,
): { bergeser: boolean; skorPergeseran: number } {
  if (semuaBulatan.length === 0) {
    return { bergeser: false, skorPergeseran: 0 };
  }

  // Ambil maksimal 24 sampel merata di seluruh lembar
  const langkah = Math.max(1, Math.floor(semuaBulatan.length / 24));
  const sampel: Array<{ pusat: Titik; radius: number }> = [];
  for (let i = 0; i < semuaBulatan.length && sampel.length < 24; i += langkah) {
    sampel.push(semuaBulatan[i]);
  }

  const rContoh = sampel[0].radius;
  const geser = Math.max(6, Math.round(rContoh * 0.75));
  const skorPusat = skorTepiLingkaranPadaOffset(
    grayData,
    lebar,
    tinggi,
    sampel,
    0,
    0,
  );

  const kandidatOffset: Array<[number, number]> = [
    [-geser, 0],
    [geser, 0],
    [0, -geser],
    [0, geser],
    [-geser, -geser],
    [geser, -geser],
    [-geser, geser],
    [geser, geser],
  ];

  let skorGeserMaks = skorPusat;
  for (const [ox, oy] of kandidatOffset) {
    const s = skorTepiLingkaranPadaOffset(
      grayData,
      lebar,
      tinggi,
      sampel,
      ox,
      oy,
    );
    if (s > skorGeserMaks) {
      skorGeserMaks = s;
    }
  }

  // Jika posisi geser menghasilkan kecocokan lingkaran jauh lebih tinggi dari posisi pusat,
  // berarti kertas melenceng dari kisi template.
  const selisih = skorGeserMaks - skorPusat;
  const bergeser = skorGeserMaks > 14 && selisih > Math.max(10, skorPusat * 0.65);

  return {
    bergeser,
    skorPergeseran: Number(Math.max(0, selisih).toFixed(1)),
  };
}

function luruskanPerspektif(
  cv: CV,
  sumber: Mat,
  sudut: EmpatSudut,
  lebarTujuan: number,
  tinggiTujuan: number,
  pool: PoolMat,
): Mat {
  const srcPts = pool.catat(
    cv.matFromArray(4, 1, cv.CV_32FC2, [
      sudut.kiriAtas.x,
      sudut.kiriAtas.y,
      sudut.kananAtas.x,
      sudut.kananAtas.y,
      sudut.kananBawah.x,
      sudut.kananBawah.y,
      sudut.kiriBawah.x,
      sudut.kiriBawah.y,
    ]),
  );

  const dstPts = pool.catat(
    cv.matFromArray(4, 1, cv.CV_32FC2, [
      0,
      0,
      lebarTujuan - 1,
      0,
      lebarTujuan - 1,
      tinggiTujuan - 1,
      0,
      tinggiTujuan - 1,
    ]),
  );

  const matriks = pool.catat(cv.getPerspectiveTransform(srcPts, dstPts));
  const hasil = pool.catat(new cv.Mat());
  cv.warpPerspective(
    sumber,
    hasil,
    matriks,
    new cv.Size(lebarTujuan, tinggiTujuan),
    cv.INTER_LINEAR,
    cv.BORDER_REPLICATE,
  );
  return hasil;
}

export function deteksiDanLuruskanKertas(
  cv: CV,
  gambar: GambarMentahRgba,
  opsi: OpsiDeteksiKertas,
): HasilDeteksiKertas {
  const mulai = performance.now();
  const pool = new PoolMat();

  try {
    const rgbaAsli = buatMatDariRgba(cv, gambar, pool);

    // Langkah 1: kecilkan ke lebar sekitar 1600 piksel agar cepat
    let skalaKeKerja = 1;
    let rgbaKerja = rgbaAsli;
    if (gambar.lebar > LEBAR_KERJA_MAKSIMAL) {
      skalaKeKerja = LEBAR_KERJA_MAKSIMAL / gambar.lebar;
      const tinggiBaru = Math.max(1, Math.round(gambar.tinggi * skalaKeKerja));
      rgbaKerja = pool.catat(new cv.Mat());
      cv.resize(
        rgbaAsli,
        rgbaKerja,
        new cv.Size(LEBAR_KERJA_MAKSIMAL, tinggiBaru),
        0,
        0,
        cv.INTER_AREA,
      );
    }

    // Langkah 2: ubah ke abu-abu & CLAHE
    const grayKerja = pool.catat(new cv.Mat());
    cv.cvtColor(rgbaKerja, grayKerja, cv.COLOR_RGBA2GRAY);

    const { peringatan } = cekKualitasPencahayaan(cv, grayKerja, pool);

    const clahe = pool.catat(new cv.CLAHE(2.5, new cv.Size(8, 8)));
    const claheKerja = pool.catat(new cv.Mat());
    clahe.apply(grayKerja, claheKerja);

    // Langkah 3: temukan 4 sudut kertas
    let metode: MetodeDeteksiKertas = 'gagal';
    let sudutKerja: EmpatSudut | null = null;

    if (opsi.sudutManual) {
      sudutKerja = skalaSudut(opsi.sudutManual, skalaKeKerja);
      metode = 'manual';
    } else if (opsi.jenisPenanda === 'penanda-sudut') {
      sudutKerja = deteksiPenandaSudut(cv, claheKerja, pool);
      if (sudutKerja) {
        metode = 'penanda-sudut';
      } else {
        sudutKerja = deteksiTepiKertas(cv, grayKerja, claheKerja, pool);
        if (sudutKerja) metode = 'tepi-kertas';
      }
    } else {
      sudutKerja = deteksiTepiKertas(cv, grayKerja, claheKerja, pool);
      if (sudutKerja) {
        metode = 'tepi-kertas';
      } else {
        sudutKerja = deteksiPenandaSudut(cv, claheKerja, pool);
        if (sudutKerja) metode = 'penanda-sudut';
      }
    }

    if (!sudutKerja) {
      peringatan.push({
        kode: 'kertas-tidak-ditemukan',
        pesan:
          'Kertas LJK tidak ditemukan. Pastikan seluruh kertas dan keempat pojok masuk bingkai, lalu foto ulang.',
        perluFotoUlang: true,
      });

      return {
        berhasil: false,
        metode: 'gagal',
        sudut: null,
        kemiringanDerajat: 0,
        peringatan,
        waktuProsesMs: Math.round(performance.now() - mulai),
      };
    }

    const evalGeo = evaluasiGeometriSegiEmpat(
      sudutKerja,
      rgbaKerja.cols,
      rgbaKerja.rows,
    );
    if (evalGeo.kemiringanDerajat > 18 || evalGeo.rasioDistorsiSisi > 1.38) {
      peringatan.push({
        kode: 'kemiringan-berlebihan',
        pesan:
          'Posisi kertas tampak terlalu miring. Ratakan kertas dan foto tegak lurus dari atas.',
        perluFotoUlang: true,
      });
    }

    const sudutAsli = skalaSudut(sudutKerja, 1 / skalaKeKerja);
    const ukuranTujuan =
      opsi.ukuranStandar ?? hitungUkuranStandarDariSudut(sudutAsli);
    let gambarLurus: GambarMentahRgba | undefined;

    if (opsi.sertakanGambarLurus !== false) {
      const lurusRgba = luruskanPerspektif(
        cv,
        rgbaKerja,
        sudutKerja,
        ukuranTujuan.lebar,
        ukuranTujuan.tinggi,
        pool,
      );
      const lurusGrayDeteksi = pool.catat(new cv.Mat());
      cv.cvtColor(lurusRgba, lurusGrayDeteksi, cv.COLOR_RGBA2GRAY);
      const cekBayangan = cekBayanganTidakMerata(
        lurusGrayDeteksi.data as Uint8Array,
        ukuranTujuan.lebar,
        ukuranTujuan.tinggi,
      );
      if (cekBayangan.berbayangKuat) {
        peringatan.push({
          kode: 'berbayang-kuat',
          pesan:
            'Sebagian kertas tertutup bayangan gelap. Hindari bayangan tangan atau HP, pindah ke tempat yang cahayanya merata, lalu foto ulang.',
          perluFotoUlang: true,
        });
      }
      gambarLurus = ekstrakRgbaDariMat(lurusRgba);
    }

    return {
      berhasil: true,
      metode,
      sudut: sudutAsli,
      kemiringanDerajat: evalGeo.kemiringanDerajat,
      ukuranLurus: ukuranTujuan,
      gambarLurus,
      peringatan,
      waktuProsesMs: Math.round(performance.now() - mulai),
    };
  } finally {
    pool.bersihkan();
  }
}

export function bacaLjkDenganOpenCv(
  cv: CV,
  gambar: GambarMentahRgba,
  opsi: OpsiBacaLJK,
): HasilBacaLJK {
  const mulai = performance.now();
  const pool = new PoolMat();

  try {
    const { template, pengaturan, kunciJawaban, sudutManual } = opsi;
    const rgbaAsli = buatMatDariRgba(cv, gambar, pool);

    // 1. Resize foto ke lebar maks 1600 piksel
    let skalaKeKerja = 1;
    let rgbaKerja = rgbaAsli;
    if (gambar.lebar > LEBAR_KERJA_MAKSIMAL) {
      skalaKeKerja = LEBAR_KERJA_MAKSIMAL / gambar.lebar;
      const tinggiBaru = Math.max(1, Math.round(gambar.tinggi * skalaKeKerja));
      rgbaKerja = pool.catat(new cv.Mat());
      cv.resize(
        rgbaAsli,
        rgbaKerja,
        new cv.Size(LEBAR_KERJA_MAKSIMAL, tinggiBaru),
        0,
        0,
        cv.INTER_AREA,
      );
    }

    // 2. Abu-abu & perbaikan kontras (CLAHE)
    const grayKerja = pool.catat(new cv.Mat());
    cv.cvtColor(rgbaKerja, grayKerja, cv.COLOR_RGBA2GRAY);

    const kualitasCahaya = cekKualitasPencahayaan(cv, grayKerja, pool);
    const peringatan: PeringatanKualitas[] = [...kualitasCahaya.peringatan];

    const claheAwal = pool.catat(new cv.CLAHE(2.5, new cv.Size(8, 8)));
    const claheKerja = pool.catat(new cv.Mat());
    claheAwal.apply(grayKerja, claheKerja);

    // 3. Temukan 4 sudut kertas / penanda sudut
    let metodeDeteksi: MetodeDeteksiKertas = 'gagal';
    let sudutKerja: EmpatSudut | null = null;

    if (sudutManual) {
      sudutKerja = skalaSudut(sudutManual, skalaKeKerja);
      metodeDeteksi = 'manual';
    } else if (template.jenisPenanda === 'penanda-sudut') {
      sudutKerja = deteksiPenandaSudut(cv, claheKerja, pool);
      if (sudutKerja) {
        metodeDeteksi = 'penanda-sudut';
      } else {
        sudutKerja = deteksiTepiKertas(cv, grayKerja, claheKerja, pool);
        if (sudutKerja) metodeDeteksi = 'tepi-kertas';
      }
    } else {
      sudutKerja = deteksiTepiKertas(cv, grayKerja, claheKerja, pool);
      if (sudutKerja) {
        metodeDeteksi = 'tepi-kertas';
      } else {
        sudutKerja = deteksiPenandaSudut(cv, claheKerja, pool);
        if (sudutKerja) metodeDeteksi = 'penanda-sudut';
      }
    }

    if (!sudutKerja) {
      peringatan.push({
        kode: 'kertas-tidak-ditemukan',
        pesan:
          'Kertas LJK tidak ditemukan. Pastikan seluruh kertas dan keempat pojok masuk bingkai, lalu foto ulang.',
        perluFotoUlang: true,
      });

      return {
        berhasil: false,
        perluFotoUlang: true,
        peringatan,
        metodeDeteksi: 'gagal',
        sudutTerdeteksi: null,
        metrikKualitas: {
          kecerahanRataRata: kualitasCahaya.kecerahanRataRata,
          kontrasStdDev: kualitasCahaya.kontrasStdDev,
          rasioRagu: 0,
          kemiringanDerajat: 0,
          skorPergeseran: 0,
        },
        hasilPerNomor: [],
        jawabanTerbaca: [],
        statusPerNomor: [],
        waktuProsesMs: Math.round(performance.now() - mulai),
      };
    }

    const evalGeo = evaluasiGeometriSegiEmpat(
      sudutKerja,
      rgbaKerja.cols,
      rgbaKerja.rows,
    );

    if (evalGeo.kemiringanDerajat > 18 || evalGeo.rasioDistorsiSisi > 1.38) {
      peringatan.push({
        kode: 'kemiringan-berlebihan',
        pesan:
          'Posisi kertas tampak tidak sejajar, mohon foto ulang.',
        perluFotoUlang: true,
      });
    }

    // Periksa apakah orientasi foto (mendatar/tegak) bertolak belakang dengan template
    const ukuranFotoKertas = hitungUkuranStandarDariSudut(sudutKerja);
    const rasioTemplate =
      template.ukuranStandar.lebar / Math.max(1, template.ukuranStandar.tinggi);
    const rasioFoto =
      ukuranFotoKertas.lebar / Math.max(1, ukuranFotoKertas.tinggi);
    if (
      (rasioTemplate > 1.15 && rasioFoto < 0.87) ||
      (rasioTemplate < 0.87 && rasioFoto > 1.15)
    ) {
      peringatan.push({
        kode: 'kemiringan-berlebihan',
        pesan:
          'Arah foto kertas berbeda dengan template (mendatar/tegak). Putar posisi HP atau kertas agar searah dengan template, lalu foto ulang.',
        perluFotoUlang: true,
      });
    }

    // 4. Luruskan perspektif ke ukuran standar template
    const lebarStd = template.ukuranStandar.lebar;
    const tinggiStd = template.ukuranStandar.tinggi;

    const lurusRgba = luruskanPerspektif(
      cv,
      rgbaKerja,
      sudutKerja,
      lebarStd,
      tinggiStd,
      pool,
    );
    const lurusGray = pool.catat(new cv.Mat());
    cv.cvtColor(lurusRgba, lurusGray, cv.COLOR_RGBA2GRAY);

    // Haluskan sedikit derau sensor kamera tanpa membesar-besarkan arsiran tipis/bekas hapus
    const lurusHalus = pool.catat(new cv.Mat());
    cv.GaussianBlur(lurusGray, lurusHalus, new cv.Size(3, 3), 0);

    // Terapkan CLAHE khusus untuk pengecekan tepi lingkaran (keselarasan kisi)
    const claheLurus = pool.catat(new cv.CLAHE(2.0, new cv.Size(8, 8)));
    const lurusClahe = pool.catat(new cv.Mat());
    claheLurus.apply(lurusGray, lurusClahe);

    const grayDataUkur = lurusHalus.data as Uint8Array;
    const grayDataTepi = lurusClahe.data as Uint8Array;

    const cekBayangan = cekBayanganTidakMerata(grayDataUkur, lebarStd, tinggiStd);
    if (cekBayangan.berbayangKuat) {
      peringatan.push({
        kode: 'berbayang-kuat',
        pesan:
          'Sebagian kertas tertutup bayangan gelap. Hindari bayangan tangan atau HP, pindah ke tempat yang cahayanya merata, lalu foto ulang.',
        perluFotoUlang: true,
      });
    }

    // 5. Hitung posisi dan ukur kegelapan tiap bulatan jawaban (70% radius)
    const posisiSoal = hitungPosisiSemuaSoal(template);
    const semuaTitikBulatan: Array<{ pusat: Titik; radius: number }> = [];
    const hasilPerNomor: HasilBacaNomor[] = [];

    for (const soal of posisiSoal) {
      const pengukuranMentah: Array<Omit<PengukuranBulatan, 'status'>> = [];
      for (const pil of soal.pilihan) {
        semuaTitikBulatan.push({ pusat: pil.pusat, radius: pil.radius });
        const rasioGelap = ukurKegelapanSatuBulatan(
          grayDataUkur,
          lebarStd,
          tinggiStd,
          pil.pusat,
          pil.radius,
        );
        pengukuranMentah.push({
          label: pil.label,
          pusat: pil.pusat,
          radius: pil.radius,
          rasioGelap,
        });
      }
      // 6. Putuskan jawaban per nomor relatif terhadap baris yang sama
      hasilPerNomor.push(
        putuskanJawabanSatuNomor(soal.nomor, pengukuranMentah, pengaturan),
      );
    }

    // 5b. Baca area nama siswa (blokNama A-Z) atau identitas lama (blokIdentitas 0-9)
    const posisiIdentitas = hitungPosisiSemuaIdentitas(template);
    const kolomIdentitasMentah = posisiIdentitas.map((kolom) => ({
      kolomKe: kolom.kolomKe,
      bulatan: kolom.digit.map((d) => ({
        label: d.label,
        pusat: d.pusat,
        radius: d.radius,
        rasioGelap: ukurKegelapanSatuBulatan(
          grayDataUkur,
          lebarStd,
          tinggiStd,
          d.pusat,
          d.radius,
        ),
      })),
    }));

    const identitas =
      kolomIdentitasMentah.length > 0
        ? template.blokNama
          ? putuskanNamaSiswa(kolomIdentitasMentah, pengaturan)
          : putuskanIdentitas(kolomIdentitasMentah, pengaturan)
        : undefined;

    // 7. Periksa kualitas keseluruhan (jumlah ragu & keselarasan posisi bulatan)
    const jumlahRagu = hasilPerNomor.filter(
      (h) => h.statusMentah === 'ragu',
    ).length;
    const rasioRagu =
      hasilPerNomor.length > 0 ? jumlahRagu / hasilPerNomor.length : 0;

    if (rasioRagu * 100 > pengaturan.batasRaguPersen) {
      peringatan.push({
        kode: 'banyak-ragu',
        pesan: `Terlalu banyak nomor yang meragukan (${jumlahRagu} dari ${hasilPerNomor.length} soal). Mohon foto ulang di tempat yang lebih terang.`,
        perluFotoUlang: true,
      });
    }

    const cekGeser = cekPergeseranGrid(
      grayDataTepi,
      lebarStd,
      tinggiStd,
      semuaTitikBulatan,
    );
    if (cekGeser.bergeser) {
      peringatan.push({
        kode: 'posisi-bergeser',
        pesan: 'Posisi kertas tampak tidak sejajar, mohon foto ulang.',
        perluFotoUlang: true,
      });
    }

    // 8. Hitung penilaian jika kunci jawaban diberikan
    const jawabanTerbaca = hasilPerNomor.map((h) => h.jawabanTerbaca);
    let statusPerNomor: StatusJawaban[];
    let ringkasanNilai: HasilBacaLJK['ringkasanNilai'];

    if (kunciJawaban && kunciJawaban.length > 0) {
      const penilaian = hitungPenilaianDariBacaan(
        hasilPerNomor,
        kunciJawaban,
        pengaturan,
      );
      statusPerNomor = penilaian.statusPerNomor;
      ringkasanNilai = penilaian.ringkasan;
    } else {
      statusPerNomor = hasilPerNomor.map((h) => {
        if (h.statusMentah === 'ganda') return 'ganda';
        if (h.statusMentah === 'ragu') return 'ragu';
        if (h.statusMentah === 'kosong') return 'kosong';
        return 'benar';
      });
    }

    const perluFotoUlang = peringatan.some((p) => p.perluFotoUlang);
    const sudutAsli = skalaSudut(sudutKerja, 1 / skalaKeKerja);

    return {
      berhasil: true,
      perluFotoUlang,
      peringatan,
      metodeDeteksi,
      sudutTerdeteksi: sudutAsli,
      metrikKualitas: {
        kecerahanRataRata: kualitasCahaya.kecerahanRataRata,
        kontrasStdDev: kualitasCahaya.kontrasStdDev,
        rasioRagu: Number(rasioRagu.toFixed(3)),
        kemiringanDerajat: evalGeo.kemiringanDerajat,
        skorPergeseran: cekGeser.skorPergeseran,
      },
      hasilPerNomor,
      identitas,
      jawabanTerbaca,
      statusPerNomor,
      ringkasanNilai,
      gambarLurus:
        opsi.sertakanGambarLurus !== false
          ? ekstrakRgbaDariMat(lurusRgba)
          : undefined,
      waktuProsesMs: Math.round(performance.now() - mulai),
    };
  } finally {
    pool.bersihkan();
  }
}
