import { useEffect, useId, useRef } from 'react';
import { daftarHurufSah } from '../../db/ujians.ts';

interface KoreksiNomorDialogProps {
  nomor: number | null;
  jumlahPilihan: 4 | 5;
  kunciJawaban: string;
  jawabanTerbacaAwal: string;
  jawabanSaatIni: string;
  statusSaatIni: string;
  onPilih: (nomor: number, jawabanBaru: string) => void;
  onTutup: () => void;
}

export function KoreksiNomorDialog({
  nomor,
  jumlahPilihan,
  kunciJawaban,
  jawabanTerbacaAwal,
  jawabanSaatIni,
  statusSaatIni,
  onPilih,
  onTutup,
}: KoreksiNomorDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();
  const terbuka = nomor !== null;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (terbuka && !dialog.open) {
      dialog.showModal();
    } else if (!terbuka && dialog.open) {
      dialog.close();
    }
  }, [terbuka]);

  const handleClose = () => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const nilai = dialog.returnValue;
    dialog.returnValue = '';

    if (nomor !== null && nilai.startsWith('pilih:')) {
      const huruf = nilai.slice('pilih:'.length);
      onPilih(nomor, huruf);
    } else {
      onTutup();
    }
  };

  const hurufSah = daftarHurufSah(jumlahPilihan);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descId}
      onClose={handleClose}
      className="m-auto w-[min(92dvw,25rem)] rounded-2xl border border-slate-200 bg-white p-5 text-slate-900 shadow-xl"
    >
      {nomor !== null ? (
        <div className="space-y-4">
          <div className="space-y-1">
            <h2 id={titleId} className="text-lg font-bold text-slate-900">
              Koreksi Nomor {nomor}
            </h2>
            <p id={descId} className="text-sm text-slate-700">
              Kunci jawaban: <strong>{kunciJawaban || '—'}</strong> &middot;
              Bacaan awal:{' '}
              <strong>
                {jawabanTerbacaAwal ||
                  (statusSaatIni === 'ganda'
                    ? 'Ganda'
                    : statusSaatIni === 'ragu'
                      ? 'Ragu'
                      : 'Kosong')}
              </strong>
            </p>
          </div>

          <form method="dialog" className="space-y-3">
            <div
              className={`grid gap-2 ${
                jumlahPilihan === 4 ? 'grid-cols-4' : 'grid-cols-5'
              }`}
            >
              {hurufSah.map((huruf) => {
                const terpilih = jawabanSaatIni === huruf;
                const adalahKunci = kunciJawaban === huruf;
                return (
                  <button
                    key={huruf}
                    type="submit"
                    value={`pilih:${huruf}`}
                    className={`relative flex min-h-14 flex-col items-center justify-center rounded-xl border-2 text-lg font-bold transition-colors ${
                      terpilih
                        ? 'border-blue-900 bg-blue-900 text-white'
                        : adalahKunci
                          ? 'border-emerald-600 bg-emerald-50 text-emerald-950 hover:bg-emerald-100'
                          : 'border-slate-300 bg-white text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <span>{huruf}</span>
                    {adalahKunci ? (
                      <span
                        className={`text-[10px] font-bold leading-none ${
                          terpilih ? 'text-emerald-200' : 'text-emerald-700'
                        }`}
                      >
                        Kunci
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <button
              type="submit"
              value="pilih:"
              className={`inline-flex min-h-12 w-full items-center justify-center rounded-xl border-2 px-4 py-3 text-base font-bold transition-colors ${
                jawabanSaatIni === '' && statusSaatIni === 'kosong'
                  ? 'border-amber-700 bg-amber-100 text-amber-950'
                  : 'border-slate-300 bg-slate-50 text-slate-900 hover:bg-slate-100'
              }`}
            >
              Kosong (Tidak Dijawab)
            </button>

            <button
              type="submit"
              value="cancel"
              autoFocus
              className="inline-flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-bold text-slate-800 hover:bg-slate-100"
            >
              Batal
            </button>
          </form>
        </div>
      ) : null}
    </dialog>
  );
}
