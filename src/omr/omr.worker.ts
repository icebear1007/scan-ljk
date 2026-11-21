/// <reference lib="webworker" />
import { muatOpenCvDiWorker } from './cvLoaderWorker.ts';
import {
  bacaLjkDenganOpenCv,
  deteksiDanLuruskanKertas,
} from './cvPipeline.ts';
import { buatFotoContohLjkDenganOpenCv } from './sampleTemplate.ts';
import type { BalasanWorker, PermintaanWorker } from './workerProtocol.ts';

declare const self: DedicatedWorkerGlobalScope;

function kirimBalasan(balasan: BalasanWorker, transfer: Transferable[] = []) {
  self.postMessage(balasan, transfer);
}

self.onmessage = async (event: MessageEvent<PermintaanWorker>) => {
  const pesan = event.data;

  try {
    const cv = await muatOpenCvDiWorker();

    if (pesan.jenis === 'init') {
      kirimBalasan({ id: pesan.id, ok: true, jenis: 'init', siap: true });
      return;
    }

    if (pesan.jenis === 'deteksi-kertas') {
      const hasil = deteksiDanLuruskanKertas(cv, pesan.gambar, pesan.opsi);
      const transfer: Transferable[] = [];
      if (hasil.gambarLurus) {
        transfer.push(hasil.gambarLurus.data.buffer);
      }
      kirimBalasan(
        { id: pesan.id, ok: true, jenis: 'deteksi-kertas', hasil },
        transfer,
      );
      return;
    }

    if (pesan.jenis === 'baca-ljk') {
      const hasil = bacaLjkDenganOpenCv(cv, pesan.gambar, pesan.opsi);
      const transfer: Transferable[] = [];
      if (hasil.gambarLurus) {
        transfer.push(hasil.gambarLurus.data.buffer);
      }
      kirimBalasan(
        { id: pesan.id, ok: true, jenis: 'baca-ljk', hasil },
        transfer,
      );
      return;
    }

    if (pesan.jenis === 'buat-contoh-ljk') {
      const hasil = buatFotoContohLjkDenganOpenCv(
        cv,
        pesan.template,
        pesan.opsi,
      );
      kirimBalasan(
        { id: pesan.id, ok: true, jenis: 'buat-contoh-ljk', hasil },
        [hasil.data.buffer],
      );
    }
  } catch (err) {
    kirimBalasan({
      id: pesan.id,
      ok: false,
      pesanGalat:
        err instanceof Error
          ? err.message
          : 'Terjadi gangguan saat memproses gambar LJK.',
    });
  }
};
