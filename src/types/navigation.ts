export type MainTab = 'beranda' | 'template' | 'pengaturan';

export type ScreenId =
  | MainTab
  | 'ujian-baru'
  | 'buat-template'
  | 'uji-mesin'
  | 'scan'
  | 'hasil-scan'
  | 'rekap-ujian';

export const SCREEN_TITLES: Record<ScreenId, string> = {
  beranda: 'Beranda | Koreksi LJK',
  template: 'Daftar Template | Koreksi LJK',
  pengaturan: 'Pengaturan | Koreksi LJK',
  'ujian-baru': 'Ujian Baru | Koreksi LJK',
  'buat-template': 'Buat Template Baru | Koreksi LJK',
  'uji-mesin': 'Uji Mesin Pembaca | Koreksi LJK',
  scan: 'Scan LJK | Koreksi LJK',
  'hasil-scan': 'Hasil Scan | Koreksi LJK',
  'rekap-ujian': 'Rekap Ujian | Koreksi LJK',
};
