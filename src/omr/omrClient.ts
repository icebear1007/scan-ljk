import type { TemplateLJK } from '../types/ljk.ts';
import type { OpsiGambarContohLJK } from './sampleTemplate.ts';
import type {
  GambarMentahRgba,
  HasilBacaLJK,
  HasilDeteksiKertas,
  OpsiBacaLJK,
  OpsiDeteksiKertas,
} from './types.ts';
import type { BalasanWorker, PermintaanWorker } from './workerProtocol.ts';

interface AntreanPermintaan {
  resolve: (balasan: BalasanWorker) => void;
  reject: (alasan: Error) => void;
}

let workerAktif: Worker | null = null;
let penghitungId = 1;
const antrean = new Map<number, AntreanPermintaan>();

function ambilAtauBuatWorker(): Worker {
  if (workerAktif) return workerAktif;

  const worker = new Worker('/omr-worker.js');

  worker.onmessage = (event: MessageEvent<BalasanWorker>) => {
    const balasan = event.data;
    const item = antrean.get(balasan.id);
    if (!item) return;
    antrean.delete(balasan.id);

    if (balasan.ok) {
      item.resolve(balasan);
    } else {
      item.reject(new Error(balasan.pesanGalat));
    }
  };

  worker.onerror = (event) => {
    const galat = new Error(
      event.message || 'Mesin pembaca mengalami gangguan tak terduga.',
    );
    for (const item of antrean.values()) {
      item.reject(galat);
    }
    antrean.clear();
    worker.terminate();
    workerAktif = null;
  };

  workerAktif = worker;
  return worker;
}

function kirimKeWorker(
  pesan: PermintaanWorker,
  transfer: Transferable[] = [],
): Promise<BalasanWorker> {
  const worker = ambilAtauBuatWorker();
  return new Promise<BalasanWorker>((resolve, reject) => {
    antrean.set(pesan.id, { resolve, reject });
    worker.postMessage(pesan, transfer);
  });
}

export async function siapkanMesinPembaca(): Promise<void> {
  const id = penghitungId++;
  await kirimKeWorker({ id, jenis: 'init' });
}

export async function deteksiKertasDiWorker(
  gambar: GambarMentahRgba,
  opsi: OpsiDeteksiKertas,
): Promise<HasilDeteksiKertas> {
  const id = penghitungId++;
  const salinan = new Uint8ClampedArray(gambar.data);
  const balasan = await kirimKeWorker(
    {
      id,
      jenis: 'deteksi-kertas',
      gambar: { lebar: gambar.lebar, tinggi: gambar.tinggi, data: salinan },
      opsi,
    },
    [salinan.buffer],
  );
  if (!balasan.ok || balasan.jenis !== 'deteksi-kertas') {
    throw new Error('Gagal menerima hasil deteksi kertas.');
  }
  return balasan.hasil;
}

export async function bacaLjkDiWorker(
  gambar: GambarMentahRgba,
  opsi: OpsiBacaLJK,
): Promise<HasilBacaLJK> {
  const id = penghitungId++;
  const salinan = new Uint8ClampedArray(gambar.data);
  const balasan = await kirimKeWorker(
    {
      id,
      jenis: 'baca-ljk',
      gambar: { lebar: gambar.lebar, tinggi: gambar.tinggi, data: salinan },
      opsi,
    },
    [salinan.buffer],
  );
  if (!balasan.ok || balasan.jenis !== 'baca-ljk') {
    throw new Error('Gagal menerima hasil pembacaan LJK.');
  }
  return balasan.hasil;
}

export async function buatContohLjkDiWorker(
  template: TemplateLJK,
  opsi: OpsiGambarContohLJK,
): Promise<GambarMentahRgba> {
  const id = penghitungId++;
  const balasan = await kirimKeWorker({
    id,
    jenis: 'buat-contoh-ljk',
    template,
    opsi,
  });
  if (!balasan.ok || balasan.jenis !== 'buat-contoh-ljk') {
    throw new Error('Gagal membuat gambar contoh LJK.');
  }
  return balasan.hasil;
}

export function hentikanWorker(): void {
  if (workerAktif) {
    workerAktif.terminate();
    workerAktif = null;
  }
  antrean.clear();
}

/**
 * Mengubah file foto (dari kamera/galeri) ke data RGBA dengan ukuran lebar
 * maksimal 1600 piksel agar pemrosesan cepat dan hemat memori HP.
 */
export async function ubahFileGambarKeRgba(
  file: Blob,
  lebarMaks = 1600,
): Promise<GambarMentahRgba> {
  const bitmap = await createImageBitmap(file);
  try {
    let lebar = bitmap.width;
    let tinggi = bitmap.height;
    if (lebar > lebarMaks) {
      const skala = lebarMaks / lebar;
      lebar = lebarMaks;
      tinggi = Math.max(1, Math.round(tinggi * skala));
    }

    const kanvas = document.createElement('canvas');
    kanvas.width = lebar;
    kanvas.height = tinggi;
    const ctx = kanvas.getContext('2d');
    if (!ctx) {
      throw new Error('Perangkat tidak dapat menyiapkan kanvas gambar.');
    }
    ctx.drawImage(bitmap, 0, 0, lebar, tinggi);
    const imgData = ctx.getImageData(0, 0, lebar, tinggi);
    return {
      lebar: imgData.width,
      tinggi: imgData.height,
      data: imgData.data,
    };
  } finally {
    bitmap.close();
  }
}

export function ubahRgbaKeDataUrl(
  gambar: GambarMentahRgba,
  kualitas = 0.85,
): string {
  const kanvas = document.createElement('canvas');
  kanvas.width = gambar.lebar;
  kanvas.height = gambar.tinggi;
  const ctx = kanvas.getContext('2d');
  if (!ctx) {
    throw new Error('Perangkat tidak dapat menampilkan gambar hasil.');
  }
  const copy = new Uint8ClampedArray(gambar.data);
  ctx.putImageData(new ImageData(copy, gambar.lebar, gambar.tinggi), 0, 0);
  return kanvas.toDataURL('image/jpeg', kualitas);
}

export function ubahRgbaKeJpegBlob(
  gambar: GambarMentahRgba,
  kualitas = 0.82,
): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    const kanvas = document.createElement('canvas');
    kanvas.width = gambar.lebar;
    kanvas.height = gambar.tinggi;
    const ctx = kanvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Perangkat tidak dapat menyimpan gambar hasil.'));
      return;
    }
    const copy = new Uint8ClampedArray(gambar.data);
    ctx.putImageData(new ImageData(copy, gambar.lebar, gambar.tinggi), 0, 0);
    kanvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Gagal mengompres foto hasil scan.'));
      },
      'image/jpeg',
      kualitas,
    );
  });
}
