# 🏭 PE-Portal (SEIN Production Engineer Team Platform)

[![Go Version](https://img.shields.io/badge/Go-1.22+-00ADD8?style=flat&logo=go)](https://golang.org)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=flat&logo=react)](https://react.dev)
[![Tauri](https://img.shields.io/badge/Tauri-v2-24C8DB?style=flat&logo=tauri)](https://tauri.app)
[![GitHub Release](https://img.shields.io/github/v/release/endrisusanto/PE-Portal?style=flat&logo=github&color=347d39)](https://github.com/endrisusanto/PE-Portal/releases)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat&logo=postgresql)](https://www.postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat&logo=redis)](https://redis.io)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat&logo=docker)](https://www.docker.com)
[![License](https://img.shields.io/badge/License-Proprietary%20%2F%20Internal-red.svg)](LICENSE)

Platform manajemen operasional dan rekayasa teknik terintegrasi (all-in-one) untuk **SEIN PE Group (Samsung Electronics Indonesia — Production Engineering)**. Dirancang khusus untuk menghilangkan fragmentasi data Excel lokal, mempercepat NPI (New Product Introduction), mengotomasi laporan kerja, dan menyediakan utilitas teknik mandiri (*self-hosted*) dengan performa tinggi dan konsumsi memori minimal.

Dokumen ini disusun sebagai **dokumentasi teknis sistem**, **panduan penggunaan lengkap**, dan **acuan komprehensif pembuatan slide presentasi** manajemen dan tim.

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
   - [11. Engineering Utility Suite & Self-Hosted AI Tools](#11-engineering-utility-suite--self-hosted-ai-tools)
   - [12. AI Engineering Assistant & PPTX Summarizer](#12-ai-engineering-assistant--pptx-summarizer)
   - [13. Virtual Office & Team Directory](#13-virtual-office--team-directory)
   - [14. Role-Based Access Control & Dynamic Menu Security](#14-role-based-access-control--dynamic-menu-security)
   - [15. Multi-Language & Canvas 60 FPS Personalization](#15-multi-language--canvas-60-fps-personalization)
   - [16. Windows Desktop Tray Manager (Tauri v2 + Rust)](#16-windows-desktop-tray-manager-tauri-v2--rust)
   - [17. ECN Monitoring & AI Insight](#17-ecn-monitoring--ai-insight)
4. [Tutorial Penggunaan Lengkap](#-tutorial-penggunaan-lengkap)
   - [Login dengan Akun ADCorp (LDAP Active Directory)](#login-dengan-akun-adcorp-ldap-active-directory)
   - [Login dengan Akun Lokal](#login-dengan-akun-lokal)
   - [Mode Guest (Pengunjung)](#mode-guest-pengunjung--view-only)
   - [Mengatur Bahasa Antarmuka](#mengatur-bahasa-antarmuka)
   - [Menggunakan New Model Milestone Matrix](#menggunakan-new-model-milestone-matrix)
   - [Membuat & Mengirim Laporan Otomatis](#membuat--mengirim-laporan-kerja-otomatis)
   - [Mengunggah Dokumen & Share Publik](#mengunggah-dokumen--membuat-link-share-publik)
   - [Menggunakan Utilitas Engineering](#menggunakan-utilitas-engineering-tools)
   - [Mengelola Hak Akses Menu (Admin)](#mengelola-hak-akses-menu-admin-only)
   - [Konfigurasi LDAP ADCorp oleh Admin](#konfigurasi-ldap-adcorp-oleh-admin)
5. [Panduan Acuan Slide Presentasi](#-panduan-acuan-slide-presentasi)
6. [Arsitektur & Spesifikasi Teknologi](#-arsitektur--spesifikasi-teknologi)
7. [Panduan Instalasi & Deployment](#-panduan-instalasi--deployment)
   - [Docker Compose (Rekomendasi)](#1-deployment-cepat-menggunakan-docker-compose-rekomendasi)
   - [Windows 1-Click Deploy](#2-deployment-1-click-untuk-windows)
   - [Bare Metal Linux](#3-bare-metal-installation-tanpa-docker)
   - [Windows Desktop Tray Manager](#4-windows-desktop-manager-tauri)
   - [Manual Development Setup](#5-manual-local-development-tanpa-docker)
8. [Automated Release Pipeline](#-automated-release-pipeline-releasesh)
9. [Struktur Repository](#-struktur-repository)

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
│       PE Part        │      │       PE Mecha       │      │ PE Solution Product. │
├──────────────────────┤      ├──────────────────────┤      ├──────────────────────┤
│ • BOM Management     │      │ • JIG Development    │      │ • IMEI Management    │
│ • Setup Work Instruct│      │ • Unit BOX Develop.  │      │ • Program PGM Mgmt   │
│ • Line Support & SOP │      │ • MRO & Preventive   │      │ • Software Mass Rel. │
│ • PIC Model Readiness│      │ • Mechanical Analyst │      │ • GBA Task Manager   │
│ • Production Yield   │      │ • Line Modification  │      │ • Sample Tracking    │
│ • BOM Verification   │      │ • Support Production │      │ • Technical Analyst  │
│ • Support Production │      │                      │      │ • Software Develop.  │
│                      │      │                      │      │ • Release Management │
└──────────────────────┘      └──────────────────────┘      └──────────────────────┘
```

Setiap engineer di PE Group akan otomatis ditempatkan ke dalam salah satu `Group Part` di atas saat registrasi akun, yang menentukan akses menu dan visibilitas data yang relevan untuk pekerjaannya.

---

## 📊 Executive Summary: Problem vs Solution

| Area Operasional | Tantangan Sebelumnya (Before) | Solusi PE-Portal (After) | Dampak Bisnis (Impact) |
| :--- | :--- | :--- | :--- |
| **New Model NPI** | Milestone tersebar di puluhan file Excel personal; status gate tidak sinkron antar PE Part, Mecha, dan Solution. Email manual menanyakan progres satu per satu. | Matriks visual terpusat dengan filter fase NPI aktif, kategori model (Flagship/Mass Product/TNP), bulk import dari clipboard Excel, dan export berformat warna ke `.xls` / `.csv`. | Sinkronisasi status model 100% *real-time*; waktu persiapan meeting NPI mingguan terpangkas dari **3 jam → 5 menit**. |
| **Inovasi & Kaizen** | Ide inovasi tercatat manual di form kertas dan slide PPT berbeda-beda; sulit mengakumulasi total *cost-saving* pabrik secara objektif. | Pipeline digital berjenjang (Draft → Review → Testing → Implemented → Replicated) dengan kalkulator ROI otomatis, klasifikasi *class* (1–4), dan tracking replikasi antar line. | Peningkatan partisipasi ide engineer hingga **40%**; audit *cost-saving* transparan dan terdata akurat per kuartal. |
| **Penugasan JIG/BOX** | Progres pengerjaan JIG dan Unit BOX ditanyakan berulang kali via WhatsApp/chat grup; risiko *miss deadline* tinggi karena tidak ada reminder otomatis. | ToDo list dan Project Calendar interaktif dengan milestone checklist, PIC assignment, tingkat prioritas (Low/Medium/High/Urgent), dan status visual warna. | Transparansi progres pengerjaan JIG/BOX; reduksi keterlambatan pengerjaan hingga **35%**. |
| **Laporan Kerja** | Pembuatan email laporan berkala (harian/mingguan) manual menggunakan Outlook, rawan salah kirim penerima, format tidak seragam antar part. | Block editor dokumen dengan fitur *1-click live scraper* data proyek/model + scheduler background otomatis pengiriman email SMTP via cron. | Waktu rekapitulasi laporan terpotong **80%**; distribusi email tepat waktu setiap jadwal shift/mingguan tanpa intervensi manual. |
| **Dokumen Teknik** | Butuh install Microsoft Office di semua PC terminal lini; risiko revisi file lama tertukar; SOP tercecer di folder-folder personal. | In-browser document viewer (PDF, Word, Excel, Gambar) tanpa lisensi Office lokal + link share publik berbatas waktu (*Secure Token Share*). | Standarisasi SOP di lini produksi; **nol lisensi** software pembaca tambahan untuk terminal line. |
| **Utilitas Gambar/PDF**| Ketergantungan pada website kompresi online (kebocoran rahasia dokumen dan foto prototipe SEIN ke server luar). | Utilitas *offline & self-hosted*: Local U2Net AI background removal, Python PDF stream compressor, VAAPI video compressor — semua berjalan di server internal. | Keamanan data prototipe **100% internal**; bebas biaya langganan software pihak ketiga. |
| **Akses & Keamanan** | Satu akun bersama atau tanpa kontrol hak akses; siapa saja bisa mengubah data sensitif. | Granular RBAC (Admin, Manager, Member, Guest) dengan dynamic menu permission per role, per department, per individu user (whitelist/blacklist). | Audit trail setiap aksi; mencegah perubahan data tidak sah oleh personel tidak berwenang. |
| **Kolaborasi Korea–Indonesia** | Ekspatriat Korea kesulitan menggunakan antarmuka berbahasa Indonesia; terminologi teknis berbeda. | Dukungan 3 bahasa instan: Bahasa Indonesia (ID), English (EN), 한국어 (KO) — tersedia di setiap halaman dan label. | Kolaborasi mulus lintas bahasa; mengurangi miskomunikasi teknis antara tim lokal dan ekspatriat. |

---

## 🌟 Katalog Fitur, Workflow & Benefit

---

### 1. New Model Development & Milestone Matrix

Sistem pelacakan siklus hidup pengenalan model baru (NPI) dari fase awal hingga produksi massal, dilengkapi matriks visual pemeriksaan kesiapan lini produksi (*gating checkpoints*).

```
   [Registrasi / Bulk Paste] ──► [Kategori: Flagship / Mass Prod / TNP] ──► [Milestone Gate Tracking]
              │                                                                      │
              ▼                                                                      ▼
   [Filter NPI / Mass Prod]  ◄─── [Audit Trail & Validation Photo] ◄─── [Export XLS / CSV]
```

#### Alur Kerja (Workflow):
1. **Registrasi Model Baru**:
   - Engineer membuka halaman **New Model** dari sidebar menu.
   - Klik **"Register New Model"** untuk membuka modal form.
   - Isi data: Nama Model (misal `S26 Ultra`), Codename (misal `Paradigm`), Target Release Date.
   - Pilih **Kategori Model** menggunakan switch button:
     - 👑 **Flagship / Premium** — Model unggulan dengan standar toleransi dan gating ketat (badge ikon *Crown*).
     - 📑 **Mass Product** — Model reguler bervolume tinggi (badge ikon *Layers*).
     - ⚡ **TNP (Trial New Product)** — Model uji coba atau varian terbatas (badge ikon *Zap*).
   - Kategori model ditampilkan sebagai **badge kecil** di bawah codename pada header kolom matriks dan di samping tombol edit pada kartu model.
   - Klik **Save** untuk menyimpan.

2. **Bulk Import (Import Massal dari Excel)**:
   - Klik tombol toggle **"Import"** (switch button antara Export/Import).
   - Salin (*copy*) tabel dari **Microsoft Excel** atau **Google Sheets** yang berisi kolom Model, Codename, tanggal milestone, dst.
   - *Paste* ke area input teks pada modal Bulk Import (format TSV/CSV otomatis dideteksi).
   - Atau upload file `.csv` langsung.
   - Sistem melakukan parsing otomatis, menampilkan preview data, lalu batch-create model baru atau upsert milestone ke model yang sudah ada.

3. **Pemeriksaan Milestone / Gate Checkpoint**:
   - Matriks visual menampilkan setiap model sebagai kolom dan setiap checkpoint sebagai baris:
     - *Gating Review* — Kelayakan desain untuk produksi.
     - *LQV (Line Quality Verification)* — Verifikasi kualitas output lini.
     - *Reliability Testing* — Pengujian daya tahan komponen/produk.
     - *Quality Check* — Pemeriksaan mutu akhir.
     - *SOP Release Target* — Tanggal target pelepasan SOP ke lini.
   - PIC mengklik cell matriks untuk mengisi tanggal aktual, mengunggah foto bukti pengujian, dan menulis catatan teknis (mendukung tabel Markdown).
   - Perubahan gate memerlukan **konfirmasi eksplisit** (tidak ada auto-advancement yang tidak disengaja).

4. **Filter & Monitoring**:
   - Tab **Active NPI**: Menampilkan hanya model yang masih dalam fase pengembangan aktif (Concept → EVT → DVT → PVT).
   - Tab **Released & Mass Prod**: Model yang sudah memasuki fase produksi massal.
   - Tab **All Models**: Seluruh model tanpa filter.
   - Setiap tab menampilkan **live counter** jumlah model.

5. **Export Data**:
   - Klik tombol toggle **"Export"** pada switch button Export/Import.
   - Pilih format:
     - **Excel (.xls)**: File XML Spreadsheet dengan *styling* berwarna — sel hijau untuk milestone tercapai, merah untuk terlambat, header bergridline, lebar kolom otomatis.
     - **CSV (.csv)**: Format RFC-4180 dengan UTF-8 BOM (`\uFEFF`) agar kompatibel langsung saat dibuka di Excel tanpa masalah encoding karakter Indonesia/Korea.
   - File otomatis diunduh ke folder Downloads browser.

6. **Riwayat & Audit**:
   - Setiap perubahan status gate tersimpan dengan **timestamp, nama author**, dan bukti foto.
   - Kolom komentar per model untuk diskusi teknis tim (*threaded comments* dengan emoji reaction).

#### Keuntungan (Benefit):
- **Visibilitas Instan**: Seluruh anggota tim — PE Part, PE Mecha, PE Solution — melihat posisi tahapan model yang sama tanpa bertukar file Excel.
- **Bulk Migration Cepat**: Memasukkan puluhan model dan tanggal milestone hanya dalam hitungan detik melalui *copy-paste* dari spreadsheet existing.
- **Data Integrity**: Audit trail mencatat siapa mengubah apa dan kapan, dilengkapi bukti fisik pengujian.
- **Klasifikasi Prioritas**: Badge kategori (Flagship/Mass/TNP) membantu manajemen fokus pada model kritis saat meeting review.

---

### 2. Innovation & Best Practice (BP) Management

Katalog digital pengelolaan ide inovasi (*kaizen*), modifikasi mesin/JIG, perbaikan proses produksi, dan efisiensi lini dengan perhitungan nilai penghematan (*cost saving*).

```
[Pengajuan Ide / Draft] ──► [Review Leader] ──► [Testing di Lini] ──► [Implemented]
                                                         ▲                    │
                                                [Kalkulasi ROI/Saving]        ▼
                                                                    [Replikasi Antar Line]
```

#### Alur Kerja (Workflow):
1. **Pendaftaran Ide**: Engineer membuka menu **Innovation** → klik **"New Innovation"** → mengisi:
   - Judul dan deskripsi inovasi/perbaikan.
   - Area line terkait dan Group Part penanggung jawab.
   - Klasifikasi tingkat (*Class 1 – Class 4*): Class 1 untuk inovasi tingkat pabrik, Class 4 untuk perbaikan minor station.
   - Estimasi penghematan biaya (dalam USD / IDR) dan estimasi penghematan waktu per unit (detik/unit).
   - Lampiran foto/video *Before vs After*.
2. **Review & Diskusi**: Leader dan rekan engineer memberikan voting dukungan (👍, 🔥, dst.) serta berdiskusi melalui kolom komentar bersambung (*threaded comments*).
3. **Trial & Validasi**: Ide beralih ke status *Testing* setelah diarahkan untuk diuji di lini perakitan. Melampirkan data hasil uji coba.
4. **Implementasi & Penghematan**: Setelah disetujui, status berubah ke *Implemented*. Sistem secara otomatis menghitung total kumulatif *cost saving* divisi pada Dashboard.
5. **Tracking Replikasi**: Sistem melacak apakah inovasi berhasil direplikasi ke line produksi lain. Engineer dapat menandai line mana saja yang sudah menerapkan inovasi tersebut.
6. **Arsip**: Inovasi yang sudah terevaluasi lengkap berpindah ke status *Archived* untuk referensi historis.

#### Keuntungan (Benefit):
- **Transparansi ROI Nyata**: Manajemen memiliki data angka konkret kontribusi efisiensi finansial SEIN PE Group secara kumulatif per kuartal dan tahunan.
- **Knowledge Sharing Lintas Shift**: Mencegah *reinventing the wheel* — teknisi shift malam dapat melihat solusi yang sudah ditemukan shift pagi.
- **Motivasi & Portofolio Engineer**: Setiap engineer memiliki portofolio inovasi terverifikasi untuk bahan evaluasi kinerja dan promosi.

---

### 3. Project Management & Interactive Calendar

Manajemen penugasan proyek perakitan JIG, pembuatan Unit BOX, pemeliharaan MRO, dan proyek perangkat lunak lini.

```
[Buat Proyek / Task] ──► [Assign PIC & Set Deadline] ──► [Calendar View / Gantt]
                                                                │
                                              [Update Milestone Checklist] ──► [Mark Finish]
```

#### Alur Kerja (Workflow):
1. **Inisiasi Proyek**: Buka menu **ToDo List** → **"New Project"** → tentukan judul, deskripsi, tipe proyek (*development, new_model, internal*), divisi PIC (PE Part, PE Mecha, PE Solution), tingkat prioritas (Low, Medium, High, Urgent), dan tanggal target penyelesaian.
2. **Breakdown Task**: Tambahkan checklist sub-task teknis (contoh: *Desain CAD*, *Machining CNC*, *Wiring Sensor*, *Perakitan Assembly*, *Buy-off QC*). Setiap task bisa di-assign ke engineer spesifik dengan *due date* masing-masing.
3. **Monitoring Visual**:
   - **Project Calendar**: Tampilan kalender bulanan interaktif yang memetakan semua proyek aktif dari seluruh divisi dalam satu layar.
   - **ToDo List**: Daftar prioritas dengan indikator warna status (*Planning, In Progress, Review, Completed, On Hold*) dan badge *overdue* untuk task yang melewati batas waktu.
4. **Progress & Penyelesaian**: PIC memperbarui status setiap sub-task. Saat semua checklist selesai, proyek ditandai 100% — otomatis masuk metrik produktivitas tim di Dashboard.

#### Keuntungan (Benefit):
- **Beban Kerja Transparan**: Leader melihat distribusi beban kerja tiap engineer secara objektif, mencegah penumpukan tugas pada satu orang.
- **Ketepatan Jadwal JIG**: Mencegah keterlambatan penyediaan peralatan menjelang *mass production trial* model baru.
- **Koordinasi Lintas Divisi**: PE Part, Mecha, dan Solution dapat melihat jadwal satu sama lain tanpa bertanya via chat.

---

### 4. Sample Management & Overseas DHL Tracker

Pencatatan sirkulasi unit sampel prototipe (Proto, EVT, DVT, PVT) yang masuk ke pabrik SEIN serta pemantauan pengiriman sampel dari kantor pusat R&D Samsung Korea (Suwon/Gumi).

```
[Paket Dikirim dari HQ Korea] ──► [Input AWB di DHL Tracker] ──► [Cek Status Real-time]
                                                                        │ (Sampel Tiba di SEIN)
                                                                        ▼
[Pengembalian / Scrap] ◄── [Checkout Peminjaman Teknisi] ◄── [Registrasi Unit di Database]
```

#### Alur Kerja (Workflow):
1. **Tracking Pengiriman Sampel**: PIC memasukkan nomor Air Waybill (AWB) ke modul **DHL Tracker**. Sistem menampilkan status pengiriman (In Transit, Customs, Out for Delivery, Delivered) beserta estimasi tiba.
2. **Notifikasi Delivered**: Saat status AWB berubah ke *Delivered*, sistem mengirim notifikasi otomatis ke PIC Sample.
3. **Registrasi Sampel Masuk**: Saat sampel tiba, unit didaftarkan ke **Database Sample PE** dengan data:
   - Nomor IMEI/Serial Number.
   - Nama model dan fase perakitan (Proto/EVT/DVT/PVT/MP).
   - Lokasi penyimpanan (rak/ruang/area).
   - Foto unit.
4. **Peminjaman & Pengembalian**: Teknisi melakukan *checkout* untuk meminjam unit guna pengujian di lini. Sistem mencatat durasi pinjam, nama peminjam, dan tujuan peminjaman.
5. **Scrap & Pengembalian ke HQ**: Unit yang sudah selesai dikembalikan atau discrap dicatat statusnya untuk laporan inventaris.

#### Keuntungan (Benefit):
- **Zero Missing Prototype**: Mencegah kehilangan atau salah letak unit prototipe rahasia yang memiliki nilai keamanan tinggi bagi Samsung.
- **Kepastian Estimasi Tiba**: Mengeliminasi kebutuhan membuka website tracking DHL/FedEx terpisah — estimasi tiba langsung terlihat di portal tim.
- **Audit Peminjaman**: Selalu terdokumentasi siapa yang memegang unit prototipe, di mana, dan sejak kapan.

---

### 5. Software Mass Release (MR) & GBA Task Management

Pengelolaan berkas biner firmware, program flashing lini, dan persetujuan build perangkat lunak pabrik.

```
[Build Firmware Siap] ──► [Daftarkan Software MR] ──► [Verifikasi Checksum & Model]
                                    │                              │
                                    ▼                              ▼
                    [Sync GBA Tasks (Build Approval)] ──► [Deploy ke Stasiun Flashing]
```

#### Alur Kerja (Workflow):
1. **Pendaftaran Rilis Software**: Engineer Solution mendaftarkan detail versi biner firmware terbaru ke sistem — nomor versi, model target, checksum integritas file, catatan perubahan (*release notes*), dan PIC penanggung jawab.
2. **Sinkronisasi GBA (Google Build Approval)**: Task build approval otomatis disinkronisasi dengan server GBA melalui koneksi MCP (*Model Context Protocol*) ke endpoint internal `http://107.102.39.55:3800/mcp`. Tugas GBA dari server kanban juga ditampilkan langsung di portal.
3. **Verifikasi & Persetujuan**: Tim engineering memverifikasi kelayakan firmware (checksum match, model compatibility, regression test result) sebelum menyetujui deployment ke stasiun *download/flashing* lini produksi.
4. **Riwayat Deployment**: Seluruh riwayat versi firmware yang pernah di-deploy tersimpan lengkap dengan timestamp dan approver untuk kebutuhan audit.

#### Keuntungan (Benefit):
- **Pencegahan Mass Defect**: Menghilangkan insiden kesalahan pemasangan versi firmware yang dapat memicu *mass defect* di lini.
- **Traceability Penuh**: Setiap versi biner memiliki riwayat siapa yang menyetujui dan kapan diterapkan.
- **Integrasi GBA**: Tidak perlu membuka aplikasi GBA terpisah; semua task terkonsolidasi di portal.

---

### 6. Digital Work Reports & Automated SMTP Dispatcher

Modul penyusunan laporan kerja berkala (harian/mingguan/bulanan) dengan editor modern yang terhubung langsung ke database portal, serta pengiriman email otomatis.

```
[Buka Report Editor] ──► [Tulis / Klik 'Scrape Data' (Auto-Insert)] ──► [Pilih Grup Kontak]
                                                                                │
                        [Laporan Terkirim ✓] ◄── [Set Jadwal Cron / Kirim Sekarang]
```

#### Alur Kerja (Workflow):
1. **Membuat Laporan Baru**: Buka menu **Reports** → klik **"Create New Report"** → editor blok kaya terbuka (*Notion-like block editor*) dengan dukungan formatting teks kaya, tabel, checklist, penyisipan gambar, dan judul hierarkis.
2. **Live Scraper (1-Click Data Insert)**: Klik tombol **"Scrape Data"** untuk otomatis menarik data terkini langsung dari database:
   - Status model NPI aktif dan pencapaian milestone terbaru.
   - Daftar proyek yang sedang berjalan dan persentase progres masing-masing.
   - Inovasi yang baru diimplementasikan beserta nilai *cost saving*.
   - Data langsung disisipkan ke badan laporan dalam format tabel rapi tanpa perlu ketik manual.
3. **Manajemen Penerima Email**:
   - **Email Chip Input**: Ketik alamat email satu per satu (tekan `Enter` atau `,` untuk menambahkan) atau *paste* banyak alamat email sekaligus (parser otomatis memisahkan per baris/koma).
   - Setiap chip memiliki tombol `✕` untuk menghapus dan mendukung navigasi keyboard (`Backspace` untuk hapus chip terakhir).
   - **Grup Kontak Kustom (Saved Lists)**: Simpan kombinasi penerima sebagai grup reusable (contoh: *"All Part Leader"*, *"Mecha Team"*, *"Solution Manager + PIC Model"*). Klik nama grup untuk langsung memasukkan semua alamat email anggota.
4. **Pengiriman**:
   - **Kirim Sekarang**: Laporan terkirim langsung via SMTP korporat Samsung (`smtp.samsung.net:25`).
   - **Jadwalkan Otomatis (Cron)**: Set jadwal pengiriman berkala — misal setiap Jumat jam 16:00. Sistem mengirim secara otomatis melalui background scheduler bahkan saat browser sudah ditutup.
5. **Template Email Responsif**: Email yang dikirim menggunakan layout tabel HTML fluid yang tampil sempurna di layar laptop maupun smartphone (skala hingga 960px dengan optimasi `@media`).
6. **Audit Log**: Setiap pengiriman tersimpan dalam log transmisi lengkap (tanggal, penerima, status pengiriman).

#### Keuntungan (Benefit):
- **Efisiensi Waktu Drastis**: Memangkas waktu pembuatan laporan dari **180 menit → 15 menit** karena data proyek ditarik otomatis.
- **Konsistensi Format**: Seluruh divisi menggunakan template yang sama, laporan rapi dan mudah dibandingkan.
- **Zero Missed Delivery**: Penjadwalan otomatis menghilangkan risiko lupa mengirim laporan berkala.

---

### 7. Engineering Document Archive & In-Browser Viewer

Penyimpanan terpusat untuk dokumen teknis, gambar kerja CAD, *BOM (Bill of Materials)*, spesifikasi komponen, SOP, dan lembar instruksi kerja.

```
[Upload Dokumen] ──► [Indexing & Metadata & Tag] ──► [In-Browser Safe Preview]
                                                              │
                    [Akses Langsung di Terminal Lini] ◄── [Generate Token Share Publik]
```

#### Alur Kerja (Workflow):
1. **Pengunggahan Terpusat**: Engineer mengunggah dokumen dengan mengisi metadata:
   - Judul, kategori (SOP, BOM, Schematic, Test Report, Specification, Drawing, dll.).
   - Tag pencarian (misal: `S26`, `DVT`, `main-board`, `RF-calibration`).
   - Asosiasi ke model dan/atau proyek terkait.
   - Divisi pemilik (PE Part, PE Mecha, PE Solution).
   - Nomor versi revisi.
2. **Pratinjau In-Browser**: Semua format dokumen — **PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), dan Gambar** — langsung dibuka di dalam browser tanpa perlu aplikasi luar. Tidak butuh lisensi Microsoft Office di komputer terminal manapun.
3. **Pencarian & Filtering**: Cari dokumen berdasarkan judul, tag, kategori, model, atau divisi. Hasil pencarian menampilkan preview thumbnail dan metadata ringkas.
4. **Link Share Publik Aman**: Admin atau engineer dapat men-generate **Secure Token Share Link** berbatas waktu. Link ini bisa diakses oleh teknisi di lini tanpa login ke portal — cukup buka URL di browser terminal line.
5. **Versioning**: Saat dokumen diperbarui, versi lama tetap tersimpan untuk referensi audit.

#### Keuntungan (Benefit):
- **Eliminasi Lisensi Office di Terminal**: Komputer di area lini produksi tidak memerlukan lisensi Microsoft Office, cukup browser.
- **Pemberantasan SOP Usang**: Menjamin semua orang selalu mengakses dokumen versi termutakhir dari server pusat.
- **Akses Cepat untuk Teknisi Lini**: Link share memungkinkan teknisi mengakses SOP terbaru tanpa perlu login dan memahami sistem portal.

---

### 8. IMEI Knowledge Base & Technical Runbooks

Basis pengetahuan khusus untuk stasiun kerja IMEI, pengujian fungsi perangkat (*Function Test*), kalibrasi RF, dan prosedur penanganan masalah (*troubleshooting*) di lini perakitan.

```
[Identifikasi Masalah di Line] ──► [Cari Berdasarkan Model / Kode Eror] ──► [Buka Runbook]
                                                                                    │
                                    [Solusi Diterapkan ke Stasiun] ◄── [Ikuti Langkah Solusi]
```

#### Alur Kerja (Workflow):
1. **Penulisan Runbook**: Engineer menulis panduan penanganan masalah stasiun (*Troubleshooting Runbook*) dalam format Markdown lengkap dengan:
   - Tangkapan layar stasiun/mesin yang bermasalah.
   - Langkah-langkah perbaikan bertahap (*step-by-step*).
   - Kode eror dan arti masing-masing.
   - Asosiasi ke model spesifik.
2. **Pin Artikel Penting**: Artikel yang sering direferensi dapat di-*pin* ke atas daftar agar langsung terlihat.
3. **Pencarian Cepat**: Saat terjadi kendala di lini perakitan, teknisi atau PIC IMEI mencari artikel menggunakan kata kunci model, pesan eror mesin, atau tag teknis.
4. **Pemeliharaan Konten**: PIC IMEI memperbarui artikel dengan informasi terbaru. Tanggal terakhir diperbarui ditampilkan untuk menjaga keakuratan.

#### Keuntungan (Benefit):
- **Reduksi Downtime Lini**: Mengurangi waktu henti mesin secara signifikan saat terjadi gangguan stasiun karena panduan solusi tersedia instan.
- **Standardisasi Solusi**: Solusi teknis terdokumentasi dan seragam di semua shift kerja tanpa bergantung pada kehadiran satu teknisi senior.
- **Onboarding Cepat**: Engineer baru dapat belajar menangani masalah umum melalui referensi runbook tanpa menunggu mentor.

---

### 9. GMES Monitoring & Issue Tracker

Pemantauan isu dan rekonsiliasi data operasional terkait sistem manufaktur global Samsung (Global Manufacturing Execution System — GMES).

#### Alur Kerja (Workflow):
1. **Pencatatan Insiden**: Engineer melaporkan anomali stasiun lini yang terdeteksi di GMES — contoh: *Station Barcode Mismatch, Carrier Lock, Conveyor Jam, Server Timeout, Firmware Flash Fail*.
2. **Root Cause Analysis (RCA)**: Menuliskan analisis akar masalah dan langkah reproduksi kejadian.
3. **Corrective & Preventive Action (CAPA)**: Mendokumentasikan tindakan perbaikan yang dilakukan dan langkah pencegahan untuk menghindari kejadian berulang.
4. **Trend Analysis**: Manajemen melihat tren insiden mingguan/bulanan untuk mengidentifikasi titik lemah di proses produksi.

#### Keuntungan (Benefit):
- **Pencatatan Sistematis**: Insiden tidak lagi hilang setelah shift berakhir — semua terdokumentasi untuk analisis tren jangka panjang.
- **Evaluasi Kualitas**: Data GMES monitoring mempermudah presentasi evaluasi kualitas bulanan di hadapan manajemen pabrik.

---

### 10. Online Training & Competency Skill Matrix

Pusat modul pembelajaran internal, sertifikasi SOP lini, dan matriks keahlian teknisi Production Engineering.

#### Alur Kerja (Workflow):
1. **Penyusunan Materi**: Admin atau leader membuat modul pelatihan teknis (SOP operasi stasiun, prosedur keselamatan, kalibrasi alat ukur).
2. **Pencatatan Absensi & Hasil**: Sistem mencatat kehadiran pelatihan per engineer, hasil evaluasi pemahaman, dan status sertifikasi.
3. **Radar Kompetensi**: Matriks visual menampilkan kompetensi setiap engineer untuk setiap area keahlian (*skill radar chart*).
4. **Persiapan Model Baru**: Saat model baru memasuki fase trial, leader dapat memverifikasi bahwa personel yang ditugaskan sudah tersertifikasi pada station terkait.

#### Keuntungan (Benefit):
- **Kepastian Kompetensi**: Hanya personel tersertifikasi yang ditugaskan menangani stasiun kritis pada peluncuran model flagship baru.
- **Tracking Historis**: Riwayat pelatihan setiap engineer tersimpan lengkap untuk kebutuhan audit sertifikasi ISO dan manajemen mutu.

---

### 11. Engineering Utility Suite & Self-Hosted AI Tools

Paket peralatan utilitas mandiri (*zero external dependency*) yang berjalan 100% di server internal SEIN untuk kebutuhan operasional harian engineer:

| Alat Utilitas | Fungsi Teknis Utama | Keuntungan & Keamanan |
| :--- | :--- | :--- |
| 🗜️ **Document PDF Compressor** | Kompresi berkas PDF berukuran besar menggunakan engine kompresi stream **Python** lokal. | Mengurangi ukuran file hingga 70%; aman karena tidak ada upload ke server pihak ketiga. |
| 📑 **PDF Merge & Split** | Menggabungkan beberapa dokumen menjadi satu file, atau memisahkan halaman spesifik dari PDF tebal. | Menata laporan teknis tanpa aplikasi desktop berbayar (Adobe Acrobat, Nitro PDF, dll). |
| 🖼️ **Image Converter & Compressor** | Konversi format gambar (PNG ↔ JPG ↔ WebP) dan kompresi ukuran file gambar tanpa kehilangan kualitas visual. | Gambar foto komponen lebih ringan untuk disisipkan ke laporan dan email. |
| ✂️ **Local Remove Background** | Penghapusan latar belakang foto secara otomatis menggunakan model AI **U2Net ONNX** yang berjalan 100% lokal di server internal. | Foto JIG/perangkat bersih tanpa background untuk dokumen SOP; gambar prototipe rahasia **tidak pernah keluar ke cloud publik** (remove.bg, canva, dll). |
| 🎬 **VAAPI Video Compressor** | Kompresi video rekaman lini produksi menggunakan akselerasi perangkat keras GPU (VA-API) server. | Video dokumentasi gerak mesin lebih ringan untuk diunggah, dibagikan, dan disimpan. |
| 💻 **CL Compare** | Perbandingan baris kode perubahan changelist perangkat lunak (*diff viewer*). | Mempercepat proses code review dan verifikasi rilis firmware oleh teknisi software. |
| 🔧 **Build Command Generator** | Generator perintah build otomatis untuk kompilasi firmware lini. | Standarisasi perintah build antar engineer; mengurangi kesalahan parameter kompilasi manual. |

#### Keuntungan Menyeluruh:
- **Keamanan Data Absolute**: Seluruh proses pengolahan gambar, video, dan dokumen berjalan di infrastruktur internal SEIN — nol data bocor ke internet.
- **Biaya Nol Tambahan**: Menghilangkan kebutuhan langganan software pihak ketiga (Adobe, remove.bg, iLovePDF, dll).
- **Ketersediaan 24/7**: Tidak tergantung koneksi internet; semua tool tersedia selama server portal menyala.

---

### 12. AI Engineering Assistant & PPTX Summarizer

Asisten kecerdasan buatan terintegrasi untuk membantu pekerjaan teknis harian engineer dan meringkas materi presentasi secara otomatis.

#### Komponen:
1. **Interactive AI Chat (Floating Widget)**:
   - Floating chat widget di pojok bawah yang terhubung ke endpoint LLM (Large Language Model) internal — mendukung **LM Studio** (self-hosted), **Ollama**, dan provider eksternal (OpenAI, Gemini, Claude).
   - Bisa digunakan untuk: tanya jawab teknis, bantuan penulisan laporan, formatting data, troubleshooting kode, dan diskusi prosedur.
   - Full-screen chat page juga tersedia di route `/chat`.
   - Mendukung sesi percakapan tersimpan (*chat sessions*) per user.
2. **Personal LLM Key Override**: Setiap engineer dapat mengonfigurasi provider LLM dan API key pribadi melalui halaman **Profile** tanpa mengubah konfigurasi global sistem.
3. **PPTX Technical Report Summarizer**: Upload file presentasi PowerPoint (.pptx) dan sistem akan membaca setiap slide, mengekstrak poin penting, dan menghasilkan ringkasan teknis dalam hitungan detik — ideal untuk mempersiapkan meeting review.
4. **Custom MCP Client**: Mendukung koneksi langsung ke external MCP servers seperti server GBA Task (`http://107.102.39.55:3800/mcp`).

#### Keuntungan (Benefit):
- **Referensi Instan**: Engineer mendapatkan jawaban teknis langsung tanpa mencari di Google atau forum.
- **Tanpa Batas Kuota**: Server LLM internal (LM Studio/Ollama) tidak memiliki pembatasan penggunaan.
- **Ringkasan Presentasi Otomatis**: Menghemat waktu membaca dokumen presentasi tebal sebelum meeting.

---

### 13. Virtual Office & Team Directory

Representasi digital tata letak ruang kantor PE (*digital twin layout*) beserta direktori keahlian seluruh anggota tim.

#### Fitur Detail:
- **Denah Kantor Interaktif (Canvas 2D)**: Tampilan visual posisi meja kerja setiap engineer di kantor PE Group — dikelompokkan berdasarkan divisi (PE Part Manager, PE Mecha, PE Solution, dll).
- **Status Kehadiran**: Indikator real-time apakah engineer sedang *In Office*, *Support Line*, *WFH*, atau *Off Duty*.
- **Informasi Kontak Cepat**: Klik meja untuk melihat nama lengkap, employee ID, email, nomor ekstensi, dan Group Part engineer.
- **Pencarian Tim**: Filter daftar engineer berdasarkan nama, divisi, atau keahlian.

#### Keuntungan (Benefit):
- **Koordinasi Lapangan Cepat**: Saat teknisi lini memerlukan bantuan engineer mekanik atau software, bisa langsung mengecek siapa yang tersedia di kantor dan menghubungi ekstensinya.
- **Orientasi Engineer Baru**: Engineer yang baru bergabung langsung dapat mengenali posisi meja dan nama rekan kerja di divisinya.

---

### 14. Role-Based Access Control & Dynamic Menu Security

Sistem keamanan berlapis dengan pengaturan visibilitas menu hingga sub-menu bertingkat (*multilevel granular menu control*).

```
[Request Halaman / Menu] ──► [Cek Master On/Off] ──► [Cek Blacklist User]
                                                            │
[Tampilkan Menu] ◄── [Cek Group/Part ID] ◄── [Cek Role] ◄── [Cek Whitelist User]
```

#### Tingkatan Hak Akses:
| Role | Wewenang | Contoh Pengguna |
| :--- | :--- | :--- |
| 👑 **Admin** | Kontrol penuh: manajemen akun, konfigurasi LDAP/SMTP, audit log, konfigurasi hak akses tiap menu, dan semua operasi data. | IT Administrator, Lead Software Development |
| 🛠️ **Manager** | Akses operasional tinggi untuk mengelola proyek, menyetujui inovasi, dan meninjau laporan divisi. | Part Leader, Section Chief |
| 👤 **Member** | Akses input dan edit data pada area yang dialokasikan: proyek, model, inovasi, laporan, dokumen, dan utilitas. | Production Engineer, Mechanical Engineer |
| 👁️ **Guest** | Akses baca (*read-only*); semua aksi tulis (create, edit, delete) diblokir dan menampilkan modal peringatan otomatis. | Pengunjung, auditor sementara, atau akses tanpa login |

#### Mekanisme Keamanan Menu:
1. **Master Enable/Disable Toggle**: Admin dapat menonaktifkan menu secara global (berlaku untuk semua user non-admin).
2. **Role-Based Filter**: Menu hanya tampil untuk role tertentu (misal: menu *Admin* hanya untuk role `admin`).
3. **Group/Part Filter**: Menu hanya tampil untuk engineer di Group Part tertentu (misal: menu *Software MR* hanya untuk `pe_solution`).
4. **Whitelist User**: Jika diset, hanya user spesifik (berdasarkan username, employee_id, atau email) yang bisa mengakses menu.
5. **Blacklist User**: Memblokir user spesifik dari mengakses menu tertentu, meskipun role dan group-nya memenuhi syarat.
6. **Dual Authentication**: Mendukung login **lokal** (password bcrypt di database) dan **ADCorp LDAP** (Active Directory Samsung) tanpa perlu mengubah kode — cukup switch variabel `AUTH_PROVIDER`.

---

### 15. Multi-Language & Canvas 60 FPS Personalization

Dukungan pengalaman pengguna yang dirancang nyaman digunakan oleh teknisi lokal Indonesia maupun ekspatriat Korea.

#### Multi-Language:
- **3 Bahasa Instan**: Tombol switch segmented `🌐 [ EN | ID | KO ]` di TopBar — klik untuk langsung beralih bahasa tanpa reload halaman.
- **Cakupan Penuh**: Semua label sidebar, form, modal, placeholder, pesan error, badge, dan notifikasi tersedia dalam **Bahasa Indonesia (ID)**, **English (EN)**, dan **한국어 (KO)**.

#### Tema Visual Dinamis:
- **HTML5 Canvas 2D Engine**: Animasi latar belakang halus 60 FPS tanpa membebani GPU — menggunakan native Canvas 2D, tanpa library WebGL/Three.js/Particles berat.
- **7 Tema Preset**:
  - 🌸 **Sakura Mochi (Cute)**: Kelopak bunga sakura melayang dengan rotasi 3D dan gelembung pastel lembut.
  - ⚡ **Neon Emerald (Cyberpunk)**: Aliran data digital gaya Matrix dan garis neon hijau horizon.
  - 🌌 **Galactic Cobalt**: Lapangan bintang berkelap-kelip dengan kilau berlian dan nebula kosmis.
  - 🌅 **Sunset Amber**: Percikan bara api keemasan yang hangat.
  - 🔮 **Cyber Lavender**: Bintang kristal berlian violet berputar dan aura kosmik.
  - 🏢 **SEIN Corporate Teal**: Node geometris teknik dengan tautan proximity dinamis.
  - 🎨 **Personal Custom Scheme**: Color picker HTML5 hex (`#rrggbb`) dengan auto-generate tint untuk setiap komponen UI.
- **Tactile Sand Grain Filter**: Efek tekstur mikro elegan yang menciptakan kedalaman permukaan premium saat mode gelap aktif.
- **Kontrol Instan**: Toggle satu klik di TopBar (ikon 🎨) atau melalui halaman Profile settings.

---

### 16. Windows Desktop Tray Manager (Tauri v2 + Rust)

Aplikasi desktop native Windows berbobot sangat ringan (< 15 MB) untuk pengoperasian server lokal tanpa jendela konsol hitam CMD.

#### Fitur Tray Manager:
- **Zero Terminal Clutter**: Backend Go berjalan sebagai proses background tanpa memunculkan jendela CMD (`CREATE_NO_WINDOW` via WinAPI).
- **Quick Controls**: Tombol 1-klik untuk **Start**, **Stop**, **Restart** backend service, dan **Open Portal** di browser default.
- **Live Log Viewer**: Panel log real-time menampilkan transaksi backend untuk diagnostik tanpa perlu buka terminal.
- **Cryptographic Auto-Updater**: Pembaruan sistem otomatis 1-klik berbasis signature **Minisign** langsung dari GitHub Releases. Pengguna cukup klik "Update" dan versi terbaru terinstall tanpa uninstall-reinstall.
- **Installer Siap Pakai**:
  - `.exe` (NSIS installer): Silent/seamless installer untuk instalasi mudah.
  - `.msi` (WiX package): Enterprise MSI package untuk deployment via Group Policy.

---

### 17. ECN Monitoring & AI Insight

Sistem pencatatan, pelacakan, dan analisis **Engineering Change Notice (ECN)** untuk seluruh perubahan desain komponen, BOM, dan proses produksi di lini perakitan SEIN. Dilengkapi AI chatbot khusus untuk analisis data ECN secara interaktif.

```
[Excel DRM Bypass: Paste Table]──►[Preview & Validasi]──►[Bulk Import ke Database]
         ▲                                                         │
         │ (File NASCA Terproteksi)                                 ▼
[Upload Excel (.xlsx)]──────────────────────────►[Python Parser]──►[DB PostgreSQL]
         ▲                                                         │
[Manual Entry (Wide Form)]──────────────────────────────────────────┘
                                                                   │
[AI Chat Accordion]◄── [Analisis Tren / Cari Pola / Ringkasan] ◄──┘
```

#### Alur Kerja (Workflow):

1. **Tiga Jalur Input Data**:

   - **Paste Table (Bypass Samsung NASCA DRM)**:
     - Buka file ECN Excel yang diproteksi DRM NASCA di Microsoft Excel.
     - Seleksi seluruh tabel data (termasuk header), tekan `Ctrl+C`.
     - Di ECN Monitoring page, klik tombol **"Paste Table"** → *paste* (`Ctrl+V`) ke area teks.
     - Parser frontend mendeteksi format TSV/CSV secara otomatis, menampilkan preview tabel lengkap.
     - Klik **"Import [n] Records"** untuk menyimpan seluruh baris ke database sekaligus.
     - **Mengapa Paste Table?** File ECN Samsung menggunakan DRM NASCA (`<## NASCA DRM FILE - VER1.00 ##>`) yang mengenkripsi container Excel. Membuka programatis file tersebut dari server tidak memungkinkan tanpa agent DRM Samsung terinstall. Metode Paste Table mem-bypass enkripsi karena data sudah didekripsi oleh Excel client di PC pengguna.

   - **Upload File Excel (.xlsx)**:
     - Klik tombol **"Upload Excel"** → pilih file `.xlsx` dari dialog.
     - Backend mengirim file ke Python parser (`ecn_parser.py`) yang membaca konten via `openpyxl`.
     - Parser melakukan DRM detection terlebih dahulu — jika terdeteksi signature NASCA/Fasoo/SoftCamp/Samsung DRM, parser mengembalikan pesan peringatan dan menyarankan menggunakan **Paste Table**.
     - Jika file bersih, parser menormalisasi header kolom secara cerdas (fuzzy matching: `"ECN No"`, `"ecnno"`, `"ECN_NO"` semuanya dipetakan ke `ecn_no`), lalu mengembalikan data terstruktur JSON.
     - Frontend menampilkan preview hasil parsing. Klik konfirmasi untuk bulk import.

   - **Manual Entry (Wide Form Modal)**:
     - Klik tombol **"+"** → modal form terbuka dalam layout horizontal 4 kolom (`maxWidth: min(1240px, 96vw)`).
     - Form dikelompokkan dalam section: **Identifikasi ECN**, **Detail Komponen**, **Jadwal & Status**.
     - Field mencakup: ECN No, Model, Function (Circuit/Mechanical/Software/dll), Process (SMD/MI/FA/ASSY/dll), EC Title, Parent Code, Parent Name, Before/After, D/L, Child Code, Child Name, Specification, Quantity, Marking Point, Running Date BOM, Distribution Date, Status, dan Remark.
     - **Perlindungan Data Tidak Sengaja Hilang**: Modal tidak bisa ditutup dengan klik overlay atau tombol Escape (`closeOnOverlayClick={false}`, `closeOnEsc={false}`). Saat user menekan tombol `✕`, jika form sudah terisi sebagian, sistem menampilkan **dialog konfirmasi peringatan** (*"Data belum disimpan. Yakin ingin menutup?"*) sebelum benar-benar menutup modal.

2. **Tabel Data Interaktif (12 Kolom)**:
   - Menampilkan seluruh record ECN dalam tabel dengan kolom: ECN No, Model, Function, Process, EC Title, Child Code, Child Name, Specification, Qty, Running Date, Dist. Date, Status.
   - **Sorting Multi-Kolom**: Klik header kolom untuk mengurutkan ascending/descending. Ikon panah (`↑`/`↓`) menunjukkan kolom dan arah sort aktif.
   - **Individual Column Search (Per-Kolom Filter)**: Setiap header kolom memiliki input pencarian kecil di bawahnya. Ketik untuk memfilter data secara real-time pada kolom spesifik. Mendukung filter simultan di beberapa kolom sekaligus (contoh: filter `Model = S26` DAN `Process = SMD` DAN `Status = Completed`).
   - **Reset Filter 1-Klik**: Tombol reset (ikon ↺) untuk menghapus seluruh filter kolom sekaligus.
   - **Expandable Row**: Klik baris untuk melihat detail lengkap field tambahan (Parent Code, Parent Name, Before/After, D/L, Marking Point, Purpose, Inventory Mgmt, Remark) dalam panel ekspansi.

3. **Dashboard Statistik**:
   - Card overview di atas tabel menampilkan metrik real-time:
     - **Total Records**: Jumlah seluruh entri ECN.
     - **Completed**: ECN yang sudah selesai diimplementasikan.
     - **In Progress**: ECN dalam proses penerapan.
     - **Pending**: ECN yang belum dimulai.
     - **ECO Cancel**: ECN yang dibatalkan.
     - **Unique Models**: Jumlah model unik yang terpengaruh perubahan ECN.

4. **SEIN ECN AI Chat Assistant (Accordion)**:
   - Panel chatbot AI ditempatkan **di atas tabel** sebagai accordion (buka/tutup 1-klik).
   - Terhubung ke LLM endpoint yang dikonfigurasi di portal (LM Studio / Ollama / OpenAI / Gemini).
   - **Quick Suggestion Chips**: Klik chip pertanyaan preset untuk langsung bertanya ke AI (contoh: *"Rangkum semua ECN model S26"*, *"ECN mana yang masih pending lebih dari 2 minggu?"*).
   - **Rich Markdown Response**: Jawaban AI dirender dengan formatting lengkap — **bold**, *italic*, tabel Markdown, blockquote, code block, dan ordered/unordered list.
   - **Copy TSV**: Tombol salin untuk mengekstrak data tabel dari respons AI dalam format TSV (bisa langsung di-paste ke Excel).
   - AI secara otomatis menerima konteks data ECN terkini dari database sehingga mampu menganalisis tren, mengidentifikasi bottleneck, dan memberikan rekomendasi berbasis data aktual.

5. **Aksi Per-Record**:
   - **Edit**: Membuka modal form yang sama dengan data terisi untuk memperbarui record.
   - **Delete**: Hapus record dengan konfirmasi dialog (hanya Admin dan Manager).

#### Arsitektur Teknis:

| Komponen | Teknologi | Detail |
| :--- | :--- | :--- |
| **Frontend** | React 19, CSS Modules | `EcnMonitoringPage.jsx` + `EcnMonitoringPage.module.css`, design tokens, dark mode support |
| **Backend API** | Go 1.22+, Gin | 7 endpoint REST: `GET /ecn`, `GET /ecn/stats`, `POST /ecn`, `PUT /ecn/:id`, `DELETE /ecn/:id`, `POST /ecn/bulk`, `POST /ecn/parse-excel` |
| **Excel Parser** | Python 3, openpyxl | `backend/scripts/ecn_parser.py` — DRM detection (NASCA/Fasoo/SoftCamp/Samsung), fuzzy header normalization, JSON output |
| **Database** | PostgreSQL 16 | Tabel `ecn_records` (20 kolom), 6 index performa, migrasi `029_ecn_monitoring.sql` |
| **AI Chat** | LLM Client (multi-provider) | Accordion panel dengan `RichMessageContent` renderer, mendukung Markdown penuh |

#### REST API Endpoints:

| Method | Endpoint | Deskripsi |
| :--- | :--- | :--- |
| `GET` | `/api/v1/ecn` | List semua ECN records (paginasi, search, filter model/status/process/function) |
| `GET` | `/api/v1/ecn/stats` | Statistik agregat: total, completed, pending, in_progress, eco_cancel, unique models |
| `POST` | `/api/v1/ecn` | Buat satu ECN record baru (manual entry) |
| `PUT` | `/api/v1/ecn/:id` | Update ECN record berdasarkan UUID |
| `DELETE` | `/api/v1/ecn/:id` | Hapus ECN record (Admin/Manager only) |
| `POST` | `/api/v1/ecn/bulk` | Bulk import array ECN records (dari Paste Table) |
| `POST` | `/api/v1/ecn/parse-excel` | Upload file Excel → Python parser → return parsed JSON |

#### Keuntungan (Benefit):
- **Bypass DRM Tanpa Tool Tambahan**: Metode Paste Table memungkinkan impor data dari file Excel terproteksi Samsung NASCA DRM tanpa perlu menginstal tool dekripsi khusus di server — cukup copy-paste dari Excel client.
- **Zero Data Loss Entry**: Modal form dilindungi dari penutupan tidak sengaja (*overlay click* dan *Escape* dinonaktifkan) dengan dialog konfirmasi peringatan.
- **Pencarian Presisi Tinggi**: Filter per-kolom memungkinkan engineer menemukan ECN spesifik di antara ribuan record dalam hitungan detik (contoh: cari semua ECN dengan `Child Code = XYZ` dan `Status = Pending`).
- **AI-Driven Insight**: Chat AI menganalisis data ECN aktual untuk mengidentifikasi tren, bottleneck, dan memberikan rekomendasi — mengurangi waktu analisis manual dari jam menjadi detik.

---

## 📖 Tutorial Penggunaan Lengkap

---

### Login dengan Akun ADCorp (LDAP Active Directory)

PE-Portal mendukung otentikasi langsung menggunakan akun **ADCorp Samsung** (Active Directory corporate) sehingga engineer tidak perlu membuat akun terpisah.

#### Langkah-langkah:
1. Buka browser dan akses PE-Portal di `http://localhost:3025` (atau alamat server yang dikonfigurasi).
2. Di halaman login, masukkan:
   - **Username**: Gunakan `sAMAccountName` ADCorp Anda — biasanya format **nama.belakang** (contoh: `endri.s`, `kim.js`, `park.mh`).
   - **Password**: Gunakan password ADCorp yang sama dengan yang digunakan untuk login ke komputer kerja Samsung.
3. Klik tombol **"Sign In"**.
4. Jika ini **pertama kali login**, sistem secara otomatis melakukan **JIT Provisioning (Just-In-Time Registration)**:
   - Akun otomatis dibuat di database lokal portal.
   - Nama lengkap diambil dari atribut LDAP `cn` atau `displayName`.
   - Email diambil dari atribut `mail` atau `userPrincipalName`. Jika tidak ditemukan, sistem menghasilkan format `username@samsungelectronics.net`.
   - Employee ID diambil dari atribut `employeeID` atau `employeeNumber`.
   - Role default: **Member** (dapat diubah oleh Admin ke Manager atau Admin).
5. Login berikutnya: Cukup masukkan username dan password ADCorp — tidak perlu registrasi ulang.

#### Catatan Teknis:
- Akun lokal **admin** selalu bisa login bahkan saat mode LDAP aktif (fallback lokal).
- Jika LDAP server tidak tersedia (misal maintenance AD), login akan gagal untuk user LDAP — admin lokal tetap bisa masuk.
- Saat user LDAP yang pernah di-*deactivate* login kembali, akunnya otomatis di-*reactivate*.

---

### Login dengan Akun Lokal

Untuk user yang tidak memiliki akun ADCorp (misal akun service, tester, atau saat LDAP belum dikonfigurasi):

1. Buka halaman login di `http://localhost:3025`.
2. Masukkan **username** dan **password** akun lokal yang sudah terdaftar di database.
3. Klik **"Sign In"**.

#### Akun Default yang Tersedia:
| Role | Username | Password | Wewenang |
| :--- | :--- | :--- | :--- |
| Admin | `admin` | `admin123` | Akses penuh semua fitur dan konfigurasi |

> **Penting**: Segera ubah password default melalui menu **Profile** setelah login pertama kali.

---

### Mode Guest (Pengunjung — View Only)

PE-Portal menyediakan akses tanpa login untuk kebutuhan meninjau informasi secara cepat:

1. Di halaman login, klik tombol **"Masuk sebagai Guest (View Only)"** di bawah form login.
2. Anda akan masuk ke portal dengan hak akses baca (*read-only*).
3. Saat mencoba melakukan aksi tulis (create, edit, delete), sistem akan menampilkan **modal peringatan otomatis** yang menginformasikan bahwa Anda perlu login untuk melanjutkan.
4. Modal peringatan menampilkan perbandingan fitur Guest vs Full Access dan tombol **"Login Sekarang"** untuk langsung beralih ke halaman login.

#### Kapan Gunakan Mode Guest:
- Saat Leader atau Manager ingin meninjau status model/proyek secara cepat di komputer ruang meeting tanpa login.
- Saat auditor atau pihak eksternal perlu melihat data tanpa diberikan kredensial.

---

### Mengatur Bahasa Antarmuka

1. Temukan tombol switch bahasa `🌐 [ EN | ID | KO ]` di **TopBar** (bagian atas layar, sebelah kanan).
2. Klik segmen bahasa yang diinginkan:
   - **EN**: English
   - **ID**: Bahasa Indonesia
   - **KO**: 한국어 (Korea)
3. Perubahan langsung berlaku tanpa reload halaman — seluruh label, placeholder, pesan, dan menu otomatis berubah.

---

### Menggunakan New Model Milestone Matrix

1. Buka menu **New Model** dari sidebar (ikon Cpu).
2. **Melihat Matriks**: Tabel matriks model × checkpoint langsung terlihat. Gunakan tab di atas tabel untuk memfilter:
   - *Active NPI*: Model masih dalam pengembangan.
   - *Released & Mass Prod*: Model sudah produksi massal.
   - *All Models*: Semua model.
3. **Menambah Model Baru**: Klik **"Register New Model"** → isi data di modal form → pilih kategori (Flagship/Mass Product/TNP) → **Save**.
4. **Bulk Import**: Klik switch button ke mode **Import** → *copy-paste* tabel dari Excel (kolom harus sesuai urutan) atau upload file CSV → klik **"Import"** → sistem batch-create model dan milestone.
5. **Edit Model**: Klik ikon pensil (✏️) di kartu model untuk membuka modal edit. Di sini Anda bisa mengubah nama, codename, kategori, dan data lainnya.
6. **Mengisi Milestone**: Klik cell checkpoint di matriks → isi tanggal aktual, catatan, dan lampiran foto → **Save**.
7. **Export**: Klik switch button ke mode **Export** → pilih format **Excel (.xls)** atau **CSV (.csv)** → file otomatis terunduh.

---

### Membuat & Mengirim Laporan Kerja Otomatis

1. Buka menu **Reports** dari sidebar.
2. Klik **"Create New Report"** → editor terbuka.
3. Tulis judul dan isi laporan menggunakan toolbar formatting (bold, italic, heading, tabel, gambar).
4. **Sisipkan Data Otomatis**: Klik ikon **"Scrape"** → pilih jenis data yang ingin disisipkan (status NPI, progress proyek, inovasi terbaru) → data langsung muncul sebagai tabel di badan laporan.
5. **Tambahkan Penerima**:
   - Ketik alamat email di kolom penerima → tekan `Enter` untuk menambahkan sebagai chip.
   - Atau klik **grup kontak tersimpan** (misal "All Part Leader") untuk otomatis memasukkan semua email anggota grup.
6. **Kirim atau Jadwalkan**:
   - **"Send Now"**: Kirim langsung via SMTP.
   - **"Schedule"**: Pilih jadwal cron (misal: setiap Jumat jam 16:00) → sistem mengirim otomatis di background.

---

### Mengunggah Dokumen & Membuat Link Share Publik

1. Buka menu **Documents** dari sidebar.
2. Klik **"Upload Document"** → pilih file dari komputer.
3. Isi metadata: judul, kategori, tag pencarian, model terkait.
4. Klik **"Upload"** → file tersimpan di server.
5. **Preview**: Klik dokumen di daftar untuk membuka preview langsung di browser.
6. **Share Publik**: Klik ikon share (🔗) pada dokumen → sistem menghasilkan URL berbatas waktu → salin URL dan kirim ke teknisi line.

---

### Menggunakan Utilitas Engineering (Tools)

1. Buka menu **Tools** dari sidebar → pilih sub-kategori:
   - **Dokumen**: PDF Compress, PDF Merge & Split, PPTX Auto Summary.
   - **Media**: Image Converter & Compress, Local Remove Background (AI U2Net), Video Compressor (VAAPI).
   - **Software Dev**: CL Compare, Build Command Generator.
2. Setiap tool memiliki area **drag-and-drop** atau tombol **"Choose File"** untuk mengunggah file.
3. Klik tombol proses → tunggu hasil → unduh file hasil.

#### Contoh: Remove Background Foto JIG
1. Buka **Tools → Media → Local Remove Background**.
2. Upload foto JIG yang memiliki latar belakang meja kerja yang berantakan.
3. Klik **"Remove Background"** → AI U2Net memproses foto di server internal.
4. Hasil foto berlatar transparan (PNG) siap diunduh untuk dimasukkan ke dokumen SOP.

---

### Mengelola Hak Akses Menu (Admin Only)

1. Login sebagai **Admin** → buka menu **Admin** dari sidebar.
2. Masuk ke tab **Menu Permissions**.
3. Daftar semua menu sidebar tertampil. Untuk setiap menu, Admin dapat mengatur:
   - **Visible/Hidden Toggle**: Aktifkan atau nonaktifkan menu untuk semua user.
   - **Allowed Roles**: Centang role mana saja yang boleh melihat menu (Admin / Manager / Member / Guest).
   - **Allowed Groups**: Pilih Group Part mana saja yang boleh akses (PE Part, PE Mecha, PE Solution).
   - **Allowed Users (Whitelist)**: Masukkan username/email spesifik yang boleh akses (jika diset, hanya user ini yang bisa melihat menu).
   - **Blocked Users (Blacklist)**: Masukkan username/email spesifik yang diblokir dari menu.
4. Klik **"Save"** → perubahan langsung berlaku tanpa restart server.

---

### Konfigurasi LDAP ADCorp oleh Admin

Untuk mengaktifkan login menggunakan akun ADCorp Samsung, admin perlu mengkonfigurasi koneksi LDAP:

#### Metode 1: Via File `.env` (Rekomendasi untuk Deployment)
Edit file `.env` di root project:
```env
# Aktifkan LDAP sebagai provider autentikasi utama
AUTH_PROVIDER=ldap

# Konfigurasi koneksi ke Active Directory Samsung
LDAP_HOST=ad.corp.local
LDAP_PORT=389
LDAP_BASE_DN=dc=corp,dc=local
LDAP_BIND_DN=cn=svc_pe,ou=services,dc=corp,dc=local
LDAP_BIND_PASSWORD=your_service_account_password
```
Restart backend service setelah mengubah file `.env`.

#### Metode 2: Via UI Admin Settings
1. Login sebagai Admin → buka menu **Settings**.
2. Scroll ke bagian **Authentication Provider**.
3. Status provider saat ini ditampilkan (badge hijau: `local` atau `ldap`).
4. Konfigurasi LDAP juga dapat disimpan ke tabel `auth_config` di database melalui halaman Admin.

#### Alur Autentikasi LDAP:
```
[User Memasukkan Username + Password]
          │
          ▼
[1. Cek Akun Lokal Dulu (admin, dll)]
          │ ── Berhasil? ──► [Login Sukses ✓]
          │
          ▼ (Gagal di lokal)
[2. Koneksi ke AD Server (LDAP Bind)]
          │
          ▼
[3. Search User di LDAP (sAMAccountName)]
          │ ── Tidak Ditemukan? ──► [Login Gagal ✗]
          │
          ▼
[4. User Bind (Verifikasi Password AD)]
          │ ── Password Salah? ──► [Login Gagal ✗]
          │
          ▼
[5. Cek Akun Lokal Sudah Ada?]
          │ ── Ada ──► [Login Sukses ✓ (Update Last Login)]
          │
          ▼ (Belum Ada)
[6. JIT Auto-Provisioning (Buat Akun Baru Otomatis)]
          │
          ▼
[Login Sukses ✓ (Akun Baru Terdaftar)]
```

#### Field LDAP yang Diambil Otomatis:
| Atribut LDAP | Digunakan Sebagai | Fallback |
| :--- | :--- | :--- |
| `cn` / `displayName` | Nama Lengkap | Username |
| `mail` / `userPrincipalName` | Email | `username@samsungelectronics.net` |
| `employeeID` / `employeeNumber` | Employee ID | Username |
| `sAMAccountName` | Username login | — |

---

## 🎯 Panduan Acuan Slide Presentasi

Gunakan panduan berikut sebagai kerangka saat menyusun materi presentasi slide (PowerPoint / Keynote / Google Slides):

### Struktur 10 Slide Rekomendasi

```
┌─────────┬──────────────────────────────┬──────────────────────────────────────────────┐
│ Slide # │ Topik Slide                  │ Poin Kunci & Narasi Utama                    │
├─────────┼──────────────────────────────┼──────────────────────────────────────────────┤
│ Slide 1 │ Cover & Visi Platform        │ "Transformasi Digital Operasional PE SEIN"   │
│ Slide 2 │ Latar Belakang & Pain Points │ Fragmentasi Excel, Kebocoran Data, Manual    │
│ Slide 3 │ Nilai Tambah (Value Prop.)   │ Terpusat, Cepat, Aman, Self-Hosted           │
│ Slide 4 │ New Model Milestone Matrix   │ Matriks Visual, Bulk Import, Export Warna    │
│ Slide 5 │ Inovasi & ROI Pabrik         │ Pipeline Kaizen, Cost-Saving Kumulatif       │
│ Slide 6 │ Manajemen Tugas & Kalender   │ JIG, BOX, MRO Tracking & PIC Assignment     │
│ Slide 7 │ Otomasi Laporan & Email      │ Scraper Data 1-Click, Cron SMTP Background   │
│ Slide 8 │ Dokumen & Privasi AI         │ In-Browser Preview, Local U2Net, PDF Tools   │
│ Slide 9 │ Tata Kelola & Aksesibilitas  │ Granular RBAC, 3 Bahasa, ADCorp Login        │
│ Slide 10│ Dampak Nyata & Penutup       │ Penghematan Waktu & Zero Data Leak           │
└─────────┴──────────────────────────────┴──────────────────────────────────────────────┘
```

### Rekomendasi Konten Tiap Slide:

#### 🔹 Slide 1: Cover & Visi Platform
- **Headline**: *Transformasi Digital Operasional SEIN Production Engineering*
- **Sub-headline**: *Platform Terpadu Manajemen NPI, Inovasi, dan Efisiensi Operasional Pabrik*
- **Catatan Presenter**: Platform ini dibangun in-house oleh tim engineer SEIN PE Group khusus untuk kebutuhan lini perakitan smartphone di Cikarang. Bukan software generik — dirancang presisi untuk alur kerja PE Part, PE Mecha, dan PE Solution.

#### 🔹 Slide 2: Latar Belakang & Masalah Utama
- **Status Quo**: Ketergantungan pada puluhan file Excel yang terisolasi di laptop masing-masing personel.
- **Pain Point 1**: Status kesiapan checkpoint model baru (NPI) tidak sinkron antar PE Part, Mecha, dan Solution — harus bertanya satu per satu via chat.
- **Pain Point 2**: Laporan kerja manual di Outlook memakan waktu 2-3 jam per minggu per orang.
- **Pain Point 3**: Foto prototipe rahasia dikirim ke website kompresi gambar gratisan (remove.bg, iLovePDF) — risiko kebocoran ke pihak luar.
- **Pain Point 4**: Tidak ada mekanisme kontrol akses — siapa saja bisa mengubah file Excel SOP di folder shared.

#### 🔹 Slide 3: Nilai Tambah Platform
- **Terpusat**: Single source of truth untuk seluruh aktivitas engineering PE Group.
- **Cepat & Ringan**: Waktu buka halaman < 1 detik; konsumsi RAM server < 40 MB.
- **Aman**: 100% data dan model AI berjalan di infrastruktur internal pabrik (*on-premise*).
- **Kolaboratif**: Mendukung 3 bahasa (ID/EN/KO) dan login langsung menggunakan akun ADCorp Samsung.
- **Visual**: Angka: 15+ modul fitur, 24 versi migrasi database, 3 bahasa, 7 tema visual.

#### 🔹 Slide 4: New Model Milestone Matrix
- **Tampilan Visual**: Sertakan screenshot matriks model (Flagship 👑, Mass Product 📑, TNP ⚡).
- **Highlight Fitur**:
  - Filter fase aktif (*Active NPI* vs *Released & Mass Prod*) dengan live counter.
  - Bulk Import: Copy-paste dari Excel → langsung terdata dalam hitungan detik.
  - Export berformat warna: Excel (.xls) dengan sel hijau/merah dan CSV UTF-8.
  - Badge kategori model di header kolom.

#### 🔹 Slide 5: Inovasi & Penghematan Biaya
- **Key Metric**: Total kumulatif cost-saving divisi per kuartal/tahun.
- **Highlight Fitur**:
  - Pipeline berjenjang: Draft → Review → Testing → Implemented → Replicated.
  - Kalkulasi otomatis ROI per ide.
  - Klasifikasi Class 1-4 untuk ranking nilai inovasi.
  - Tracking replikasi antar line produksi.

#### 🔹 Slide 6: Proyek & Monitoring Jadwal
- **Highlight Fitur**:
  - Interactive Project Calendar: visualisasi jadwal lintas divisi dalam satu layar.
  - Checklist milestone per proyek JIG/BOX/MRO.
  - PIC assignment dan priority level.

#### 🔹 Slide 7: Otomasi Laporan & Email
- **Key Metric**: Waktu rekap laporan turun dari 180 menit → 15 menit.
- **Highlight Fitur**:
  - 1-Click Live Scraper: Data proyek/model ditarik otomatis ke badan laporan.
  - Grup kontak tersimpan (tidak perlu ketik ulang penerima email).
  - SMTP cron scheduler: Laporan dikirim otomatis pada jadwal yang ditentukan.

#### 🔹 Slide 8: Keamanan Dokumen & Utilitas Mandiri
- **Highlight Fitur**:
  - In-browser viewer: Buka PDF, Word, Excel langsung tanpa Office — nol lisensi tambahan.
  - Local AI U2Net: Background removal foto JIG/prototipe tanpa upload ke internet.
  - PDF Compression & Merge/Split internal.
  - VAAPI Video Compressor untuk rekaman line.

#### 🔹 Slide 9: Tata Kelola Akses & Kemudahan
- **Highlight Fitur**:
  - Login langsung pakai akun ADCorp Samsung (username.domain) — tanpa buat akun baru.
  - Granular menu permission: Admin atur visibilitas per role, per divisi, per individu.
  - 3 bahasa instan (ID/EN/KO) — satu klik di TopBar.
  - Desktop tray manager (Tauri): Tanpa jendela hitam CMD, auto-update.

#### 🔹 Slide 10: Ringkasan Dampak Bisnis
Tampilkan tabel komparasi sebelum dan sesudah:

| Metrik | Sebelum PE-Portal | Sesudah PE-Portal |
| :--- | :--- | :--- |
| ⏱️ Waktu Rekap Laporan | 180 menit / minggu | **15 menit / minggu** |
| 🔄 Sinkronisasi Status NPI | Berkala / manual satu-satu | **100% Real-Time** |
| 🛡️ Keamanan Dokumen Prototipe | Risiko upload ke cloud pihak ketiga | **100% Internal On-Premise** |
| 💰 Lisensi Software Eksternal | Berlangganan berbagai SaaS | **Rp 0 (nol tambahan)** |
| 🌐 Aksesibilitas Bahasa | Hanya Indonesia | **3 Bahasa (ID/EN/KO)** |
| 📱 Akses SOP di Terminal Lini | Butuh install Office | **Browser saja** |
| 🔐 Login Engineer | Buat akun terpisah | **Langsung pakai ADCorp** |

---

## 🛠️ Arsitektur & Spesifikasi Teknologi

| Layer Arsitektur | Teknologi | Karakteristik & Keunggulan |
| :--- | :--- | :--- |
| **Desktop Manager** | Tauri v2, Rust 1.77+, WinAPI | Ukuran < 15MB, tanpa CMD popup, auto-updater Minisign |
| **Frontend Web** | React 19, Vite, Vanilla CSS Modules, Lucide Icons, i18next | Build ultra cepat (< 300ms), nol UI library bloat, responsif |
| **Backend API** | Go 1.22+, Gin Web Framework, pgx, go-ldap | Idle memory < 35MB, throughput konkurensi tinggi |
| **AI / Vision** | U2Net ONNX (Python), OpenAI / LM Studio / Ollama Client, MCP Client | Self-hosted AI, tanpa ketergantungan internet |
| **Database** | PostgreSQL 16, pgvector (RAG embeddings) | ACID compliant, migrasi versi 001 – 029 |
| **Cache & Queue** | Redis 7 | Cache cepat, blacklist JWT, koordinasi scheduler cron |
| **Kontainerisasi** | Docker Compose, Nginx Alpine (multi-stage build) | Image hemat ukuran, siap deploy produksi instan |
| **CI/CD** | GitHub Actions, Minisign signing | Automated build & release untuk Windows installer |
| **Otentikasi** | JWT (lokal) + LDAP v3 (ADCorp Active Directory) | Dual-mode auth, JIT user provisioning |

---

## 🚀 Panduan Instalasi & Deployment

### 1. Deployment Cepat Menggunakan Docker Compose (Rekomendasi)

```bash
# 1. Clone repository
git clone https://github.com/endrisusanto/PE-Portal.git
cd PE-Portal

# 2. Siapkan file konfigurasi environment
cp .env.example .env
# Edit .env sesuai kebutuhan (database password, AUTH_PROVIDER, LDAP config, dll)

# 3. Jalankan seluruh container dalam mode background
docker compose up -d --build
```

Akses portal melalui browser di: `http://localhost:3025`

### 2. Deployment 1-Click untuk Windows

Cukup klik dua kali file **`deploy-windows.bat`** atau jalankan perintah PowerShell:
```powershell
.\deploy-windows.ps1
```
Skrip otomatis memeriksa Docker Desktop, menyiapkan `.env`, build semua kontainer, dan membuka browser ke `http://localhost:3025`.

### 3. Bare Metal Installation (Tanpa Docker)

Installer otomatis 1-command untuk server Linux Debian/Ubuntu:
```bash
# Langsung dari repository
curl -fsSL https://raw.githubusercontent.com/endrisusanto/PE-Portal/main/install-baremetal.sh | bash

# Atau jika sudah clone
./install-baremetal.sh
```

#### Mengelola Service Bare Metal:
```bash
# Opsi A: Standalone Runner (Tanpa Root)
./start-baremetal.sh    # Start backend :8085 dan frontend preview :3025
./stop-baremetal.sh     # Stop semua service
tail -f logs/backend.log logs/frontend.log  # Live log

# Opsi B: Systemd Daemon (Auto-Start saat Boot)
sudo systemctl enable --now pe-portal-backend pe-portal-frontend
sudo systemctl status pe-portal-backend pe-portal-frontend
```

### 4. Windows Desktop Manager (Tauri)

Download installer terbaru dari **[GitHub Releases](https://github.com/endrisusanto/PE-Portal/releases)**:
- **`PE-Portal.Manager_x.x.x_x64-setup.exe`** (NSIS Installer)
- **`PE-Portal.Manager_x.x.x_x64_en-US.msi`** (Enterprise WiX Package)

Atau build lokal:
```bash
cd desktop && npm install && npm run tauri build
```

### 5. Manual Local Development (Tanpa Docker)

#### Prasyarat:
- **Go**: 1.22+ | **Node.js**: 22+ | **Rust**: 1.77+ (opsional, untuk desktop) | **PostgreSQL**: 16+ | **Redis**: 7+

```bash
# 1. Setup database
createdb -U postgres pe_portal
for f in migrations/*.sql; do psql -U postgres -d pe_portal -f "$f"; done

# 2. Run backend
cd backend
export DATABASE_URL="postgres://postgres:password@localhost:5432/pe_portal?sslmode=disable"
export REDIS_URL="redis://localhost:6379"
export JWT_SECRET="your_dev_secret_key"
go run cmd/server/main.go

# 3. Run frontend (terminal terpisah)
cd frontend
npm install && npm run dev
# Frontend dev server: http://localhost:5173 (proxy ke API 8085)

# 4. Run desktop app (opsional, terminal terpisah)
cd desktop
npm install && npm run tauri dev
```

### Pemetaan Port Sistem

| Layanan | Nama Kontainer | Port Internal | Port Host | Deskripsi |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend Web** | `pe-portal-frontend` | `80` | `3025` | Nginx Alpine React SPA |
| **Backend API** | `pe-portal-backend` | `8085` | `8085` | Go REST API Service |
| **Database** | `pe-portal-postgres` | `5432` | `5432` | PostgreSQL 16 Database |
| **Cache & Queue** | `pe-portal-redis` | `6379` | `6379` | Redis 7 Key-Value Store |

---

## 🚀 Automated Release Pipeline (`release.sh`)

```bash
./release.sh patch    # 1.0.0 → 1.0.1
./release.sh minor    # 1.0.1 → 1.1.0
./release.sh 1.2.0    # Versi eksplisit
```

#### Pipeline Otomatis:
1. Auto-commit perubahan yang belum di-commit.
2. Sinkronisasi nomor versi di `package.json`, `frontend/package.json`, `desktop/package.json`, `tauri.conf.json`, dan `Cargo.toml`.
3. Buat tag rilis Git (misal `v1.0.1`).
4. Push ke GitHub → GitHub Actions otomatis:
   - Kompilasi Go backend (`pe-portal-backend.exe`).
   - Build Vite SPA frontend.
   - Kompilasi Tauri v2 Rust + packaging WiX/NSIS.
   - Signing payload Minisign (`.sig`).
   - Generate `latest.json` auto-update manifest.
   - Publish ke GitHub Releases.

---

## 📁 Struktur Repository

```
PE-Portal/
├── .env.example              # Template konfigurasi environment
├── .github/workflows/        # CI/CD Release automation (Windows runner)
├── docker-compose.yml        # Docker compose service definition
├── package.json              # Root metadata dan release helper
├── release.sh                # Automated version bumper & release script
├── deploy-windows.bat/ps1    # Windows 1-click Docker deployment
├── install-baremetal.sh/bat  # Bare metal installer
├── start-baremetal.sh/bat    # Start service runners
├── stop-baremetal.sh/bat     # Stop service runners
├── README.md                 # Dokumentasi ini
│
├── desktop/                  # Tauri v2 Windows Desktop Tray Manager
│   ├── index.html            # Dark-themed management dashboard
│   ├── package.json          # Vite + Tauri CLI tooling
│   └── src-tauri/            # Rust native backend
│       ├── Cargo.toml        # Tauri, WinAPI, updater dependencies
│       ├── tauri.conf.json   # Bundle settings, Minisign pubkey, updater
│       └── src/lib.rs        # Tray icon, subprocess mgmt, CREATE_NO_WINDOW
│
├── backend/                  # Go REST API backend
│   ├── cmd/server/main.go    # Application entrypoint
│   ├── Dockerfile            # Multi-stage Go build container
│   ├── go.mod / go.sum       # Go module dependencies
│   ├── internal/
│   │   ├── auth/             # JWT (local) & LDAP (ADCorp) providers
│   │   ├── config/           # Environment & .env loader
│   │   ├── database/         # PostgreSQL & Redis connection pools
│   │   ├── handler/          # HTTP request handlers (REST endpoints)
│   │   ├── i18n/             # Server-side localization files (en, id, ko)
│   │   ├── middleware/       # RBAC, Auth, Audit log middlewares
│   │   ├── model/            # Go domain struct definitions
│   │   ├── repository/       # Database SQL queries
│   │   └── service/          # SMTP dispatcher, LLM client, cron scheduler
│   ├── scripts/              # U2Net background removal, ECN Excel parser
│   └── migrations/           # Database SQL schema migrations (001 – 029)
│
├── frontend/                 # React 19 + Vite frontend
│   ├── Dockerfile            # Multi-stage build with Nginx Alpine
│   ├── nginx.conf            # Nginx reverse proxy & SPA router config
│   ├── package.json          # Frontend dependencies
│   ├── vite.config.js        # Vite build & proxy settings
│   └── src/
│       ├── api/              # Axios HTTP client with JWT interceptor
│       ├── components/
│       │   ├── common/       # Button, EmailChipInput, LanguageSwitcher,
│       │   │                 # ThemePalettePicker, ThemeAnimatedBackground,
│       │   │                 # Modal, GuestAuthModal, StatusBadge
│       │   ├── layout/       # AppShell, TopBar, Sidebar
│       │   └── office/       # VirtualOfficeCanvas (2D desk layout)
│       ├── contexts/         # AuthContext, ThemeContext, LanguageContext
│       ├── pages/            # Dashboard, Innovations, Projects, Models,
│       │                     # Articles, Documents, Reports, ReportEditor,
│       │                     # SampleManagement, DhlTracker, SoftwareMR,
│       │                     # GbaTasks, GmesMonitoring, EcnMonitoring,
│       │                     # Training, VirtualOffice, AiChat, Utility,
│       │                     # Team, Profile, Settings, Admin, SharedDocument
│       ├── index.css         # Design system tokens, grain, palettes
│       └── main.jsx          # React DOM root entrypoint
│
└── migrations/               # Standalone migration folder (symlinked)
    ├── 001_init.sql           # Core schema (users, projects, models, docs)
    ├── 002_seed.sql           # Seed data (group parts, admin user, MCP)
    ├── ...
    └── 024_add_pic_model_group_part.sql
```

---

## 📄 Lisensi & Atribusi

Aplikasi internal dikembangkan khusus untuk **SEIN PE Group (Samsung Electronics Indonesia)**.  
Dibangun dengan prinsip rekayasa performa tinggi dan antarmuka modern yang fungsional.
