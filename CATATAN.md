# Catatan Progres Aplikasi Koreksi LJK (Versi 1)

Dokumen ini mencatat seluruh fitur yang sudah selesai dibangun pada Versi 1, hasil verifikasi teknis, serta panduan menjalankan dan menguji aplikasi di laptop maupun HP Android asli (termasuk uji Mode Pesawat / offline penuh).

---

## Status Tahap Pembangunan

- [x] **Tahap 1: Kerangka Aplikasi** *(Selesai)*
- [x] **Tahap 2: Penyimpanan Data & Pengaturan Dasar** *(Selesai)*
- [x] **Tahap 3: Mesin Pembaca LJK (Inti)** *(Selesai)*
- [x] **Tahap 4: Pembuat Template** *(Selesai)*
- [x] **Tahap 5: Ujian & Kunci Jawaban** *(Selesai)*
- [x] **Tahap 6: Layar Scan & Hasil** *(Selesai)*
- [x] **Tahap 7: Rekap & Ekspor Excel** *(Selesai)*
- [x] **Tahap 8: Penyempurnaan & Mode Offline Penuh** *(Selesai)*

---

## Ringkasan Fitur Versi 1 yang Sudah Jadi

1. **Kerangka Aplikasi PWA & Ramah Pengguna Awam (Tahap 1 & 8):**
   - Seluruh tampilan berbahasa Indonesia sederhana, tanpa istilah teknis di layar.
   - Seluruh **118 tombol** di seluruh layar berukuran minimal 48 piksel agar nyaman ditekan di HP.
   - Pemecahan kode per halaman sekunder (`React.lazy`) sehingga tampilan awal lebih ringan saat dibuka di HP, sementara seluruh halaman tetap tersimpan untuk mode tanpa internet.
   - Indikator status tanpa internet (*"Sedang tanpa internet — semua fitur tetap berjalan normal di perangkat ini"*) dan tombol pembaruan otomatis bila ada versi baru.

2. **Penyimpanan Permanen, Ruang Penuh, & Cadangan Berkala (Tahap 2 & 8):**
   - Seluruh data (Template, Ujian beserta salinan template, Hasil Scan + foto JPEG terkompres, dan Pengaturan) tersimpan langsung di perangkat (IndexedDB lewat Dexie), tidak pernah dikirim ke server mana pun.
   - Meminta perlindungan penyimpanan persisten ke browser agar data tidak terhapus otomatis.
   - **Peringatan ruang penyimpanan hampir penuh** (muncul di Beranda & Pengaturan saat pemakaian mencapai ≥ 80% atau sisa ruang < 50 MB) lengkap dengan tombol cepat untuk mematikan simpan foto.
   - **Pengingat cadangan data berkala** di Beranda (muncul saat sudah ada data koreksi dan belum pernah mencadangkan atau cadangan terakhir berumur ≥ 7 hari) dengan tombol sekali ketuk **Cadangkan Sekarang**.
   - Fitur **Cadangkan Data** (file `.json`), **Pulihkan Data** (dengan pratinjau isi), dan **Hapus Semua Data** (konfirmasi dua langkah).

3. **Mesin Pembaca LJK OpenCV.js di Latar Belakang (Tahap 3 & 8):**
   - Berjalan di Web Worker sehingga layar HP tetap responsif saat membaca foto.
   - Deteksi otomatis 4 penanda sudut hitam maupun tepi kertas, pelurusan perspektif, dan pembacaan bulatan relatif terhadap latar kertas lokal (akurasi teruji ≥ 98% pada 10 variasi sudut/bayangan dengan kecepatan ~0,35 detik per lembar di laptop).
   - **Peringatan kualitas foto lengkap** disertai saran dan tombol **Foto Ulang Sekarang**:
     - Kertas tidak ditemukan (tidak pernah memunculkan nilai palsu).
     - Foto terlalu gelap, terlalu terang/silau, atau buram/kontras rendah.
     - **Bayangan gelap tidak merata** (sebagian kertas tertutup bayangan tangan/HP).
     - Kertas terlalu miring atau posisi bulatan tampak bergeser.
     - Terlalu banyak nomor meragukan (> batas yang diatur di Pengaturan).

4. **Pembuat Template Sendiri (Tahap 4):**
   - Manajemen Template lengkap (Buat Baru, Ubah, Duplikat, Hapus).
   - Wizard 6 langkah: Info Dasar → Foto LJK Kosong → Geser 4 Sudut → Tandai Blok Jawaban (ketuk 2 bulatan sudut per blok) → Area Identitas Siswa (opsional) → Uji Template & Simpan.

5. **Ujian Baru & Kunci Jawaban 3 Cara (Tahap 5):**
   - Mendukung **Ketik Cepat** (`1A 2B 3C` atau `ABCDE`), **Ketuk di Grid**, dan **Scan LJK Kunci** — ketiganya teruji menghasilkan data kunci yang persis sama.
   - Ringkasan distribusi kunci (jumlah A–E dan nomor kosong) sebelum disimpan.
   - Setiap ujian menyimpan salinan template tersendiri sehingga perubahan template di kemudian hari tidak merusak ujian lama.

6. **Scan LJK, Tanda Warna, & Koreksi Manual (Tahap 6):**
   - Potret dengan kamera belakang (`capture="environment"`) atau unggah foto dari galeri.
   - Pratinjau foto sebelum dibaca (**Pakai Foto Ini** / **Foto Ulang**).
   - Foto LJK lurus dilengkapi tanda warna & simbol (`✓` benar, `✕` salah, `?` perlu dicek, `◌` kunci jawaban, `✎` koreksi manual) dan cubit-untuk-zoom.
   - **Daftar Perlu Dicek** (melompat langsung ke posisi nomor di foto) dan koreksi manual yang langsung menghitung ulang nilai seketika.
   - Deteksi siswa yang di-scan dua kali (pilihan **Timpa Hasil Lama** atau **Simpan Sebagai Tambahan**).

7. **Rekap Ujian & Ekspor Excel (Tahap 7):**
   - Statistik per ujian/kelas (jumlah siswa, rata-rata, tertinggi, terendah), filter kelas (nyaman sampai 9 kelas), pencarian nama/absen, dan akses membuka kembali foto siswa untuk koreksi ulang.
   - Ekspor 1 file `.xlsx` per ujian (`Nilai_NamaUjian_YYYY-MM-DD.xlsx`) dengan 2 lembar: **Rekap** dan **Jawaban** (dengan baris **KUNCI JAWABAN** di paling atas). Teruji 396 siswa (9 kelas × 44 siswa) dalam ~0,28 detik.

8. **Mode Offline Penuh (PWA Service Worker):**
   - Seluruh **29 berkas inti** (HTML, CSS, seluruh potongan halaman JS, SheetJS `xlsx`, `omr-worker.js`, `vendor/opencv.js`, ikon, dan manifest) tersimpan otomatis di cache perangkat tanpa duplikasi.

---

## Cara Menjalankan Aplikasi

### 1. Menjalankan di Laptop (Mode Pratinjau Produksi — Disarankan)
Buka terminal di folder proyek `d:\#Project\Scan LJK`, lalu jalankan:

```powershell
pnpm run build
pnpm run preview
```

Buka `http://localhost:4173/` di Chrome atau Edge.

### 2. Menjalankan Mode Pengembangan
```powershell
pnpm run dev
```

Lalu buka `http://localhost:5173/`.

### 3. Menjalankan Seluruh Uji Otomatis (26 Pengujian di 8 Suite)
```powershell
pnpm run typecheck
pnpm run test
```

---

## Panduan Uji di HP Android Asli & Mode Pesawat (Offline Penuh)

> **Penting:** Di HP Android, fitur **Pasang Aplikasi (PWA)** dan **Service Worker (Mode Offline)** memerlukan alamat **HTTPS** (atau `localhost` lewat kabel USB). Membuka lewat IP lokal `http://192.168.x.x:4173` tanpa HTTPS akan membuat Chrome Android tidak mengaktifkan Service Worker/mode offline.

### Cara Termudah Membuka di HP Android Asli
Pilih salah satu dari dua cara berikut:

#### Opsi A: Lewat Kabel USB dari Laptop (Gratis, Tanpa Upload, Paling Cepat)
1. Jalankan di laptop:
   ```powershell
   pnpm run build
   pnpm run preview -- --port 4173
   ```
2. Hubungkan HP Android ke laptop dengan kabel USB (aktifkan *USB Debugging* di Opsi Pengembang HP).
3. Di Chrome laptop, buka `chrome://inspect/#devices`, klik **Port forwarding...**, tambahkan port `4173` → `localhost:4173`, lalu centang **Enable port forwarding**.
4. Di Chrome HP Android, buka `http://localhost:4173/`.

#### Opsi B: Unggah Folder `dist/` ke Hosting Statis HTTPS Gratis (untuk Pemakaian Harian di Sekolah)
1. Jalankan `pnpm run build` di laptop — seluruh hasil aplikasi ada di folder `dist/`.
2. Unggah folder `dist/` ke layanan hosting statis HTTPS (seperti Cloudflare Pages, Netlify Drop, atau Vercel). Karena aplikasi tidak memakai server backend dan tidak mengirim data ke luar HP, hosting hanya bertugas mengirim file aplikasi sekali di awal.
3. Buka tautan `https://...` tersebut di Chrome HP Android.

### Langkah Uji Lengkap di HP Android (Termasuk Mode Pesawat)
1. **Pasang ke Layar Utama:** Buka aplikasi di Chrome HP, tunggu muncul pemberitahuan *"Aplikasi siap dipakai tanpa internet"*, lalu tekan **Pasang Aplikasi** (atau menu Chrome ⋮ → **Tambahkan ke layar utama**).
2. **Aktifkan Mode Pesawat (matikan Wi-Fi & Data Seluler):**
   - Tutup Chrome sepenuhnya, lalu buka aplikasi **Koreksi LJK** langsung dari ikon di layar utama HP.
   - Pastikan muncul bilah tenang *"Sedang tanpa internet — semua fitur tetap berjalan normal di perangkat ini."*
3. **Uji Alur Penuh Tanpa Internet:**
   - **Template:** Buka tab **Template** → buat template baru dari foto LJK kosong sekolah Anda (6 langkah) sampai tersimpan.
   - **Ujian & Kunci:** Buka **Beranda** → **Ujian Baru** → pilih template → isi kunci jawaban (coba Ketik Cepat, Grid, atau Scan LJK Kunci) → simpan.
   - **Scan & Peringatan Kualitas:** Tekan **Scan LJK** → potret 5–10 lembar LJK asli (termasuk coba 1 foto agak gelap/berbayang/miring untuk memastikan peringatan kualitas & tombol **Foto Ulang Sekarang** muncul).
   - **Koreksi Manual:** Ketuk salah satu nomor di **Daftar Perlu Dicek**, pastikan foto melompat ke nomor tersebut, ubah jawabannya, dan pastikan nilai langsung berubah.
   - **Rekap & Excel:** Tekan **Simpan dan Selesai** → periksa statistik & filter kelas → tekan **Ekspor ke Excel (.xlsx)** → buka file `.xlsx` di HP (Google Sheets / WPS / Excel) dan cocokkan angkanya.
   - **Ketahanan Data:** Tutup aplikasi sepenuhnya (atau restart HP), buka kembali masih dalam Mode Pesawat, dan pastikan semua template, ujian, dan hasil scan tetap utuh.
   - **Cadangan:** Tekan tombol **Cadangkan Sekarang** (dari pengingat di Beranda atau halaman Pengaturan) untuk menyimpan file cadangan `.json`.
