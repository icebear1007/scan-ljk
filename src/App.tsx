import { RefreshCw, WifiOff } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { AppHeader } from './components/AppHeader';
import { BottomNav } from './components/BottomNav';
import { usePwaInstall } from './hooks/usePwaInstall';
import { useStatusPerangkat } from './hooks/useStatusPerangkat';
import { BerandaPage } from './pages/BerandaPage';
import { PengaturanPage } from './pages/PengaturanPage';
import type { HasilSiapTampil } from './pages/ScanPage';
import { TemplatePage } from './pages/TemplatePage';
import type { HasilScan, TemplateLJK, Ujian } from './types/ljk';
import { SCREEN_TITLES, type MainTab, type ScreenId } from './types/navigation';

// Pemecahan kode per halaman sekunder agar pembukaan awal aplikasi tetap ringan di HP
const BuatTemplatePage = lazy(() =>
  import('./pages/BuatTemplatePage').then((m) => ({
    default: m.BuatTemplatePage,
  })),
);
const UjianBaruPage = lazy(() =>
  import('./pages/UjianBaruPage').then((m) => ({
    default: m.UjianBaruPage,
  })),
);
const ScanPage = lazy(() =>
  import('./pages/ScanPage').then((m) => ({
    default: m.ScanPage,
  })),
);
const HasilScanPage = lazy(() =>
  import('./pages/HasilScanPage').then((m) => ({
    default: m.HasilScanPage,
  })),
);
const RekapUjianPage = lazy(() =>
  import('./pages/RekapUjianPage').then((m) => ({
    default: m.RekapUjianPage,
  })),
);
const UjiMesinPage = lazy(() =>
  import('./pages/UjiMesinPage').then((m) => ({
    default: m.UjiMesinPage,
  })),
);

function MemuatHalaman() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-700 shadow-xs"
    >
      <progress aria-label="Memuat halaman..." className="loading-spinner" />
      <p className="text-sm font-bold text-slate-800">Memuat halaman...</p>
    </div>
  );
}

export function App() {
  const [screen, setScreen] = useState<ScreenId>('beranda');
  const [offlineBannerDismissed, setOfflineBannerDismissed] = useState(false);

  const [templateSedangDiubah, setTemplateSedangDiubah] =
    useState<TemplateLJK | null>(null);
  const [pesanTemplate, setPesanTemplate] = useState<string | null>(null);

  const [ujianSedangDiubah, setUjianSedangDiubah] = useState<Ujian | null>(
    null,
  );
  const [pesanBeranda, setPesanBeranda] = useState<string | null>(null);

  // State Layar 5 (Scan), Layar 6 (Hasil Scan), & Layar 7 (Rekap Ujian)
  const [ujianAktif, setUjianAktif] = useState<Ujian | null>(null);
  const [hasilScanBaru, setHasilScanBaru] = useState<HasilSiapTampil | null>(
    null,
  );
  const [hasilTersimpanEdit, setHasilTersimpanEdit] =
    useState<HasilScan | null>(null);
  const [pesanScan, setPesanScan] = useState<string | null>(null);
  const [pesanRekap, setPesanRekap] = useState<string | null>(null);

  const { canInstall, isInstalled, promptInstall } = usePwaInstall();
  const { isOffline, infoRuang, penyimpananPersisten, segarkanInfoRuang } =
    useStatusPerangkat();
  const {
    offlineReady: [offlineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  useEffect(() => {
    if (screen === 'buat-template' && templateSedangDiubah) {
      document.title = 'Ubah Template | Koreksi LJK';
    } else if (screen === 'ujian-baru' && ujianSedangDiubah) {
      document.title = 'Ubah Ujian | Koreksi LJK';
    } else if (screen === 'rekap-ujian' && ujianAktif) {
      document.title = `Rekap ${ujianAktif.nama} | Koreksi LJK`;
    } else {
      document.title = SCREEN_TITLES[screen];
    }
  }, [screen, templateSedangDiubah, ujianSedangDiubah, ujianAktif]);

  const activeTab: MainTab =
    screen === 'buat-template'
      ? 'template'
      : screen === 'ujian-baru' ||
          screen === 'scan' ||
          screen === 'hasil-scan' ||
          screen === 'rekap-ujian'
        ? 'beranda'
        : screen === 'uji-mesin'
          ? 'pengaturan'
          : screen;

  const isMainTab =
    screen === 'beranda' || screen === 'template' || screen === 'pengaturan';

  const headerConfig: Record<
    ScreenId,
    { title: string; subtitle?: string; onBack?: () => void }
  > = {
    beranda: {
      title: 'Koreksi LJK',
      subtitle: 'Koreksi lembar jawaban langsung dari HP',
    },
    template: {
      title: 'Template LJK',
      subtitle: 'Kelola tata letak lembar jawaban',
    },
    pengaturan: {
      title: 'Pengaturan',
      subtitle: 'Atur penilaian dan penyimpanan',
    },
    'ujian-baru': {
      title: ujianSedangDiubah ? 'Ubah Ujian & Kunci' : 'Ujian Baru',
      subtitle: 'Atur info ujian dan kunci jawaban',
      onBack: () => {
        setUjianSedangDiubah(null);
        setScreen('beranda');
      },
    },
    'buat-template': {
      title: templateSedangDiubah ? 'Ubah Template' : 'Buat Template Baru',
      subtitle: 'Panduan membuat template LJK sendiri',
      onBack: () => {
        setTemplateSedangDiubah(null);
        setScreen('template');
      },
    },
    'uji-mesin': {
      title: 'Uji Mesin Pembaca',
      subtitle: 'Coba deteksi kertas dan pembacaan bulatan',
      onBack: () => setScreen('pengaturan'),
    },
    scan: {
      title: 'Scan LJK',
      subtitle: ujianAktif
        ? `${ujianAktif.nama} · Kelas ${ujianAktif.kelas}`
        : 'Potret atau unggah lembar jawaban siswa',
      onBack: () => {
        setHasilScanBaru(null);
        setPesanScan(null);
        setScreen('beranda');
      },
    },
    'hasil-scan': {
      title: hasilTersimpanEdit ? 'Detail & Koreksi Ulang' : 'Hasil Scan',
      subtitle: ujianAktif
        ? `${ujianAktif.nama} · Periksa & koreksi jika perlu`
        : 'Ringkasan nilai dan koreksi manual',
      onBack: () => {
        if (hasilTersimpanEdit) {
          setHasilTersimpanEdit(null);
          setScreen('rekap-ujian');
        } else {
          setHasilScanBaru(null);
          setScreen('scan');
        }
      },
    },
    'rekap-ujian': {
      title: 'Rekap Ujian',
      subtitle: ujianAktif
        ? `${ujianAktif.nama} · Filter kelas & Ekspor Excel`
        : 'Daftar nilai siswa',
      onBack: () => {
        setPesanRekap(null);
        setScreen('beranda');
      },
    },
  };

  const currentHeader = headerConfig[screen];

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <AppHeader
        title={currentHeader.title}
        subtitle={currentHeader.subtitle}
        onBack={currentHeader.onBack}
      />

      <main
        className={`mx-auto w-full max-w-xl px-4 pt-5 ${
          isMainTab ? 'main-with-bottom-nav' : 'pb-10'
        }`}
      >
        {isOffline ? (
          <div
            role="status"
            aria-live="polite"
            className="mb-4 flex items-center gap-2.5 rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-800"
          >
            <WifiOff
              className="h-5 w-5 shrink-0 text-slate-700"
              aria-hidden="true"
            />
            <span>
              Sedang tanpa internet — semua fitur tetap berjalan normal di
              perangkat ini.
            </span>
          </div>
        ) : null}

        {needRefresh ? (
          <div
            role="status"
            aria-live="polite"
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-300 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-950"
          >
            <span>Versi aplikasi yang lebih baru sudah siap dipakai.</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void updateServiceWorker(true);
                }}
                className="inline-flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-blue-900 px-3.5 py-2 text-sm font-bold text-white hover:bg-blue-800"
              >
                <RefreshCw className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Perbarui</span>
              </button>
              <button
                type="button"
                onClick={() => setNeedRefresh(false)}
                className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-xl px-3 py-2 text-sm font-bold text-blue-900 hover:bg-blue-100"
              >
                Nanti
              </button>
            </div>
          </div>
        ) : null}

        {offlineReady && !offlineBannerDismissed && !isOffline ? (
          <div
            role="status"
            aria-live="polite"
            className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-950"
          >
            <span>Aplikasi siap dipakai tanpa internet.</span>
            <button
              type="button"
              onClick={() => setOfflineBannerDismissed(true)}
              className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-lg px-3 py-2 text-sm font-bold text-emerald-900 hover:bg-emerald-100"
            >
              Tutup
            </button>
          </div>
        ) : null}

        {screen === 'beranda' ? (
          <BerandaPage
            onNewExam={() => {
              setUjianSedangDiubah(null);
              setPesanBeranda(null);
              setScreen('ujian-baru');
            }}
            onScanExam={(ujian) => {
              setUjianAktif(ujian);
              setHasilScanBaru(null);
              setHasilTersimpanEdit(null);
              setPesanScan(null);
              setPesanBeranda(null);
              setScreen('scan');
            }}
            onOpenRekap={(ujian) => {
              setUjianAktif(ujian);
              setHasilScanBaru(null);
              setHasilTersimpanEdit(null);
              setPesanRekap(null);
              setPesanBeranda(null);
              setScreen('rekap-ujian');
            }}
            onEditExam={(ujian) => {
              setUjianSedangDiubah(ujian);
              setPesanBeranda(null);
              setScreen('ujian-baru');
            }}
            onOpenPengaturan={() => setScreen('pengaturan')}
            canInstall={canInstall}
            onInstall={() => {
              void promptInstall();
            }}
            infoRuang={infoRuang}
            pesanBanner={pesanBeranda}
            onTutupBanner={() => setPesanBeranda(null)}
          />
        ) : null}

        {screen === 'template' ? (
          <TemplatePage
            onCreateTemplate={() => {
              setTemplateSedangDiubah(null);
              setPesanTemplate(null);
              setScreen('buat-template');
            }}
            onEditTemplate={(tpl) => {
              setTemplateSedangDiubah(tpl);
              setPesanTemplate(null);
              setScreen('buat-template');
            }}
            pesanBanner={pesanTemplate}
            onTutupBanner={() => setPesanTemplate(null)}
          />
        ) : null}

        {screen === 'pengaturan' ? (
          <PengaturanPage
            canInstall={canInstall}
            isInstalled={isInstalled}
            offlineReady={offlineReady}
            isOffline={isOffline}
            infoRuang={infoRuang}
            penyimpananPersisten={penyimpananPersisten}
            onRefreshRuang={segarkanInfoRuang}
            onInstall={() => {
              void promptInstall();
            }}
            onOpenUjiMesin={() => setScreen('uji-mesin')}
          />
        ) : null}

        <Suspense fallback={<MemuatHalaman />}>
          {screen === 'uji-mesin' ? <UjiMesinPage /> : null}

          {screen === 'ujian-baru' ? (
            <UjianBaruPage
              key={ujianSedangDiubah?.id ?? 'ujian-baru'}
              ujianAwal={ujianSedangDiubah}
              onBukaBuatTemplate={() => {
                setUjianSedangDiubah(null);
                setTemplateSedangDiubah(null);
                setScreen('buat-template');
              }}
              onBatal={() => {
                setUjianSedangDiubah(null);
                setScreen('beranda');
              }}
              onSelesai={(pesan) => {
                setUjianSedangDiubah(null);
                setPesanBeranda(pesan);
                void segarkanInfoRuang();
                setScreen('beranda');
              }}
            />
          ) : null}

          {screen === 'buat-template' ? (
            <BuatTemplatePage
              key={templateSedangDiubah?.id ?? 'template-baru'}
              templateAwal={templateSedangDiubah}
              onBatal={() => {
                setTemplateSedangDiubah(null);
                setScreen('template');
              }}
              onSelesai={(pesan) => {
                setTemplateSedangDiubah(null);
                setPesanTemplate(pesan);
                void segarkanInfoRuang();
                setScreen('template');
              }}
            />
          ) : null}

          {screen === 'scan' && ujianAktif ? (
            <ScanPage
              ujian={ujianAktif}
              pesanBanner={pesanScan}
              onTutupBanner={() => setPesanScan(null)}
              onHasilSiap={(data) => {
                setHasilScanBaru(data);
                setHasilTersimpanEdit(null);
                setPesanScan(null);
                setScreen('hasil-scan');
              }}
            />
          ) : null}

          {screen === 'hasil-scan' &&
          ujianAktif &&
          (hasilScanBaru || hasilTersimpanEdit) ? (
            <HasilScanPage
              key={hasilTersimpanEdit?.id ?? 'scan-baru'}
              ujian={ujianAktif}
              hasilBacaBaru={hasilScanBaru?.hasilBaca}
              fotoLurusBlobBaru={hasilScanBaru?.fotoLurusBlob}
              hasilTersimpan={hasilTersimpanEdit}
              onFotoUlang={() => {
                setHasilScanBaru(null);
                setScreen('scan');
              }}
              onSimpanDanLanjutScan={(pesan) => {
                setHasilScanBaru(null);
                setPesanScan(pesan);
                void segarkanInfoRuang();
                setScreen('scan');
              }}
              onSimpanDanSelesai={(pesan) => {
                setHasilScanBaru(null);
                setHasilTersimpanEdit(null);
                setPesanRekap(pesan);
                void segarkanInfoRuang();
                setScreen('rekap-ujian');
              }}
            />
          ) : null}

          {screen === 'rekap-ujian' && ujianAktif ? (
            <RekapUjianPage
              ujian={ujianAktif}
              pesanBanner={pesanRekap}
              onTutupBanner={() => setPesanRekap(null)}
              onScanBaru={() => {
                setHasilScanBaru(null);
                setHasilTersimpanEdit(null);
                setPesanScan(null);
                setScreen('scan');
              }}
              onBukaHasil={(hasil) => {
                setHasilScanBaru(null);
                setHasilTersimpanEdit(hasil);
                setScreen('hasil-scan');
              }}
            />
          ) : null}
        </Suspense>
      </main>

      {isMainTab ? (
        <BottomNav
          activeTab={activeTab}
          onSelectTab={(tab) => {
            setTemplateSedangDiubah(null);
            setUjianSedangDiubah(null);
            setHasilScanBaru(null);
            setHasilTersimpanEdit(null);
            setScreen(tab);
          }}
        />
      ) : null}
    </div>
  );
}

export default App;
