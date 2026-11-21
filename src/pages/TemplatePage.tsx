import { useLiveQuery } from 'dexie-react-hooks';
import { Copy, LayoutGrid, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog.tsx';
import { db } from '../db/database.ts';
import { duplikatTemplate, hapusTemplate } from '../db/templates.ts';
import type { TemplateLJK } from '../types/ljk.ts';

interface TemplatePageProps {
  onCreateTemplate: () => void;
  onEditTemplate: (template: TemplateLJK) => void;
  pesanBanner?: string | null;
  onTutupBanner?: () => void;
}

function PratinjauMini({ blob, nama }: { blob?: Blob; nama: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const objUrl = URL.createObjectURL(blob);
    setUrl(objUrl);
    return () => {
      URL.revokeObjectURL(objUrl);
    };
  }, [blob]);

  if (!url) {
    return (
      <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-100 text-slate-500">
        <LayoutGrid className="h-6 w-6" aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={`Contoh lembar ${nama}`}
      className="h-16 w-12 shrink-0 rounded-xl border border-slate-200 object-cover"
    />
  );
}

export function TemplatePage({
  onCreateTemplate,
  onEditTemplate,
  pesanBanner,
  onTutupBanner,
}: TemplatePageProps) {
  const daftarTemplate = useLiveQuery(
    () => db.templates.orderBy('tanggalDiubah').reverse().toArray(),
    [],
  );

  const [pesanLokal, setPesanLokal] = useState<string | null>(null);
  const [calonHapus, setCalonHapus] = useState<TemplateLJK | null>(null);

  const pesanAktif = pesanLokal ?? pesanBanner ?? null;

  const handleDuplikat = async (tpl: TemplateLJK) => {
    try {
      const hasil = await duplikatTemplate(tpl.id);
      setPesanLokal(`Template "${hasil.nama}" berhasil dibuat.`);
    } catch {
      setPesanLokal('Gagal menduplikat template. Silakan coba lagi.');
    }
  };

  const handleKonfirmasiHapus = async () => {
    if (!calonHapus) return;
    const target = calonHapus;
    setCalonHapus(null);
    await hapusTemplate(target.id);
    setPesanLokal(`Template "${target.nama}" telah dihapus.`);
  };

  return (
    <div className="space-y-5">
      {pesanAktif ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950"
        >
          <span>{pesanAktif}</span>
          <button
            type="button"
            onClick={() => {
              setPesanLokal(null);
              onTutupBanner?.();
            }}
            className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-xl px-2.5 text-sm font-bold text-emerald-900 hover:bg-emerald-100"
          >
            Tutup
          </button>
        </div>
      ) : null}

      <button
        type="button"
        onClick={onCreateTemplate}
        className="flex min-h-14 w-full items-center justify-center gap-2.5 rounded-2xl bg-blue-900 px-5 py-4 text-lg font-bold text-white shadow-sm transition-colors hover:bg-blue-800 active:bg-blue-950"
      >
        <Plus className="h-6 w-6 shrink-0" strokeWidth={2.5} aria-hidden="true" />
        <span>Buat Template Baru</span>
      </button>

      <section className="space-y-3">
        <h2 className="text-base font-bold text-slate-800">Daftar Template</h2>

        {!daftarTemplate || daftarTemplate.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-xs">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
              <LayoutGrid className="h-7 w-7" aria-hidden="true" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">
              Belum ada template LJK
            </h3>
            <p className="mt-2 text-sm text-slate-700">
              Anda bisa membuat template sendiri sesuai lembar jawaban yang
              dipakai di sekolah, lalu menyimpannya untuk dipakai berulang kali.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {daftarTemplate.map((tpl) => (
              <li
                key={tpl.id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-3"
              >
                <div className="flex items-start gap-3">
                  <PratinjauMini blob={tpl.gambarContoh} nama={tpl.nama} />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-slate-900">
                      {tpl.nama}
                    </h3>
                    <p className="mt-0.5 text-sm text-slate-700">
                      {tpl.jumlahSoal} soal &middot; Pilihan A&ndash;
                      {tpl.jumlahPilihan === 4 ? 'D' : 'E'}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600">
                      {tpl.blokJawaban.length} blok jawaban
                      {tpl.blokIdentitas && tpl.blokIdentitas.length > 0
                        ? ` · Identitas ${tpl.blokIdentitas.length} digit`
                        : ''}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-2.5">
                  <button
                    type="button"
                    onClick={() => onEditTemplate(tpl)}
                    aria-label={`Ubah template ${tpl.nama}`}
                    className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-2 text-sm font-bold text-slate-900 hover:bg-slate-100"
                  >
                    <Pencil className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Ubah</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      void handleDuplikat(tpl);
                    }}
                    aria-label={`Duplikat template ${tpl.nama}`}
                    className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-2 text-sm font-bold text-slate-900 hover:bg-slate-100"
                  >
                    <Copy className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Duplikat</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCalonHapus(tpl)}
                    aria-label={`Hapus template ${tpl.nama}`}
                    className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-2.5 py-2 text-sm font-bold text-red-800 hover:bg-red-100"
                  >
                    <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span>Hapus</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={calonHapus !== null}
        title="Hapus Template Ini?"
        description={
          calonHapus
            ? `Template "${calonHapus.nama}" akan dihapus dari daftar. Ujian yang sudah dibuat sebelumnya tetap aman karena menyimpan salinan template sendiri.`
            : ''
        }
        confirmLabel="Hapus Template"
        destructive
        onCancel={() => setCalonHapus(null)}
        onConfirm={() => {
          void handleKonfirmasiHapus();
        }}
      />
    </div>
  );
}
