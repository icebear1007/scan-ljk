import { useCallback, useEffect, useState } from 'react';
import {
  evaluasiRuangPenyimpanan,
  mintaPenyimpananPersisten,
  type EvaluasiRuangPenyimpanan,
} from '../utils/kesehatanAplikasi.ts';

export interface StatusPerangkat {
  isOffline: boolean;
  infoRuang: EvaluasiRuangPenyimpanan | null;
  penyimpananPersisten: boolean | null;
  segarkanInfoRuang: () => Promise<void>;
}

/**
 * Memantau status koneksi (online/offline) serta sisa ruang penyimpanan
 * dan status penyimpanan persisten perangkat.
 */
export function useStatusPerangkat(): StatusPerangkat {
  const [isOffline, setIsOffline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  );
  const [infoRuang, setInfoRuang] = useState<EvaluasiRuangPenyimpanan | null>(
    null,
  );
  const [penyimpananPersisten, setPenyimpananPersisten] = useState<
    boolean | null
  >(null);

  const segarkanInfoRuang = useCallback(async () => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.storage ||
      typeof navigator.storage.estimate !== 'function'
    ) {
      return;
    }
    try {
      const est = await navigator.storage.estimate();
      if (
        typeof est.usage === 'number' &&
        typeof est.quota === 'number' &&
        est.quota > 0
      ) {
        setInfoRuang(evaluasiRuangPenyimpanan(est.usage, est.quota));
      }
    } catch {
      // Abaikan jika browser membatasi pembacaan estimasi penyimpanan
    }
  }, []);

  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    void segarkanInfoRuang();
    void mintaPenyimpananPersisten().then((hasil) => {
      setPenyimpananPersisten(hasil);
    });

    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [segarkanInfoRuang]);

  return {
    isOffline,
    infoRuang,
    penyimpananPersisten,
    segarkanInfoRuang,
  };
}
