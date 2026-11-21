import type { TemplateLJK } from '../types/ljk.ts';
import type { OpsiGambarContohLJK } from './sampleTemplate.ts';
import type {
  GambarMentahRgba,
  HasilBacaLJK,
  HasilDeteksiKertas,
  OpsiBacaLJK,
  OpsiDeteksiKertas,
} from './types.ts';

export type PermintaanWorker =
  | { id: number; jenis: 'init' }
  | {
      id: number;
      jenis: 'deteksi-kertas';
      gambar: GambarMentahRgba;
      opsi: OpsiDeteksiKertas;
    }
  | {
      id: number;
      jenis: 'baca-ljk';
      gambar: GambarMentahRgba;
      opsi: OpsiBacaLJK;
    }
  | {
      id: number;
      jenis: 'buat-contoh-ljk';
      template: TemplateLJK;
      opsi: OpsiGambarContohLJK;
    };

export type BalasanWorker =
  | { id: number; ok: true; jenis: 'init'; siap: true }
  | {
      id: number;
      ok: true;
      jenis: 'deteksi-kertas';
      hasil: HasilDeteksiKertas;
    }
  | { id: number; ok: true; jenis: 'baca-ljk'; hasil: HasilBacaLJK }
  | {
      id: number;
      ok: true;
      jenis: 'buat-contoh-ljk';
      hasil: GambarMentahRgba;
    }
  | { id: number; ok: false; pesanGalat: string };
