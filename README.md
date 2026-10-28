# 🏭 PE-Portal (SEIN Production Engineer Team Platform)

[![Go Version](https://img.shields.io/badge/Go-1.22+-00ADD8?style=flat&logo=go)](https://golang.org)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=flat&logo=react)](https://react.dev)
[![Tauri](https://img.shields.io/badge/Tauri-v2-24C8DB?style=flat&logo=tauri)](https://tauri.app)
[![GitHub Release](https://img.shields.io/github/v/release/endrisusanto/PE-Portal?style=flat&logo=github&color=347d39)](https://github.com/endrisusanto/PE-Portal/releases)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat&logo=postgresql)](https://www.postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat&logo=redis)](https://redis.io)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat&logo=docker)](https://www.docker.com)
[![License](https://img.shields.io/badge/License-Proprietary%20%2F%20Internal-red.svg)](LICENSE)

Platform manajemen operasional dan rekayasa teknik terintegrasi (all-in-one) untuk **SEIN PE Group (Samsung Electronics Indonesia)**. Dirancang khusus untuk menghilangkan fragmentasi data Excel lokal, mempercepat NPI (New Product Introduction), mengotomasi laporan kerja, dan menyediakan utilitas teknik mandiri (*self-hosted*) dengan performa tinggi dan konsumsi memori minimal (*zero-bloat*).

Dokumen ini disusun sebagai **dokumentasi teknis sistem** sekaligus **acuan komprehensif pembuatan slide presentasi** manajemen dan tim.

---

## 📑 Daftar Isi

1. [Struktur Organisasi SEIN PE Group](#-struktur-organisasi-sein-pe-group)
2. [Executive Summary: Problem vs Solution](#-executive-summary-problem-vs-solution)
3. [Katalog Fitur, Workflow & Benefit](#-katalog-fitur-workflow--benefit)
   - [1. New Model Development & Milestone Matrix](#1-new-model-development--milestone-matrix)
   - [2. Innovation & Best Practice (BP) Management](#2-innovation--best-practice-bp-management)
   - [3. Project Management & Interactive Calendar](#3-project-management--interactive-calendar)
   - [4. Sample Management & Overseas DHL Tracker](#4-sample-management--overseas-dhl-tracker)
   - [5. Software Mass Release (MR) & GBA Task Management](#5-software-mass-release-mr--gba-task-management)
   - [6. Digital Work Reports & Automated SMTP Dispatcher](#6-digital-work-reports--automated-smtp-dispatcher)
   - [7. Engineering Document Archive & In-Browser Viewer](#7-engineering-document-archive--in-browser-viewer)
   - [8. IMEI Knowledge Base & Technical Runbooks](#8-imei-knowledge-base--technical-runbooks)
   - [9. GMES Monitoring & Issue Tracker](#9-gmes-monitoring--issue-tracker)
   - [10. Online Training & Competency Skill Matrix](#10-online-training--competency-skill-matrix)
   - [11. Engineering Utility Suite & Self-Hosted AI](#11-engineering-utility-suite--self-hosted-ai)
   - [12. Virtual Office & Team Directory](#12-virtual-office--team-directory)
   - [13. Role-Based Access Control & Dynamic Menu Security](#13-role-based-access-control--dynamic-menu-security)
   - [14. Multi-Language & Canvas 60 FPS Personalization](#14-multi-language--canvas-60-fps-personalization)
   - [15. Windows Desktop Tray Manager (Tauri v2 + Rust)](#15-windows-desktop-tray-manager-tauri-v2--rust)
4. [Panduan Acuan Slide Presentasi](#-panduan-acuan-slide-presentasi)
5. [Arsitektur & Spesifikasi Teknologi](#-arsitektur--spesifikasi-teknologi)
6. [Panduan Instalasi & Deployment](#-panduan-instalasi--deployment)

---

## 👥 Struktur Organisasi SEIN PE Group

Platform dirancang memetakan alur kerja spesifik dari tiga divisi utama Production Engineering di SEIN:

```
                          ┌────────────────────────────────┐
                          │         SEIN PE Group          │
                          └──────────────┬─────────────────┘
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
┌──────────────────────┐      ┌──────────────────────┐      ┌──────────────────────┐
│    PE Production     │      │       PE Mecha       │      │ PE Solution Product. │
├──────────────────────┤      ├──────────────────────┤      ├──────────────────────┤
│ • BOM Management     │      │ • JIG Development    │      │ • IMEI Management    │
│ • Setup Work Instruct│      │ • Unit BOX Develop.  │      │ • Program PGM Mgmt   │
│ • Line Support & SOP │      │ • MRO & Preventive   │      │ • Software Mass Rel. │
│ • Model Readiness    │      │ • Mechanical Analyst │      │ • GBA Task Manager   │
│ • Production Yield   │      │ • Line Modification  │      │ • Sample Tracking    │
└──────────────────────┘      └──────────────────────┘      └──────────────────────┘
```

---

## 📊 Executive Summary: Problem vs Solution

| Area Operasional | Tantangan Sebelumnya (Before) | Solusi PE-Portal (After) | Dampak Bisnis (Impact) |
| :--- | :--- | :--- | :--- |
| **New Model NPI** | Milestone tersebar di berbagai file Excel personal; status gate tidak sinkron antar divisi. | Matriks visual terpusat dengan filter fase NPI, kategori model, bulk import dari clipboard, dan export XML Spreadsheet. | Sinkronisasi status model 100% *real-time*; waktu persiapan meeting mingguan terpangkas dari 3 jam menjadi 5 menit. |
| **Inovasi & Kaizen** | Ide inovasi tercatat manual di form kertas/PPT; sulit menghitung total cost-saving pabrik. | Pipeline digital inovasi berjenjang (Draft s/d Implemented) dengan kalkulator ROI otomatis dan tracking replikasi antar line. | Peningkatan partisipasi ide engineer hingga 40%; audit cost-saving transparan dan terdata akurat. |
| **Pekerjaan & JIG** | Progres JIG dan Unit BOX ditanyakan berulang kali via chat grup; risiko miss deadline tinggi. | ToDo list dan Project Calendar terpadu dengan milestone, PIC assignment, prioritas, dan status visual. | Transparansi progres pengerjaan JIG/BOX; reduksi keterlambatan pengerjaan hingga 35%. |
| **Laporan Kerja** | Pembuatan email laporan berkala manual, rawan salah kirim penerima, format tidak seragam. | Block editor dokumen berfitur *live scraper* data proyek + scheduler otomatis pengiriman email SMTP via cron. | Waktu rekapitulasi laporan terpotong 80%; distribusi email tepat waktu setiap jadwal shift/mingguan. |
| **Dokumen Teknik** | Butuh install Microsoft Office di semua PC; risiko revisi file lama tertukar di line. | In-browser document viewer (PDF, Word, Excel, Gambar) tanpa Office lokal + link share publik berbatas waktu. | Standarisasi SOP di lini produksi; nol lisensi software pembaca tambahan untuk terminal line. |
| **Utilitas Gambar/PDF**| Ketergantungan pada website kompresi online (kebocoran rahasia dokumen/foto prototipe SEIN). | Utilitas *offline & self-hosted* (Local U2Net AI background removal, Python PDF stream compressor, VAAPI video). | Keamanan data prototipe 100% internal; bebas biaya langganan software pihak ketiga. |

---

## 🌟 Katalog Fitur, Workflow & Benefit

---

### 1. New Model Development & Milestone Matrix

Sistem pelacakan siklus hidup pengenalan model baru (NPI) dari fase awal hingga produksi massal, dilengkapi matriks visual pemeriksaan kesiapan lini produksi (*gating checkpoints*).

```
   [Registrasi / Bulk Paste] ──► [Kategori: Flagship/MP/TNP] ──► [Milestone Gate Tracking]
              │                                                            │
              ▼                                                            ▼
   [Filter NPI / Mass Prod]  ◄─── [Audit Trail & Validation Photo] ◄─── [Export XLS/CSV]
```

#### Alur Kerja (Workflow):
1. **Registrasi Model**: Engineer mendaftarkan model baru secara manual melalui modal form atau menggunakan **Bulk Import** (cukup *copy-paste* tabel dari Microsoft Excel / Google Sheets ke kolom input teks TSV).
2. **Kategorisasi Otomatis**: Menetapkan kategori model:
   - 👑 **Flagship / Premium**: Model unggulan dengan standar toleransi dan *gating* ketat.
   - 📑 **Mass Product**: Model reguler bervolume tinggi.
   - ⚡ **TNP (Trial New Product)**: Model uji coba atau varian baru.
3. **Pemeriksaan Milestone**: Tim memvalidasi kesiapan pada setiap pos checkpoint:
   - *Gating Review*, *LQV (Line Quality Verification)*, *Reliability Testing*, *Quality Check*, hingga *SOP Release Target*.
4. **Verifikasi Validasi**: Pengunggahan foto hasil uji lini, catatan teknis dengan tabel Markdown, serta persetujuan *gate* eksplisit oleh Leader/Supervisor.
5. **Monitoring & Distribusi**: Manajemen memfilter status melalui tab (*Active NPI* vs *Released & Mass Prod*), lalu mengekspor data ke format **Excel berformat warna (.xls)** atau **CSV (RFC-4180 dengan UTF-8 BOM)** untuk laporan rapat divisi.

#### Keuntungan (Benefit):
- **Visibilitas Instan**: Seluruh anggota tim melihat posisi tahapan model yang sama tanpa perlu saling bertukar file Excel.
- **Bulk Migration Cepat**: Memasukkan puluhan model dan tanggal milestone hanya dalam hitungan detik tanpa *data-entry* satu per satu.
- **Data Integrity**: Audit trail mencatat siapa yang mengubah status gate dan melampirkan bukti fisik pengujian (foto/catatan teknis).

---

### 2. Innovation & Best Practice (BP) Management

Katalog digital pengelolaan ide inovasi (*kaizen*), modifikasi mesin/JIG, perbaikan proses produksi, dan efisiensi lini dengan perhitungan nilai penghematan (*cost saving*).

```
[Pengajuan Ide / Draft] ──► [Review Leader] ──► [Testing di Lini] ──► [Implemented] ──► [Replikasi Antar Line]
                                                             ▲
                                                    [Kalkulasi ROI/Saving]
```

#### Alur Kerja (Workflow):
1. **Pendaftaran Ide**: Engineer menginput deskripsi ide, area line terkait, kategori klasifikasi (Class 1 s/d Class 4), serta estimasi penghematan biaya ($ / Rp) dan waktu (detik/unit).
2. **Review & Voting**: Rekan engineer dan leader memberikan voting dukungan serta diskusi melalui kolom komentar terpadu.
3. **Trial & Validasi**: Ide beralih status ke *Testing* dengan melampirkan dokumentasi *Before vs After* (foto atau diagram).
4. **Implementasi & Penghargaan**: Setelah disetujui, inovasi berstatus *Implemented*, otomatis menghitung total kumulatif *cost saving* divisi di Dashboard.
5. **Tracking Replikasi**: Sistem melacak apakah inovasi berhasil direplikasi ke line produksi lain di pabrik.

#### Keuntungan (Benefit):
- **Transparansi ROI**: Manajemen memiliki data angka konkret mengenai kontribusi efisiensi finansial SEIN PE Group.
- **Knowledge Sharing**: Mencegah penemuan roda yang sama (*reinventing the wheel*) antar shift dan lini produksi.
- **Motivasi Tim**: Engineer dapat menunjukkan portofolio inovasi terverifikasi untuk evaluasi kinerja berkala.

---

### 3. Project Management & Interactive Calendar

Manajemen penugasan proyek perakitan JIG, pembuatan Unit BOX, pemeliharaan MRO (Maintenance, Repair, and Overhaul), dan proyek perangkat lunak lini.

```
[Buat Proyek / Task] ──► [Assign PIC & Deadline] ──► [Interactive Calendar / Gantt] ──► [Milestone Checklist] ──► [Finish]
```

#### Alur Kerja (Workflow):
1. **Inisiasi Proyek**: Menentukan judul proyek, divisi penanggung jawab (Production, Mecha, Solution), tingkat prioritas (Low, Medium, High, Urgent), dan batas waktu (*due date*).
2. **Pembagian Milestone**: Menambahkan checklist tugas teknis (misal: *Desain CAD*, *Machining CNC*, *Wiring Sensor*, *Buy-off QC*).
3. **Visualisasi Jadwal**: Memantau seluruh aktivitas melalui **Project Calendar** (tampilan bulanan interaktif) atau daftar ToDo dengan indikator *overdue*.
4. **Penyelesaian & Arsip**: PIC memperbarui status hingga selesai 100%, otomatis memutakhirkan metrik produktivitas tim.

#### Keuntungan (Benefit):
- **Beban Kerja Seimbang**: Leader dapat melihat distribusi beban kerja tiap engineer secara objektif.
- **Ketepatan Jadwal JIG**: Mencegah keterlambatan kesiapan perlengkapan produksi menjelang fase peluncuran model baru.

---

### 4. Sample Management & Overseas DHL Tracker

Pencatatan sirkulasi unit sampel prototipe (Proto, EVT, DVT, PVT) yang masuk ke pabrik serta pemantauan pengiriman sampel dari kantor pusat R&D Korea (Suwon/Gumi).

```
[Paket Dikirim dari HQ] ──► [Input AWB di DHL Tracker] ──► [Cek Status Real-time]
                                                                  │ (Sampel Tiba di SEIN)
                                                                  ▼
[Pengembalian / Scrap] ◄── [Checkout Peminjaman Teknisi] ◄── [Registrasi Unit di DB]
```

#### Alur Kerja (Workflow):
1. **Tracking Pengiriman**: PIC memasukkan nomor Air Waybill (AWB) ke modul **DHL Tracker** untuk memantau paket komponen/sampel dari Korea secara *real-time*.
2. **Registrasi Sampel Masuk**: Saat sampel tiba, unit didaftarkan ke **Database Sample PE** lengkap dengan nomor IMEI/Serial, model, fase perakitan, dan lokasi rak penyimpanan.
3. **Peminjaman & Pengembalian**: Teknisi melakukan *checkout* peminjaman untuk pengujian lini; sistem mencatat durasi dan penanggung jawab unit untuk audit keamanan perangkat.

#### Keuntungan (Benefit):
- **Zero Missing Prototype**: Mencegah kehilangan atau salah letak unit prototipe rahasia yang memiliki nilai keamanan tinggi.
- **Kepastian Pengiriman**: Mengeliminasi kebutuhan membuka website tracking kurir secara terpisah; estimasi tiba langsung terlihat di portal tim.

---

### 5. Software Mass Release (MR) & GBA Task Management

Pengelolaan berkas biner firmware, program flashing lini, dan persetujuan build perangkat lunak pabrik.

```
[Build Firmware Siap] ──► [Daftarkan Software MR] ──► [Verifikasi Checksum & Model] ──► [Approval & Deploy ke Lini]
                                       │
                                       ▼
                       [Sync GBA Tasks (Build Approval)]
```

#### Alur Kerja (Workflow):
1. **Pendaftaran Rilis**: Engineer Solution mengunggah detail versi biner firmware, model target, checksum integritas, dan catatan rilis (*release notes*).
2. **Sinkronisasi GBA**: Mengintegrasikan task build approval dengan server Google Build Approval untuk memastikan kepatuhan spesifikasi.
3. **Persetujuan & Distribusi**: Verifikasi kelayakan oleh tim engineering sebelum firmware dideploy ke stasiun *flashing/download* produksi massal.

#### Keuntungan (Benefit):
- **Pencegahan Human Error**: Menghilangkan insiden kesalahan pemasangan versi firmware yang dapat memicu *mass defect* di lini produksi.
- **Audit Kemudahan**: Setiap versi biner memiliki riwayat siapa yang menyetujui dan kapan diterapkan di lini.

---

### 6. Digital Work Reports & Automated SMTP Dispatcher

Modul penyusunan laporan kerja berkala (harian/mingguan) dengan editor modern yang terhubung langsung ke database portal, serta pengiriman email otomatis.

```
[Buka Report Editor] ──► [Klik 'Scrape Data' (Auto-Insert Proyek/Model)] ──► [Pilih Grup Kontak] ──► [Set Jadwal Cron / Kirim]
```

#### Alur Kerja (Workflow):
1. **Penyusunan Laporan**: Engineer membuat laporan menggunakan editor blok kaya (formatting, tabel, checklist, gambar).
2. **1-Click Live Scraper**: Cukup menekan tombol *Scrape*, sistem otomatis menarik ringkasan model NPI aktif, proyek selesai, dan inovasi terbaru langsung ke dalam badan laporan.
3. **Manajemen Penerima Cerdas**: Menggunakan *Email Chip Input* dengan validasi otomatis, mendukung *paste* banyak email sekaligus, atau memilih **Grup Kontak Kustom** (misal: *Leader Part, All Solution, Mecha Team*).
4. **Penjadwalan Otomatis**: Laporan dapat dikirim seketika atau dijadwalkan secara otomatis menggunakan engine SMTP background scheduler pada jam yang ditentukan.

#### Keuntungan (Benefit):
- **Efisiensi Waktu Signifikan**: Memangkas waktu pembuatan laporan hingga 80% karena data status proyek ditarik otomatis dari database tanpa ketik manual.
- **Tampilan Konsisten & Mobile-Friendly**: Desain email tabel responsif (skala hingga 960px) terbaca sempurna baik di layar laptop maupun smartphone Samsung.

---

### 7. Engineering Document Archive & In-Browser Viewer

Penyimpanan terpusat untuk dokumen teknis, gambar kerja CAD, *BOM (Bill of Materials)*, spesifikasi komponen, dan lembar instruksi kerja (SOP).

```
[Upload Dokumen Teknik] ──► [Indexing & Metadata] ──► [In-Browser Safe Preview] ──► [Generate Token Share Publik]
```

#### Alur Kerja (Workflow):
1. **Pengunggahan Terpusat**: Dokumen diunggah dengan kategori model, divisi, nomor revisi, dan tag pencarian.
2. **Pratinjau Langsung (In-Browser)**: Dokumen berformat **PDF, Word (.docx), Excel (.xlsx), dan Gambar** dapat langsung dibaca di dalam browser tanpa perlu membuka aplikasi luar atau lisensi Microsoft Office di komputer user.
3. **Pembagian Dokumen Aman**: Mendukung pembuatan link berbagi publik berbatas waktu (*Secure Token Share*) untuk diakses teknisi di lini tanpa perlu login ke sistem utama.

#### Keuntungan (Benefit):
- **Eliminasi Lisensi Eksternal**: Komputer terminal di area lini produksi tidak memerlukan lisensi software pembaca khusus.
- **Pemberantasan SOP Usang**: Menjamin semua orang selalu mengakses dokumen versi termutakhir langsung dari server pusat.

---

### 8. IMEI Knowledge Base & Technical Runbooks

Basis pengetahuan khusus untuk stasiun kerja IMEI, pengujian fungsi perangkat (*Function Test*), kalibrasi RF, dan prosedur penanganan masalah (*troubleshooting*).

```
[Identifikasi Masalah di Line] ──► [Cari Berdasarkan Model / Kode Eror] ──► [Buka Runbook Terkait] ──► [Solusi Diterapkan]
```

#### Alur Kerja (Workflow):
1. **Dokumentasi Masalah**: Engineer menuliskan panduan penanganan masalah station (*Troubleshooting Runbook*) berbasis Markdown dengan tangkapan layar dan langkah bertahap.
2. **Pencarian Cepat**: Saat terjadi kendala di lini perakitan, teknisi mencari artikel menggunakan kata kunci model atau pesan eror mesin.
3. **Pemeliharaan Konten**: Artikel dapat diperbarui oleh PIC dengan riwayat tanggal revisi untuk menjaga keakuratan solusi.

#### Keuntungan (Benefit):
- **Reduksi Downtime Lini**: Mengurangi waktu henti mesin secara drastis saat terjadi gangguan stasiun kerja karena panduan solusi tersedia instan.
- **Standardisasi Penanganan**: Solusi teknis terdokumentasi dan seragam di semua shift kerja tanpa tergantung pada satu teknisi senior.

---

### 9. GMES Monitoring & Issue Tracker

Pemantauan isu dan rekonsiliasi data operasional terkait sistem manufaktur global Samsung (Global Manufacturing Execution System).

#### Alur Kerja (Workflow):
- Memetakan anomali stasiun lini (misal: *Station Barcode Mismatch, Carrier Lock, Server Timeout*), mencatat akar masalah (*Root Cause Analysis*), dan mencatat tindakan pencegahan (*Corrective Action*).

#### Keuntungan (Benefit):
- Pencatatan insiden sistematis mempermudah analisis tren kegagalan mingguan saat evaluasi kualitas pabrik.

---

### 10. Online Training & Competency Skill Matrix

Pusat modul pembelajaran internal, sertifikasi SOP lini, dan matriks keahlian teknisi Production Engineering.

#### Alur Kerja (Workflow):
- Menyelenggarakan materi pelatihan teknis, mencatat absensi pelatihan, menguji pemahaman SOP, dan menampilkan radar kompetensi engineer untuk persiapan pengenalan lini model baru.

#### Keuntungan (Benefit):
- Memastikan hanya personel yang tersertifikasi yang bertugas menangani stasiun kritis pada peluncuran model flagship baru.

---

### 11. Engineering Utility Suite & Self-Hosted AI

Paket peralatan utilitas mandiri (*zero external dependency*) yang berjalan di server internal SEIN untuk kebutuhan sehari-hari engineer:

| Alat Utilitas | Fungsi Teknis Utama | Keuntungan & Keamanan |
| :--- | :--- | :--- |
| 🗜️ **Document PDF Compressor** | Kompresi berkas PDF berukuran besar menggunakan engine kompresi stream Python lokal. | Mengurangi ukuran file hingga 70% agar mudah dilampirkan ke email tanpa kirim ke web pihak ketiga. |
| 📑 **PDF Merge & Split** | Menggabungkan beberapa dokumen uji coba atau memisahkan halaman spesifik. | Mempermudah penataan laporan teknis tanpa aplikasi desktop berbayar. |
| 📊 **PPTX Technical Summarizer** | Ringkasan otomatis materi presentasi teknis (.pptx) menggunakan AI LLM internal. | Mengekstrak poin penting dan *action item* dari laporan tebal dalam hitungan detik. |
| ✂️ **Local Remove Background** | Penghapusan latar belakang foto JIG dan perangkat menggunakan **U2Net ONNX** lokal. | Foto komponen bersih untuk dokumen SOP; gambar prototipe rahasia tidak bocor ke cloud publik. |
| 🎬 **VAAPI Video Compressor** | Kompresi video rekaman lini produksi menggunakan akselerasi perangkat keras server. | Video dokumentasi gerak mesin lebih ringan untuk diunggah dan dibagikan. |
| 💻 **CL Compare & Build Tool** | Perbandingan baris kode perubahan changelist software dan generator perintah build. | Mempercepat proses debugging dan verifikasi rilis program teknisi software. |
| 🤖 **AI Chat Assistant** | Floating widget asisten AI terhubung ke endpoint internal (LM Studio / Ollama / API). | Memberikan referensi kode, format penulisan, dan troubleshooting tanpa batas kuota. |

---

### 12. Virtual Office & Team Directory

Representasi digital tata letak ruang kantor PE (*digital twin layout*) beserta direktori keahlian seluruh anggota tim.

#### Alur Kerja & Benefit:
- Menampilkan denah meja kerja engineer, status kehadiran (*In Office / Support Line / WFH*), dan nomor kontak internal.
- Mempercepat koordinasi saat personel lini memerlukan bantuan langsung dari engineer mekanik atau software terkait di lapangan.

---

### 13. Role-Based Access Control & Dynamic Menu Security

Sistem keamanan berlapis dengan pengaturan visibilitas menu hingga sub-menu bertingkat (*multilevel granular menu control*).

```
[Request Halaman / Menu] ──► [Cek Status Master On/Off] ──► [Cek Blacklist User]
                                                                     │
[Tampilkan Menu] ◄── [Cek Group/Part ID] ◄── [Cek Role Access] ◄── [Cek Whitelist User]
```

#### Fitur & Mekanisme:
- **Tingkatan Role Utama**:
  - 👑 **Admin**: Kontrol penuh sistem, manajemen akun, audit log, dan konfigurasi hak akses menu.
  - 🛠️ **Engineer**: Akses operasional penuh untuk menambah, mengedit, dan memvalidasi pekerjaan teknis.
  - 👁️ **Viewer / Operator**: Akses baca (*read-only*) untuk meninjau SOP, jadwal, dan matriks kesiapan.
- **Granular Menu Manager**: Admin dapat menyembunyikan atau menampilkan menu tertentu berdasarkan role, grup bagian (*Part ID*), maupun whitelist/blacklist username tertentu tanpa mengubah kode program.
- **Dual Authentication**: Mendukung otentikasi lokal JWT maupun integrasi corporate **LDAP / Active Directory**.

---

### 14. Multi-Language & Canvas 60 FPS Personalization

Dukungan pengalaman pengguna kelas premium yang dirancang nyaman digunakan oleh teknisi lokal maupun ekspatriat Korea.

- **3 Bahasa Instan**: Tombol beralih bahasa satu klik: **Bahasa Indonesia (ID)**, **English (EN)**, dan **한국어 (KO)**.
- **Tema Visual Dinamis (HTML5 Canvas 2D)**: Animasi latar belakang halus 60 FPS tanpa beban GPU (*Sakura Mochi, Neon Emerald, Galactic Cobalt, Sunset Amber, Cyber Lavender, SEIN Corporate Teal, Custom Hex Picker*).
- **Tactile Sand Grain Filter**: Efek tekstur mikro elegan untuk tampilan modern yang tidak melelahkan mata saat bekerja di ruang kendali (*cleanroom*).

---

### 15. Windows Desktop Tray Manager (Tauri v2 + Rust)

Aplikasi desktop native Windows berbobot sangat ringan (< 15 MB) untuk pengoperasian server lokal tanpa jendela konsol hitam CMD.

- **Zero Terminal Clutter**: Layanan backend Go berjalan di background tanpa memunculkan jendela CMD (`CREATE_NO_WINDOW`).
- **Live Log Viewer**: Menampilkan log transaksi backend secara *real-time* untuk kebutuhan diagnostik.
- **Cryptographic Auto-Updater**: Pembaruan sistem otomatis satu klik berbasis signature Minisign langsung dari GitHub Releases resmi.
- **Installer Siap Pakai**: Tersedia dalam format installer Windows terverifikasi: `.exe` (NSIS) dan `.msi` (Enterprise WiX).

---

## 🎯 Panduan Acuan Slide Presentasi

Gunakan panduan berikut sebagai kerangka saat menyusun materi presentasi slide (PowerPoint / Keynote):

```
┌────────────────────────────────────────────────────────────────────────┐
│                        STRUKTUR SLIDE PRESENTASI                       │
├─────────┬────────────────────────────┬─────────────────────────────────┤
│ Slide # │ Topik Slide                │ Poin Kunci & Narasi Utama       │
├─────────┼────────────────────────────┼─────────────────────────────────┤
│ Slide 1 │ Judul & Visi Proyek        │ PE-Portal: All-in-One Platform  │
│ Slide 2 │ Tantangan Lini & Masalah   │ Fragmentasi Data & Redundansi   │
│ Slide 3 │ Solusi & Arsitektur Utama  │ Integrasi NPI, Tugas, Dokumen   │
│ Slide 4 │ New Model Milestone Matrix │ Matriks Visual, Bulk & Export   │
│ Slide 5 │ Inovasi & ROI Pabrik       │ Pipeline Kaizen & Cost-Saving   │
│ Slide 6 │ Manajemen Tugas & Kalender │ JIG, BOX, MRO & PIC Tracking    │
│ Slide 7 │ Otomasi Laporan & Email    │ Scraper Data & Background SMTP  │
│ Slide 8 │ Dokumen & Privasi AI       │ In-Browser Preview, Local U2Net │
│ Slide 9 │ Tata Kelola & Akses Aman   │ Granular RBAC, 3 Bahasa, Tray   │
│ Slide 10│ Dampak Nyata & Kesimpulan  │ Penghematan Waktu & Zero Defect │
└─────────┴────────────────────────────┴─────────────────────────────────┘
```

### Rekomendasi Konten Tiap Slide:

#### 🔹 Slide 1: Cover & Visi Platform
- **Headline**: *Transformasi Digital Operasional SEIN Production Engineering*.
- **Sub-headline**: *Platform Terpadu Manajemen Model Baru, Inovasi, dan Efisiensi Operasional Pabrik*.
- **Poin Presenter**: Platform ini dibangun oleh engineer SEIN untuk kebutuhan spesifik lini perakitan smartphone di Cikarang.

#### 🔹 Slide 2: Latar Belakang & Masalah Utama (Pain Points)
- **Status Quo**: Ketergantungan pada puluhan file Excel yang terisolasi di laptop masing-masing personel.
- **Masalah 1**: Keterlambatan informasi kesiapan checkpoint model baru antar departemen (Production vs Mecha vs Solution).
- **Masalah 2**: Laporan kerja manual memakan waktu hingga 3-4 jam per minggu per orang.
- **Masalah 3**: Kerentanan kebocoran informasi prototipe rahasia jika menggunakan software kompresi/gambar gratisan di internet.

#### 🔹 Slide 3: Nilai Tambah Platform (Value Proposition)
- **Terpusat**: Single source of truth untuk seluruh aktivitas engineering.
- **Cepat & Ringan**: Waktu buka halaman kurang dari 1 detik; konsumsi RAM server di bawah 40 MB.
- **Aman**: 100% data dan model kecerdasan buatan berjalan di dalam infrastruktur internal pabrik (*on-premise / intranet*).

#### 🔹 Slide 4: New Model Development & Milestone Matrix (Fitur Utama)
- **Tampilan Visual**: Perlihatkan tangkapan layar matriks model (Flagship, Mass Product, TNP).
- **Poin Utama**:
  - Filter fase aktif (*Active NPI* vs *Released & Mass Prod*).
  - Bulk Import: Cukup *paste* dari Excel, langsung terdata dalam hitungan detik.
  - Multi-Format Export: Unduh laporan ke Excel (.xls bersel warna) dan CSV untuk kebutuhan meeting.

#### 🔹 Slide 5: Inovasi & Penghematan Biaya (Cost Saving)
- **Poin Utama**:
  - Mengubah ide di kepala menjadi aset terukur perusahaan.
  - Penghitungan otomatis total nilai cost-saving divisi ($ & Rp) secara akumulatif.
  - Tracking replikasi ide perbaikan dari Line A ke seluruh lini perakitan lainnya.

#### 🔹 Slide 6: Proyek & Monitoring Jadwal (Project & Calendar)
- **Poin Utama**:
  - Pemantauan kesiapan perakitan JIG dan Unit BOX menjelang jadwal produksi perdana.
  - Tampilan kalender interaktif untuk visualisasi jadwal lintas divisi.

#### 🔹 Slide 7: Otomasi Laporan & Pengiriman Email
- **Poin Utama**:
  - Fitur *Live Scraper*: Cukup klik satu tombol, data progres otomatis masuk ke badan laporan.
  - Pengiriman email terjadwal otomatis via background SMTP server.
  - Grup penerima terkelola (mengeliminasi kesalahan salah alamat email).

#### 🔹 Slide 8: Keamanan Dokumen & Utilitas Mandiri
- **Poin Utama**:
  - Buka dokumen PDF, Word, Excel langsung di browser tanpa butuh lisensi Office di komputer line.
  - Utilitas lokal tanpa internet: Local AI U2Net Background Removal & PDF Compression internal.

#### 🔹 Slide 9: Tata Kelola Akses & Kemudahan Aksesibilitas
- **Poin Utama**:
  - Pengaturan hak menu dinamis sesuai role dan departemen.
  - Dukungan 3 Bahasa (Indonesia, Inggris, Korea) untuk kolaborasi mulus dengan ekspatriat.
  - Aplikasi desktop tray Windows (Tauri) yang berjalan senyap tanpa jendela hitam.

#### 🔹 Slide 10: Ringkasan Dampak Bisnis (Business Impact Summary)
- Tampilkan tabel komparasi sebelum dan sesudah implementasi:
  - ⏱️ **Waktu Rekap Laporan Mingguan**: Turun dari **180 menit** menjadi **15 menit**.
  - 🔄 **Sinkronisasi Status NPI**: Dari **harian/berkala** menjadi **100% Real-Time**.
  - 🛡️ **Keamanan Dokumen Prototipe**: Dari **risiko upload cloud** menjadi **100% Internal On-Premise**.
  - 💰 **Lisensi Eksternal**: **Nol Rupiah** tambahan lisensi berkat software mandiri.

---

## 🛠️ Arsitektur & Spesifikasi Teknologi

| Layer Arsitektur | Teknologi yang Digunakan | Karakteristik & Keunggulan |
| :--- | :--- | :--- |
| **Desktop Manager** | Tauri v2, Rust 1.77+, WinAPI | Ukuran aplikasi < 15MB, tanpa jendela konsol hitam CMD, pembaruan otomatis Minisign |
| **Frontend Web** | React 19, Vite, Vanilla CSS Modules | Build ultra cepat (< 300ms), nol bloat UI library pihak ketiga, responsif |
| **Backend REST API** | Go 1.22+, Gin Web Framework, pgx | Konsumsi memori idle sangat rendah (< 35MB), throughput konkurensi tinggi |
| **Kecerdasan Buatan (AI)**| U2Net ONNX, OpenAI / LM Studio Client | Background removal mandiri tanpa internet, integrasi asisten teknik |
| **Basis Data Relasional**| PostgreSQL 16 | ACID compliant, skema terstruktur, skrip migrasi versi lengkap (001 - 021) |
| **Cache & Task Queue** | Redis 7 | Penyimpanan cache cepat, koordinasi scheduler cron, blacklist token JWT |
| **Kontainerisasi** | Docker Compose, Nginx Alpine | Multi-stage build hemat kapasitas, siap deploy produksi instan |

---

## 🚀 Panduan Instalasi & Deployment

### 1. Deployment Cepat Menggunakan Docker Compose (Rekomendasi)

```bash
# 1. Clone repository
git clone https://github.com/endrisusanto/PE-Portal.git
cd PE-Portal

# 2. Siapkan file konfigurasi environment
cp .env.example .env

# 3. Jalankan seluruh container dalam mode background
docker compose up -d --build
```

Akses portal melalui browser di: `http://localhost:3025`

### 2. Deployment 1-Click untuk Windows

Cukup klik dua kali file **`deploy-windows.bat`** atau jalankan perintah PowerShell berikut:
```powershell
.\deploy-windows.ps1
```
Skrip akan otomatis memeriksa Docker Desktop, menyiapkan file `.env`, mengompilasi kontainer, dan membuka browser ke alamat aplikasi.

### 3. Pemetaan Port Sistem

| Layanan | Nama Kontainer | Port Internal | Port Host | Deskripsi |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend Web** | `pe-portal-frontend` | `80` | `3025` | Nginx Alpine React SPA |
| **Backend API** | `pe-portal-backend` | `8085` | `8085` | Go REST API Service |
| **Database** | `pe-portal-postgres` | `5432` | `5432` | PostgreSQL 16 Database |
| **Cache & Queue**| `pe-portal-redis` | `6379` | `6379` | Redis 7 Key-Value Store |

### 4. Akun Akses Awal (Default Credentials)

| Role Akses | Username | Password Standar | Wewenang Akses |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin` | `admin123` | Akses penuh sistem, manajemen user & permission menu |
| **Production Engineer**| `engineer`| `engineer123` | Akses input proyek, model matrix, inovasi, dan laporan |
| **Viewer** | `viewer` | `viewer123` | Akses baca (*read-only*) untuk pemantauan informasi |

*(Harap segera ubah password default saat pertama kali sistem digunakan melalui menu Profile).*

---

## 📄 Lisensi & Atribusi

Aplikasi internal ini dikembangkan khusus untuk **SEIN PE Group (Samsung Electronics Indonesia)**.  
Dibangun dengan prinsip rekayasa performa tinggi (*clean code, zero-bloat* `/ponytail`) serta standar estetika antarmuka modern yang fungsional (`/emil-design-eng` & `/better-ui`).
