# ============================================================================
# SEIN PE-Portal: NASCA DRM to Standard PDF Converter Tool
# Mode: Ponytail (Native Windows Automation for Samsung Corporate DRM)
# ============================================================================
# Deskripsi:
#   Mengonversi dokumen yang terenkripsi oleh sistem keamanan korporat
#   (Samsung NASCA / SoftCamp DRM) menjadi file PDF standar bersih (un-DRM).
#
# Cara Kerja:
#   Memanfaatkan COM Automation Microsoft Office (Word, Excel, PowerPoint)
#   di PC Windows pengguna. Karena MS Office memiliki hook filter driver
#   NASCA yang aktif, file didekripsi secara transparan di memori lalu
#   diekspor sebagai PDF standar murni yang bisa di-compress, merge, dan split.
# ============================================================================
param (
    [Parameter(Position = 0)]
    [string]$Path = "",

    [Parameter()]
    [string]$OutputDir = ""
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  SEIN PE-PORTAL - NASCA DRM TO CLEAN PDF CONVERTER     " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

if (-not $Path) {
    Write-Host "Pilih mode konversi:" -ForegroundColor Yellow
    Write-Host "  1. Konversi Satu File Dokumen (.docx, .doc, .xlsx, .pptx, .pdf)"
    Write-Host "  2. Konversi Seluruh File dalam Folder (Batch Mode)"
    Write-Host "  3. Bantuan Cara Un-DRM Manual via Adobe Reader (Print to PDF)"
    Write-Host ""
    $choice = Read-Host "Pilihan Anda (1/2/3)"

    if ($choice -eq "3") {
        Write-Host ""
        Write-Host "--- PANDUAN MANUAL UNTUK FILE PDF (ADOBE READER) ---" -ForegroundColor Green
        Write-Host "1. Buka file PDF yang terenkripsi NASCA di Adobe Acrobat Reader."
        Write-Host "2. Tekan tombol keyboard: Ctrl + P (Print)."
        Write-Host "3. Pada pilihan Printer, pilih: 'Microsoft Print to PDF'."
        Write-Host "4. Klik 'Print', lalu tentukan nama file PDF baru (misal: doc_clean.pdf)."
        Write-Host "5. File hasil Print to PDF ini 100% BEBAS ENKRIPSI NASCA dan siap diolah"
        Write-Host "   di menu PDF Compress, Merge, atau Split pada PE-Portal!" -ForegroundColor Yellow
        Write-Host ""
        pause
        exit 0
    } elseif ($choice -eq "2") {
        $Path = Read-Host "Masukkan path folder yang berisi dokumen"
    } else {
        $Path = Read-Host "Masukkan path file dokumen (contoh: C:\docs\laporan.docx)"
    }
}

if (-not (Test-Path $Path)) {
    Write-Host "[ERROR] Path '$Path' tidak ditemukan!" -ForegroundColor Red
    exit 1
}

$isFolder = (Get-Item $Path) -is [System.IO.DirectoryInfo]
$targetFiles = @()

if ($isFolder) {
    $targetFiles = Get-ChildItem -Path $Path -File | Where-Object {
        $_.Extension -match "\.(docx|doc|xlsx|xls|pptx|ppt)$"
    }
    if ($targetFiles.Count -eq 0) {
        Write-Host "[INFO] Tidak ditemukan file Word/Excel/PowerPoint di dalam folder '$Path'." -ForegroundColor Yellow
        exit 0
    }
    if (-not $OutputDir) {
        $OutputDir = Join-Path $Path "Clean_PDF_Output"
    }
} else {
    $targetFiles = @(Get-Item $Path)
    if (-not $OutputDir) {
        $OutputDir = (Get-Item $Path).DirectoryName
    }
}

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

Write-Host "Folder Output: $OutputDir" -ForegroundColor Green
Write-Host "Ditemukan $($targetFiles.Count) file untuk diproses..." -ForegroundColor Cyan
Write-Host ""

# Inisialisasi COM Objects
$wordApp = $null
$excelApp = $null
$pptApp = $null

function Get-WordApp {
    if (-not $script:wordApp) {
        try {
            $script:wordApp = New-Object -ComObject Word.Application
            $script:wordApp.Visible = $false
            $script:wordApp.DisplayAlerts = [Microsoft.Office.Interop.Word.WdAlertLevel]::wdAlertsNone
        } catch {
            Write-Host "[WARN] Tidak dapat menginisialisasi MS Word COM." -ForegroundColor Yellow
        }
    }
    return $script:wordApp
}

function Get-ExcelApp {
    if (-not $script:excelApp) {
        try {
            $script:excelApp = New-Object -ComObject Excel.Application
            $script:excelApp.Visible = $false
            $script:excelApp.DisplayAlerts = $false
        } catch {
            Write-Host "[WARN] Tidak dapat menginisialisasi MS Excel COM." -ForegroundColor Yellow
        }
    }
    return $script:excelApp
}

function Get-PptApp {
    if (-not $script:pptApp) {
        try {
            $script:pptApp = New-Object -ComObject PowerPoint.Application
        } catch {
            Write-Host "[WARN] Tidak dapat menginisialisasi MS PowerPoint COM." -ForegroundColor Yellow
        }
    }
    return $script:pptApp
}

$successCount = 0

foreach ($file in $targetFiles) {
    $ext = $file.Extension.ToLower()
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($file.Name)
    $cleanPdfPath = Join-Path $OutputDir "$baseName.pdf"

    Write-Host "-> Memproses: $($file.Name) ... " -NoNewline -ForegroundColor Gray

    try {
        if ($ext -in @(".docx", ".doc")) {
            $word = Get-WordApp
            if ($word) {
                $doc = $word.Documents.Open($file.FullName, $false, $true)
                $wdExportFormatPDF = 17
                $doc.ExportAsFixedFormat($cleanPdfPath, $wdExportFormatPDF)
                $doc.Close([Microsoft.Office.Interop.Word.WdSaveOptions]::wdDoNotSaveChanges)
                Write-Host "[OK] Disimpan ke $cleanPdfPath" -ForegroundColor Green
                $successCount++
            }
        } elseif ($ext -in @(".xlsx", ".xls")) {
            $excel = Get-ExcelApp
            if ($excel) {
                $wb = $excel.Workbooks.Open($file.FullName, $null, $true)
                $xlTypePDF = 0
                $wb.ExportAsFixedFormat($xlTypePDF, $cleanPdfPath)
                $wb.Close($false)
                Write-Host "[OK] Disimpan ke $cleanPdfPath" -ForegroundColor Green
                $successCount++
            }
        } elseif ($ext -in @(".pptx", ".ppt")) {
            $ppt = Get-PptApp
            if ($ppt) {
                $pres = $ppt.Presentations.Open($file.FullName, $true, $false, $false)
                $ppSaveAsPDF = 32
                $pres.SaveAs($cleanPdfPath, $ppSaveAsPDF)
                $pres.Close()
                Write-Host "[OK] Disimpan ke $cleanPdfPath" -ForegroundColor Green
                $successCount++
            }
        } elseif ($ext -eq ".pdf") {
            Write-Host "[INFO] Untuk file PDF, gunakan Adobe Reader -> Ctrl + P -> 'Microsoft Print to PDF'" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "[GAGAL]: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Cleanup COM Objects
if ($wordApp) {
    try { $wordApp.Quit() } catch {}
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($wordApp) | Out-Null
}
if ($excelApp) {
    try { $excelApp.Quit() } catch {}
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($excelApp) | Out-Null
}
if ($pptApp) {
    try { $pptApp.Quit() } catch {}
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($pptApp) | Out-Null
}
[System.GC]::Collect()
[System.GC]::WaitForPendingFinalizers()

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  SELESAI: $successCount file berhasil dikonversi ke PDF bersih!" -ForegroundColor Green
Write-Host "  File output siap diunggah ke PDF Compress/Merge/Split PE-Portal." -ForegroundColor White
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""
