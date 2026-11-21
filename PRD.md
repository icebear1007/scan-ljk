# PRD: Aplikasi Scan Koreksi LJK (Versi 1)

> **Dokumen untuk dieksekusi di Antigravity.**  
> **Bahasa antarmuka aplikasi:** Bahasa Indonesia.  
> **Skill Pendamping Wajib:** Flashmind (`plan-first`, `no-invented-code`, `systematic-debugging`, `verify-before-done`, dan persistent memory).

---

## 1. Ringkasan
Aplikasi web yang bisa dipasang di HP (PWA) untuk mengoreksi Lembar Jawaban Komputer (LJK) secara otomatis. Guru memotret LJK siswa, aplikasi membaca bulatan yang dihitamkan, mencocokkannya dengan kunci jawaban, lalu langsung menampilkan jumlah benar, salah, dan nilai. Foto hasil scan diberi tanda warna di atasnya sehingga guru bisa melihat sendiri apakah pembacaan sudah tepat.

**Keunggulan utama:** guru bisa membuat template LJK sendiri, sehingga aplikasi cocok dengan LJK apa pun yang dipakai sekolah.

---

## 2. Tujuan dan Ukuran Berhasil
1. Guru dapat mengoreksi satu LJK dalam waktu kurang dari 15 detik, dihitung sejak foto diambil sampai nilai tersimpan.
2. Pembacaan bulatan akurat minimal 98% pada foto yang diambil sesuai panduan (cahaya cukup, kertas rata).
3. Setiap hasil bisa dibuktikan secara visual lewat tanda warna di atas foto.
4. Guru tanpa pengetahuan teknis bisa membuat template baru dalam kurang dari 10 menit.
5. Mampu menangani 9 kelas dengan maksimal 44 siswa per kelas untuk satu ujian tanpa lambat.

---

## 3. Pengguna
Pengguna utama adalah guru yang mengoreksi LJK dengan HP Android (utama) atau laptop. Guru tidak diasumsikan paham teknologi, sehingga semua layar harus sederhana, tulisan jelas, dan tombol besar. Tidak ada akun siswa. Tidak ada login pada versi 1.

---

## 4. Ruang Lingkup

### Termasuk di Versi 1
- Template LJK buatan sendiri (tambah, ubah, hapus, duplikat)
- Kunci jawaban per ujian (ketik cepat, ketuk di grid, atau scan LJK kunci)
- Scan dengan foto manual (kamera HP atau unggah dari galeri)
- Penilaian otomatis dengan hasil langsung: benar, salah, kosong, perlu dicek, nilai
- Tanda warna di atas foto hasil scan
- Koreksi manual per nomor dengan hitung ulang nilai seketika
- Rekap nilai per ujian dan per kelas, ekspor ke Excel (.xlsx)
- Penyimpanan data di perangkat, bisa dipakai tanpa internet
- Cadangan dan pemulihan data ke file

### Tidak Termasuk di Versi 1 (ditunda ke Versi 2)
- Pembacaan kamera live tanpa memotret
- Beberapa paket soal (Paket A/B) dalam satu ujian
- Analisis butir soal (soal mana yang paling banyak salah)
- Login dan sinkron antar perangkat
- Scan banyak lembar sekaligus
- Template bawaan siap pakai
- Soal esai atau penilaian dengan bobot berbeda per nomor

---

## 5. Keputusan Teknis (Jangan diubah tanpa bertanya kepada pemilik proyek)
- **Bentuk aplikasi:** PWA, mobile-first, bisa dipasang ke layar utama HP dan berjalan offline.
- **Kerangka kerja:** React + Vite + TypeScript.
- **Tampilan:** Tailwind CSS. Tombol besar, kontras tinggi, nyaman dipakai satu tangan.
- **Pembacaan gambar:** OpenCV.js, berjalan di perangkat. Tidak ada gambar yang dikirim ke server.
- **Penyimpanan:** IndexedDB lewat pustaka Dexie.
- **Ekspor Excel:** pustaka SheetJS (xlsx).
- **PWA dan offline:** vite-plugin-pwa.
- **Tanpa server dan tanpa database online pada versi 1.**
- **Pemrosesan gambar dijalankan di Web Worker agar tampilan tidak macet.**

---

## 6. Alur Layar Demi Layar

### Layar 1. Beranda
- Daftar ujian terbaru (nama ujian, kelas, jumlah LJK yang sudah dikoreksi).
- Tombol besar: Ujian Baru.
- Menu bawah: Beranda, Template, Pengaturan.

### Layar 2. Daftar Template
- Kartu template: nama, jumlah soal, jumlah pilihan.
- Tombol: Buat Template Baru, serta menu per template (ubah, duplikat, hapus).

### Layar 3. Buat Template (wizard bertahap)
1. **Nama dan dasar:** Isi nama template, jumlah soal total, jumlah pilihan (A-D atau A-E).
2. **Foto LJK kosong:** Ambil foto atau unggah. Tampilkan panduan pengambilan foto.
3. **Luruskan kertas:** Aplikasi mencoba menemukan empat pojok kertas atau penanda hitam di pojok. Guru bisa menggeser empat titik pojok jika kurang pas. Hasilnya adalah gambar LJK yang sudah lurus.
4. **Tandai blok jawaban:** Satu blok adalah satu kolom nomor (misalnya nomor 1-10). Untuk tiap blok guru melakukan:
   - mengetuk bulatan pertama (nomor pertama, pilihan A);
   - mengetuk bulatan terakhir (nomor terakhir di blok itu, pilihan terakhir);
   - mengisi nomor awal dan jumlah nomor di blok. Aplikasi menghitung posisi semua bulatan lain secara otomatis dan menampilkannya sebagai lingkaran di atas gambar agar guru bisa memeriksa kecocokan. Ulangi untuk blok berikutnya.
5. **Area identitas (opsional):** Jika LJK punya kolom nomor induk atau kode, guru menandainya dengan cara yang sama (blok digit 0-9 per kolom).
6. **Uji template:** Guru memotret satu LJK yang sudah diisi. Aplikasi menampilkan hasil bacaan dengan tanda warna. Jika benar, simpan template.

### Layar 4. Ujian Baru
- Isi: nama ujian, kelas, pilih template.
- Isi kunci jawaban dengan salah satu dari tiga cara:
  1. Ketik cepat, misalnya `ABCDEABCDE...`, aplikasi mengubahnya menjadi jawaban per nomor;
  2. Ketuk di grid, satu nomor satu pilihan;
  3. Scan LJK kunci, yaitu guru mengisi satu LJK dengan jawaban yang benar lalu memotretnya, dan aplikasi memakai hasil bacaannya.
- Tampilkan ringkasan kunci agar guru bisa memeriksa sebelum menyimpan.

### Layar 5. Scan
- Tombol besar: Ambil Foto, dan tombol kecil: Unggah dari Galeri.
- Panduan singkat di layar: kertas rata, cahaya merata, tanpa bayangan tangan, seluruh kertas dan keempat pojok masuk bingkai.
- Setelah foto diambil, tampilkan foto untuk dikonfirmasi: Pakai Foto Ini atau Foto Ulang.
- Saat diproses, tampilkan indikator "Sedang membaca...".
- Jika kertas tidak terdeteksi, tampilkan pesan jelas dan sarankan foto ulang. Jangan pernah menampilkan nilai dari hasil yang gagal dibaca.

### Layar 6. Hasil Scan
- Ringkasan di bagian atas: Benar, Salah, Kosong, Perlu dicek, dan Nilai dengan huruf besar.
- Foto LJK dengan tanda di atasnya:
  - lingkaran hijau pada bulatan yang dihitamkan siswa dan benar;
  - lingkaran merah pada bulatan yang dihitamkan siswa dan salah;
  - cincin hijau putus-putus pada bulatan kunci yang seharusnya;
  - lingkaran kuning pada nomor kosong, ganda, atau ragu.
- Selain warna, tambahkan simbol (centang untuk benar, silang untuk salah, tanda tanya untuk ragu) agar tetap jelas bagi yang sulit membedakan warna.
- Tombol hidupkan atau matikan tanda warna, dan cubit untuk zoom.
- Daftar Perlu Dicek: nomor-nomor kuning dikumpulkan di satu tempat. Mengetuk nomor akan melompat ke posisi nomor itu di foto.
- Koreksi manual: mengetuk nomor membuka pilihan A-E, Kosong. Nilai dan ringkasan langsung dihitung ulang. Tandai nomor yang dikoreksi dengan ikon pensil.
- Identitas siswa: isi nama atau nomor absen (otomatis dari kolom identitas jika template punya, jika tidak diketik manual). Boleh dikosongkan lalu diisi nanti di rekap.
- Tombol: Simpan dan Scan Berikutnya, dan Simpan dan Selesai.
- Peringatan keselarasan: jika tanda tampak bergeser dari bulatan di banyak nomor sekaligus, tampilkan: "Posisi kertas tampak tidak sejajar, mohon foto ulang."

### Layar 7. Rekap Ujian
- Daftar hasil per siswa: nama atau nomor absen, benar, salah, kosong, nilai.
- Filter per kelas.
- Statistik sederhana: rata-rata, tertinggi, terendah, jumlah siswa yang sudah dikoreksi.
- Ketuk satu baris untuk membuka kembali foto dan tanda warna siswa itu, dan boleh dikoreksi lagi.
- Tombol Ekspor Excel.

### Layar 8. Pengaturan
- Ambang pembacaan (lihat bagian 8), dengan nilai awal yang sudah baik.
- Aturan nilai (lihat bagian 9).
- Simpan foto hasil scan: aktif atau nonaktif.
- Cadangkan Data (unduh file) dan Pulihkan Data (pilih file cadangan).
- Hapus semua data (dengan konfirmasi dua langkah).

---

## 7. Struktur Data

### Template
- `id`, `nama`, `jumlahSoal`, `jumlahPilihan`
- `ukuranStandar` (lebar dan tinggi gambar setelah diluruskan, misalnya 1000 x 1414 piksel)
- `jenisPenanda` (penanda hitam di pojok atau tepi kertas)
- `blokJawaban`: daftar blok, tiap blok berisi `nomorAwal`, `jumlahNomor`, `titikBulatanPertama (x, y)`, `titikBulatanTerakhir (x, y)`, `jumlahPilihan`, `radiusBulatan`
- `blokIdentitas` (opsional): daftar kolom digit dengan titik dan radius yang serupa
- `gambarContoh` (gambar LJK kosong yang sudah lurus)

### Ujian
- `id`, `nama`, `kelas`, `idTemplate`, `kunciJawaban` (daftar huruf per nomor), `tanggalDibuat`

### HasilScan
- `id`, `idUjian`, `kelas`, `identitasSiswa`, `jawabanTerbaca`, `jawabanSetelahKoreksi`, `statusPerNomor` (benar, salah, kosong, ganda, ragu), `benar`, `salah`, `kosong`, `nilai`, `fotoLurus` (opsional, JPEG terkompres), `tanggalScan`

---

## 8. Cara Aplikasi Membaca LJK (Alur Pemrosesan)
1. Ambil foto lalu kecilkan ke lebar sekitar 1600 piksel agar cepat.
2. Ubah ke hitam-putih dan perbaiki kontras (misalnya CLAHE) untuk mengurangi pengaruh bayangan.
3. Temukan kertas. Cari empat penanda sudut hitam sesuai jenis template. Jika tidak ada, cari kontur kertas terbesar berbentuk segi empat.
4. Luruskan perspektif (perspective warp) ke ukuran standar template. Setelah ini setiap bulatan berada di posisi yang sama seperti pada template.
5. Hitung kegelapan tiap bulatan. Untuk setiap titik bulatan dari template, ambil lingkaran kecil di area itu (sekitar 70% radius supaya tidak terpengaruh garis tepi bulatan) lalu hitung rasio piksel gelap (0 sampai 1).
6. Putuskan jawaban per nomor. Gunakan aturan relatif terhadap baris yang sama:
   - Bulatan dianggap terisi jika rasio gelap minimal 0,45 dan jelas lebih gelap dari bulatan lain di baris itu.
   - Bulatan dianggap kosong jika rasio gelap di bawah 0,20.
   - Rasio di antara 0,20 dan 0,45 dianggap ragu.
   - Jika dua bulatan atau lebih terisi pada satu nomor, status ganda.
   - Jika tidak ada yang terisi, status kosong. Semua angka ini nilai awal dan bisa diubah di Pengaturan.
7. Periksa kualitas keseluruhan. Jika kertas gagal ditemukan, atau lebih dari 20% nomor berstatus ragu, atau posisi bulatan tampak bergeser, tandai hasil sebagai "Perlu foto ulang".
8. Nilai. Bandingkan dengan kunci jawaban (bagian 9).
9. Buat tanda warna untuk ditampilkan di atas foto yang sudah diluruskan.

*Catatan penting:* pemrosesan hanya boleh memakai foto diam. Jangan membangun pembacaan live pada Versi 1.

---

## 9. Aturan Penilaian (Nilai awal, bisa diubah di Pengaturan)
- Benar bernilai 1, salah dan kosong bernilai 0, tanpa pengurangan.
- Jawaban ganda dihitung salah, dan ditandai kuning agar guru bisa memeriksa.
- Jawaban ragu tidak dihitung otomatis sebagai benar; ditandai kuning dan dihitung salah sampai guru memeriksanya.
- Nilai = (jumlah benar dibagi jumlah soal) dikali 100, dibulatkan ke bilangan bulat terdekat. Skala bisa diubah ke 0-10 di Pengaturan.
- Setiap koreksi manual langsung menghitung ulang semua angka di layar.

---

## 10. Ekspor Excel
- Satu file `.xlsx` per ujian.
- **Lembar 1 Rekap:** kelas, nama atau nomor absen, benar, salah, kosong, nilai.
- **Lembar 2 Jawaban:** jawaban tiap siswa per nomor, dengan kunci jawaban di baris atas.
- Nama file otomatis, misalnya `Nilai_NamaUjian_Tanggal.xlsx`.

---

## 11. Kebutuhan Non-Fungsional
- **Offline:** semua fitur berjalan tanpa internet setelah aplikasi pertama kali dibuka.
- **Kecepatan:** pemrosesan satu foto maksimal 3 detik pada HP Android kelas menengah.
- **Privasi:** foto dan data siswa tidak pernah dikirim ke server mana pun.
- **Kemudahan:** semua tulisan Bahasa Indonesia sederhana, tombol minimal 48 piksel, tidak ada istilah teknis di layar.
- **Ketahanan:** data tidak hilang saat aplikasi ditutup atau HP dimatikan. Beri peringatan jika ruang penyimpanan hampir penuh.
- **Kapasitas:** foto disimpan dalam JPEG terkompres (lebar maksimal 1600 piksel). Sediakan opsi tidak menyimpan foto agar ruang tidak cepat habis.
- **Cadangan:** pengingat cadangan data secara berkala.

---

## 12. Kasus Khusus yang Harus Ditangani
- Foto terlalu gelap, terlalu terang, atau berbayang: tampilkan saran dan minta foto ulang.
- Kertas miring atau terlipat: tetap diluruskan jika empat pojok terdeteksi, dan beri peringatan jika tanda bergeser.
- Hasil pensil terlalu tipis: tandai sebagai ragu.
- Siswa menghapus jawaban sehingga masih ada bekas samar: tandai ragu atau ganda dan jangan menebak.
- Siswa yang sama di-scan dua kali: tanyakan apakah ingin menimpa atau menyimpan sebagai tambahan.
- Template berubah setelah ujian dipakai: ujian yang sudah ada tetap memakai salinan template saat ujian dibuat.

---

## 13. Kriteria Selesai per Fitur
- **Template:** template dengan 40 soal, 4 blok, 5 pilihan bisa dibuat sampai tersimpan. Lingkaran bantu menutup bulatan pada gambar dengan tepat.
- **Kunci jawaban:** ketiga cara mengisi kunci menghasilkan data yang sama untuk contoh yang sama.
- **Scan:** pada 10 foto uji yang baik, minimal 98% bulatan terbaca benar.
- **Hasil:** angka benar, salah, kosong, dan nilai cocok dengan perhitungan manual pada 5 LJK contoh.
- **Tanda warna:** tanda selalu jatuh pada bulatan yang benar pada foto yang diluruskan, dan peringatan muncul pada foto yang sengaja dimiringkan berlebihan.
- **Koreksi manual:** mengubah satu nomor memperbarui nilai seketika dan tersimpan.
- **Rekap dan Excel:** file Excel terbuka normal di Excel atau Google Sheets dan angkanya cocok dengan layar rekap.
- **Offline:** setelah dipasang, semua fitur utama berjalan dalam mode pesawat.

---

## 14. Rencana Pembangunan Bertahap & Integrasi Skill Flashmind

> [!IMPORTANT]
> **Protokol Eksekusi Setiap Tahap Menggunakan Flashmind:**  
> Pada **setiap tahap (Tahap 1 s.d. Tahap 8)**, Antigravity **WAJIB** menerapkan alur kerja Flashmind:  
> 1. **Sebelum Mulai Tahap (`plan-first`):** Membaca memori (`memory_context`/`memory_search`), memeriksa file terkait, menyusun rencana kerja 3–7 langkah kecil yang terverifikasi, dan mengklarifikasi jika ada hal yang memblokir.  
> 2. **Saat Menulis Kode (`no-invented-code`):** Tidak boleh mengarang nama fungsi, library, endpoint, atau CLI flag. Wajib memverifikasi versi paket di `package.json` dan struktur kode yang ada.  
> 3. **Jika Menemukan Error/Bug (`systematic-debugging`):** Cek memori solusi masa lalu, lakukan reproduksi masalah dengan output nyata, temukan akar penyebab dengan bukti, buat perbaikan terkecil, buktikan kelulusan, dan catat pelajaran ke memori.  
> 4. **Sebelum Menyatakan Selesai (`verify-before-done`):** Menjalankan build, typecheck (`tsc`), linter, atau uji coba visual di browser/terminal. Membaca hasil nyata di terminal sebelum mengatakan selesai.  
> 5. **Pencatatan Memori & Dokumen (`memory_save` & `CATATAN.md`):** Menyimpan keputusan arsitektur/pelajaran ke persistent memory Flashmind dan memperbarui `CATATAN.md`.

### Rincian 8 Tahap:
1. **Tahap 1: Kerangka Aplikasi.** Proyek React + Vite + TypeScript + Tailwind, navigasi bawah, layar kosong, dan PWA dasar yang bisa dipasang ke HP.  
   *(Wajib terapkan Flashmind: plan-first, no-invented-code, verify-before-done pada build/dev server).*
2. **Tahap 2: Penyimpanan Data.** Pasang Dexie, buat tabel Template, Ujian, HasilScan, dan halaman Pengaturan dasar (cadangan dan pemulihan).  
   *(Wajib terapkan Flashmind: plan-first, no-invented-code verifikasi Dexie schema, verify-before-done).*
3. **Tahap 3: Mesin Pembaca (Inti).** Pasang OpenCV.js di Web Worker. Bangun alur: foto, luruskan, ukur kegelapan bulatan, putuskan jawaban. Uji lebih dulu dengan template yang ditulis manual dan foto contoh, tanpa antarmuka rumit.  
   *(Wajib terapkan Flashmind: plan-first, systematic-debugging pada algoritma CV, verify-before-done dengan sampel foto).*
4. **Tahap 4: Pembuat Template.** Bangun wizard pada Layar 3 sampai template bisa dibuat guru sendiri dan diuji.  
   *(Wajib terapkan Flashmind: plan-first, no-invented-code, verify-before-done).*
5. **Tahap 5: Ujian dan Kunci Jawaban.** Layar 4 dengan tiga cara mengisi kunci.  
   *(Wajib terapkan Flashmind: plan-first, no-invented-code, verify-before-done).*
6. **Tahap 6: Layar Scan dan Hasil.** Layar 5 dan 6 dengan tanda warna, daftar perlu dicek, dan koreksi manual.  
   *(Wajib terapkan Flashmind: plan-first, no-invented-code, verify-before-done).*
7. **Tahap 7: Rekap dan Ekspor Excel.** Layar 7 dan ekspor `.xlsx` menggunakan SheetJS.  
   *(Wajib terapkan Flashmind: plan-first, no-invented-code pada SheetJS API, verify-before-done).*
8. **Tahap 8: Penyempurnaan.** Peringatan kualitas foto, mode offline penuh, ukuran dan kejelasan tombol, uji di HP asli.  
   *(Wajib terapkan Flashmind: full verification, session summary ke memory).*

---

## 15. Aturan Kerja untuk Antigravity
1. **Kerjakan hanya satu tahap per perintah**, lalu berhenti dan jelaskan cara mengujinya.
2. **Jelaskan setiap hasil dengan bahasa awam.** Pemilik proyek bukan programmer.
3. **Jangan mengubah keputusan teknis pada bagian 5 tanpa bertanya.**
4. **Jangan menambah fitur di luar ruang lingkup Versi 1.**
5. **Jangan menyimpan atau mengirim data siswa ke luar perangkat.**
6. **Wajib Selalu Menggunakan Skill Flashmind di Setiap Tahap:**
   - Gunakan `plan-first` untuk merancang langkah verifikasi sebelum menulis kode.
   - Gunakan `no-invented-code` agar tidak ada fungsi atau pustaka halusinasi.
   - Gunakan `systematic-debugging` jika ada kendala atau bug.
   - Gunakan `verify-before-done` dengan bukti terminal nyata sebelum menyatakan selesai.
   - Gunakan memori lokal Flashmind (`memory_save` / `memory_search`) untuk merekam keputusan arsitektur.
7. **Buat file `CATATAN.md` yang diperbarui setiap tahap:** apa yang sudah jadi, apa yang belum, dan cara menjalankan aplikasi.
8. **Jika ada pilihan yang belum jelas di dokumen ini, tanyakan lebih dulu, jangan menebak.**

---

## 16. Bahan yang Perlu Disiapkan Pemilik Proyek
Sebelum tahap 3, siapkan:
1. 1 lembar LJK kosong yang biasa dipakai (difoto di tempat terang, kertas rata).
2. 5 sampai 10 lembar LJK sudah diisi dengan jawaban yang kuncinya diketahui, termasuk beberapa yang sengaja dibuat sulit: jawaban ganda, kosong, pensil tipis, kertas sedikit miring, dan cahaya redup.
3. Kunci jawaban untuk lembar-lembar tersebut, supaya hasil aplikasi bisa dibandingkan dengan hitungan manual.

---

## 17. Pengembangan Versi 2 (Gambaran)
Pembacaan kamera live, paket soal A/B, analisis butir soal, login dan sinkron antar perangkat, scan banyak lembar, dan template bawaan siap pakai. Semua ini baru dikerjakan setelah Versi 1 terbukti akurat dipakai di kelas.
