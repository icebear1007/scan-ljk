import type { CV } from '@techstark/opencv-js';

let janjiCv: Promise<CV> | null = null;

export function muatOpenCv(): Promise<CV> {
  if (!janjiCv) {
    janjiCv = (async () => {
      const mod = (await import('@techstark/opencv-js')) as unknown as {
        default?: unknown;
      };
      const mentah = (mod.default ?? mod) as
        | Promise<CV>
        | (CV & { onRuntimeInitialized?: () => void });

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
