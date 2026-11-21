import fs from 'node:fs';
import path from 'node:path';
import { build } from 'vite';

const akar = process.cwd();
const sumberOpenCv = path.join(
  akar,
  'node_modules',
  '@techstark',
  'opencv-js',
  'dist',
  'opencv.js',
);
const tujuanVendorDir = path.join(akar, 'public', 'vendor');
const tujuanOpenCv = path.join(tujuanVendorDir, 'opencv.js');

if (!fs.existsSync(sumberOpenCv)) {
  throw new Error(
    `File OpenCV.js tidak ditemukan di ${sumberOpenCv}. Jalankan pnpm install terlebih dulu.`,
  );
}

fs.mkdirSync(tujuanVendorDir, { recursive: true });

// Salin hanya jika belum ada atau ukurannya berbeda agar cepat
const statSumber = fs.statSync(sumberOpenCv);
const perluSalin =
  !fs.existsSync(tujuanOpenCv) ||
  fs.statSync(tujuanOpenCv).size !== statSumber.size;

if (perluSalin) {
  fs.copyFileSync(sumberOpenCv, tujuanOpenCv);
  console.log('Menyalin OpenCV.js ke public/vendor/opencv.js');
}

await build({
  configFile: false,
  logLevel: 'warn',
  build: {
    outDir: 'public',
    emptyOutDir: false,
    copyPublicDir: false,
    sourcemap: false,
    minify: true,
    lib: {
      entry: 'src/omr/omr.worker.ts',
      name: 'KoreksiLjkOmrWorker',
      formats: ['iife'],
      fileName: () => 'omr-worker.js',
    },
  },
});

console.log('Worker OMR berhasil dibuild ke public/omr-worker.js');
