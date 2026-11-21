/// <reference lib="webworker" />
import type { CV } from '@techstark/opencv-js';

let janjiCv: Promise<CV> | null = null;

export function muatOpenCvDiWorker(): Promise<CV> {
  if (!janjiCv) {
    janjiCv = (async () => {
      const ruangGlobal = globalThis as unknown as {
        cv?:
          | Promise<CV>
          | (CV & { onRuntimeInitialized?: () => void });
      };

      if (!ruangGlobal.cv) {
        importScripts('/vendor/opencv.js');
      }

      const mentah = ruangGlobal.cv;
      if (!mentah) {
        throw new Error('Mesin pembaca gambar gagal dimuat di perangkat.');
      }

      if (mentah instanceof Promise) {
        return await mentah;
      }

      if (typeof mentah.Mat === 'function') {
        return mentah;
      }

      await new Promise<void>((resolve) => {
        mentah.onRuntimeInitialized = () => resolve();
      });
      return mentah;
    })().catch((err) => {
      janjiCv = null;
      throw err;
    });
  }

  return janjiCv;
}
