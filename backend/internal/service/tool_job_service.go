package service

import (
	"context"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"pe-portal/internal/model"
	"pe-portal/internal/repository"
	"pe-portal/internal/util"
)

type ToolJobService struct {
	repo       *repository.ToolJobRepository
	sem        chan struct{}
	cancels    sync.Map // map[string]context.CancelFunc
	storageDir string
}

func NewToolJobService(repo *repository.ToolJobRepository) *ToolJobService {
	storage := os.Getenv("FILE_STORAGE_PATH")
	if storage == "" {
		storage = "/data/files"
	}
	outDir := filepath.Join(storage, "tools_output")
	_ = os.MkdirAll(outDir, 0755)

	return &ToolJobService{
		repo:       repo,
		sem:        make(chan struct{}, 3), // Max 3 concurrent heavy background jobs
		storageDir: outDir,
	}
}

func (s *ToolJobService) getOutPath(filename string) string {
	_ = os.MkdirAll(s.storageDir, 0755)
	return filepath.Join(s.storageDir, filename)
}

func (s *ToolJobService) GetJob(ctx context.Context, id uuid.UUID) (*model.ToolJob, error) {
	return s.repo.GetByID(ctx, id)
}

func (s *ToolJobService) ListActive(ctx context.Context, userID *uuid.UUID) ([]model.ToolJob, error) {
	return s.repo.ListActive(ctx, userID)
}

func (s *ToolJobService) ListRecent(ctx context.Context, userID *uuid.UUID, limit int) ([]model.ToolJob, error) {
	return s.repo.ListRecent(ctx, userID, limit)
}

func (s *ToolJobService) DeleteJob(ctx context.Context, id uuid.UUID) error {
	job, err := s.repo.GetByID(ctx, id)
	if err == nil && job != nil && job.OutputPath != "" {
		_ = os.Remove(job.OutputPath)
	}
	return s.repo.Delete(ctx, id)
}

func (s *ToolJobService) CancelJob(ctx context.Context, id uuid.UUID) error {
	idStr := id.String()
	if val, ok := s.cancels.Load(idStr); ok {
		if cancel, isCancel := val.(context.CancelFunc); isCancel {
			cancel()
		}
		s.cancels.Delete(idStr)
	}
	return s.repo.MarkCancelled(ctx, id)
}

func (s *ToolJobService) GetNotificationSummary(ctx context.Context, userID *uuid.UUID) (*model.NotificationSummary, error) {
	tools, err := s.repo.ListRecent(ctx, userID, 15)
	if err != nil {
		tools = []model.ToolJob{}
	}

	changeLogs, err := s.repo.GetRecentChangeLogs(ctx, 10)
	if err != nil {
		changeLogs = []model.NotificationChangeLog{}
	}

	activeCount := 0
	for _, j := range tools {
		if j.Status == "pending" || j.Status == "processing" {
			activeCount++
		}
	}

	return &model.NotificationSummary{
		ToolsProgress:   tools,
		ChangeLogs:      changeLogs,
		ActiveJobsCount: activeCount,
		UnreadLogsCount: len(changeLogs),
	}, nil
}

// -------------------------------------------------------------
// 1. Video Compressor Background Worker
// -------------------------------------------------------------
func (s *ToolJobService) SubmitVideoCompress(
	ctx context.Context,
	userID *uuid.UUID,
	inTempPath, filename string,
	fileSize int64,
	quality, resolution, encoder string,
	muteAudio bool,
) (*model.ToolJob, error) {
	job := &model.ToolJob{
		ID:              uuid.New(),
		UserID:          userID,
		ToolType:        "video-compress",
		FileName:        filename,
		FileSize:        fileSize,
		Status:          "pending",
		ProgressPercent: 0,
		CurrentStep:     "Menunggu antrean worker...",
	}

	if err := s.repo.Create(ctx, job); err != nil {
		return nil, err
	}

	jobCtx, cancel := context.WithCancel(context.Background())
	s.cancels.Store(job.ID.String(), cancel)

	go func() {
		defer s.cancels.Delete(job.ID.String())
		s.sem <- struct{}{}
		defer func() { <-s.sem }()

		startTime := time.Now()
		_ = s.repo.MarkStarted(context.Background(), job.ID)
		_ = s.repo.UpdateProgress(context.Background(), job.ID, 5.0, "Memulai kompresi video...")

		outFilename := fmt.Sprintf("compressed_%s_%d.mp4", strings.TrimSuffix(filepath.Base(filename), filepath.Ext(filename)), time.Now().Unix())
		outPath := s.getOutPath(outFilename)
		downloadURL := fmt.Sprintf("/api/v1/utility/jobs/%s/download", job.ID)

		defer os.Remove(inTempPath)

		// Video filters
		var scaleFilter string
		switch resolution {
		case "1080p":
			scaleFilter = "scale=-2:1080"
		case "720p":
			scaleFilter = "scale=-2:720"
		case "480p":
			scaleFilter = "scale=-2:480"
		}

		var qpVaapi, crfX264 string
		switch quality {
		case "high":
			qpVaapi = "24"
			crfX264 = "23"
		case "low":
			qpVaapi = "33"
			crfX264 = "32"
		default:
			qpVaapi = "28"
			crfX264 = "28"
		}

		usedEncoder := "libx264"
		success := false

		// Progress ticker while processing
		done := make(chan struct{})
		go func() {
			ticker := time.NewTicker(1200 * time.Millisecond)
			defer ticker.Stop()
			curr := 20.0
			for {
				select {
				case <-done:
					return
				case <-ticker.C:
					if curr < 92.0 {
						curr += 5.0
						_ = s.repo.UpdateProgress(context.Background(), job.ID, curr, fmt.Sprintf("Sedang mengompresi video (%s)...", usedEncoder))
					}
				}
			}
		}()

		// Try VAAPI if available
		if encoder == "auto" || encoder == "vaapi" {
			if _, err := os.Stat("/dev/dri/renderD128"); err == nil {
				_ = s.repo.UpdateProgress(context.Background(), job.ID, 15.0, "Kompresi via Intel VAAPI hardware...")
				var vfParts []string
				if scaleFilter != "" {
					vfParts = append(vfParts, scaleFilter)
				}
				vfParts = append(vfParts, "format=nv12", "hwupload")
				vfStr := strings.Join(vfParts, ",")

				args := []string{
					"-y", "-vaapi_device", "/dev/dri/renderD128",
					"-i", inTempPath,
					"-vf", vfStr,
					"-c:v", "h264_vaapi",
					"-qp", qpVaapi,
				}
				if muteAudio {
					args = append(args, "-an")
				} else {
					args = append(args, "-c:a", "aac", "-b:a", "128k")
				}
				args = append(args, outPath)

				cmd := exec.CommandContext(jobCtx, "ffmpeg", args...)
				if err := cmd.Run(); err == nil {
					if fi, stErr := os.Stat(outPath); stErr == nil && fi.Size() > 0 {
						usedEncoder = "h264_vaapi"
						success = true
					}
				}
			}
		}

		// Fallback to CPU libx264
		if !success && jobCtx.Err() == nil {
			_ = s.repo.UpdateProgress(context.Background(), job.ID, 35.0, "Kompresi via CPU x264 multi-core...")
			var vfParts []string
			if scaleFilter != "" {
				vfParts = append(vfParts, scaleFilter)
			}
			vfParts = append(vfParts, "format=yuv420p")
			vfStr := strings.Join(vfParts, ",")

			args := []string{
				"-y", "-i", inTempPath,
				"-vf", vfStr,
				"-c:v", "libx264",
				"-preset", "veryfast",
				"-crf", crfX264,
			}
			if muteAudio {
				args = append(args, "-an")
			} else {
				args = append(args, "-c:a", "aac", "-b:a", "128k")
			}
			args = append(args, outPath)

			cmd := exec.CommandContext(jobCtx, "ffmpeg", args...)
			if err := cmd.Run(); err == nil {
				if fi, stErr := os.Stat(outPath); stErr == nil && fi.Size() > 0 {
					usedEncoder = "libx264"
					success = true
				}
			}
		}

		close(done)
		duration := time.Since(startTime).Seconds()

		if jobCtx.Err() != nil {
			_ = s.repo.MarkCancelled(context.Background(), job.ID)
			_ = os.Remove(outPath)
			return
		}

		if !success {
			_ = s.repo.MarkFailed(context.Background(), job.ID, "Gagal mengompresi video (FFmpeg error)", duration)
			return
		}

		fi, _ := os.Stat(outPath)
		compressedSize := int64(0)
		if fi != nil {
			compressedSize = fi.Size()
		}
		savings := 0.0
		if fileSize > 0 && compressedSize > 0 {
			savings = (1.0 - (float64(compressedSize) / float64(fileSize))) * 100.0
		}

		meta, _ := json.Marshal(map[string]interface{}{
			"original_size":   fileSize,
			"compressed_size": compressedSize,
			"savings_percent": math.Round(savings*100) / 100,
			"encoder":         usedEncoder,
			"quality":         quality,
			"resolution":      resolution,
		})

		_ = s.repo.MarkCompleted(context.Background(), job.ID, outPath, downloadURL, meta, duration)
	}()

	return job, nil
}

// -------------------------------------------------------------
// 2. Remove Background Worker
// -------------------------------------------------------------
func (s *ToolJobService) SubmitRemoveBackground(
	ctx context.Context,
	userID *uuid.UUID,
	inTempPath, filename string,
	fileSize int64,
	tolerance, bgColor, feather string,
) (*model.ToolJob, error) {
	job := &model.ToolJob{
		ID:              uuid.New(),
		UserID:          userID,
		ToolType:        "remove-bg",
		FileName:        filename,
		FileSize:        fileSize,
		Status:          "pending",
		ProgressPercent: 0,
		CurrentStep:     "Menunggu antrean pemrosesan AI...",
	}

	if err := s.repo.Create(ctx, job); err != nil {
		return nil, err
	}

	jobCtx, cancel := context.WithCancel(context.Background())
	s.cancels.Store(job.ID.String(), cancel)

	go func() {
		defer s.cancels.Delete(job.ID.String())
		s.sem <- struct{}{}
		defer func() { <-s.sem }()

		startTime := time.Now()
		_ = s.repo.MarkStarted(context.Background(), job.ID)
		_ = s.repo.UpdateProgress(context.Background(), job.ID, 20.0, "Memuat model segmentasi gambar...")

		outFilename := fmt.Sprintf("nobg_%s_%d.png", strings.TrimSuffix(filepath.Base(filename), filepath.Ext(filename)), time.Now().Unix())
		outPath := s.getOutPath(outFilename)
		downloadURL := fmt.Sprintf("/api/v1/utility/jobs/%s/download", job.ID)
		defer os.Remove(inTempPath)

		// Locate script
		scriptPath := filepath.Join("scripts", "remove_bg.py")
		if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
			scriptPath = filepath.Join("backend", "scripts", "remove_bg.py")
			if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
				scriptPath = "/app/scripts/remove_bg.py"
			}
		}

		_ = s.repo.UpdateProgress(context.Background(), job.ID, 50.0, "Menghapus background & refining tepi...")

		cmd := exec.CommandContext(jobCtx, util.FindPythonExecutable(), scriptPath, inTempPath, outPath, tolerance, bgColor, feather)
		out, err := cmd.CombinedOutput()
		duration := time.Since(startTime).Seconds()

		if jobCtx.Err() != nil {
			_ = s.repo.MarkCancelled(context.Background(), job.ID)
			_ = os.Remove(outPath)
			return
		}

		if err != nil {
			_ = s.repo.MarkFailed(context.Background(), job.ID, fmt.Sprintf("Python rembg error: %s", string(out)), duration)
			return
		}

		fi, _ := os.Stat(outPath)
		outSize := int64(0)
		if fi != nil {
			outSize = fi.Size()
		}

		meta, _ := json.Marshal(map[string]interface{}{
			"output_size": outSize,
			"tolerance":   tolerance,
			"bg_color":    bgColor,
			"feather":     feather,
		})

		_ = s.repo.MarkCompleted(context.Background(), job.ID, outPath, downloadURL, meta, duration)
	}()

	return job, nil
}

// -------------------------------------------------------------
// 3. Compress PDF Worker
// -------------------------------------------------------------
func (s *ToolJobService) SubmitCompressPDF(
	ctx context.Context,
	userID *uuid.UUID,
	inTempPath, filename string,
	fileSize int64,
	quality, targetSizeMB string,
) (*model.ToolJob, error) {
	job := &model.ToolJob{
		ID:              uuid.New(),
		UserID:          userID,
		ToolType:        "compress-pdf",
		FileName:        filename,
		FileSize:        fileSize,
		Status:          "pending",
		ProgressPercent: 0,
		CurrentStep:     "Menunggu antrean Ghostscript...",
	}

	if err := s.repo.Create(ctx, job); err != nil {
		return nil, err
	}

	jobCtx, cancel := context.WithCancel(context.Background())
	s.cancels.Store(job.ID.String(), cancel)

	go func() {
		defer s.cancels.Delete(job.ID.String())
		s.sem <- struct{}{}
		defer func() { <-s.sem }()

		startTime := time.Now()
		_ = s.repo.MarkStarted(context.Background(), job.ID)
		_ = s.repo.UpdateProgress(context.Background(), job.ID, 25.0, "Menganalisis objek font & raster PDF...")

		outFilename := fmt.Sprintf("compressed_%s_%d.pdf", strings.TrimSuffix(filepath.Base(filename), filepath.Ext(filename)), time.Now().Unix())
		outPath := s.getOutPath(outFilename)
		downloadURL := fmt.Sprintf("/api/v1/utility/jobs/%s/download", job.ID)
		defer os.Remove(inTempPath)

		var gsSetting string
		switch quality {
		case "screen":
			gsSetting = "/screen"
		case "printer":
			gsSetting = "/printer"
		case "prepress":
			gsSetting = "/prepress"
		default:
			gsSetting = "/ebook"
		}

		_ = s.repo.UpdateProgress(context.Background(), job.ID, 45.0, "Mengompresi streams & resampling visual...")

		done := make(chan struct{})
		go func() {
			ticker := time.NewTicker(800 * time.Millisecond)
			defer ticker.Stop()
			curr := 45.0
			for {
				select {
				case <-done:
					return
				case <-ticker.C:
					if curr < 90.0 {
						curr += 10.0
						_ = s.repo.UpdateProgress(context.Background(), job.ID, curr, "Mengoptimalkan font & gambar PDF...")
					}
				}
			}
		}()

		args := []string{
			"-sDEVICE=pdfwrite",
			"-dCompatibilityLevel=1.4",
			"-dPDFSETTINGS=" + gsSetting,
			"-dNOPAUSE",
			"-dQUIET",
			"-dBATCH",
			"-sOutputFile=" + outPath,
			inTempPath,
		}

		cmd := exec.CommandContext(jobCtx, "gs", args...)
		out, err := cmd.CombinedOutput()
		close(done)
		duration := time.Since(startTime).Seconds()

		if jobCtx.Err() != nil {
			_ = s.repo.MarkCancelled(context.Background(), job.ID)
			_ = os.Remove(outPath)
			return
		}

		if err != nil {
			_ = s.repo.MarkFailed(context.Background(), job.ID, fmt.Sprintf("Ghostscript error: %s", string(out)), duration)
			return
		}

		fi, _ := os.Stat(outPath)
		compressedSize := int64(0)
		if fi != nil {
			compressedSize = fi.Size()
		}
		savings := 0.0
		if fileSize > 0 && compressedSize > 0 {
			savings = (1.0 - (float64(compressedSize) / float64(fileSize))) * 100.0
		}

		meta, _ := json.Marshal(map[string]interface{}{
			"original_size":   fileSize,
			"compressed_size": compressedSize,
			"savings_percent": math.Round(savings*100) / 100,
			"preset":          quality,
		})

		_ = s.repo.MarkCompleted(context.Background(), job.ID, outPath, downloadURL, meta, duration)
	}()

	return job, nil
}

// -------------------------------------------------------------
// 4. Merge PDF Worker
// -------------------------------------------------------------
func (s *ToolJobService) SubmitMergePDF(
	ctx context.Context,
	userID *uuid.UUID,
	inTempPaths []string,
	outputFilename string,
	totalSize int64,
) (*model.ToolJob, error) {
	if outputFilename == "" {
		outputFilename = "Merged_Document.pdf"
	}

	job := &model.ToolJob{
		ID:              uuid.New(),
		UserID:          userID,
		ToolType:        "merge-pdf",
		FileName:        outputFilename,
		FileSize:        totalSize,
		Status:          "pending",
		ProgressPercent: 0,
		CurrentStep:     "Menyiapkan batch PDF untuk digabungkan...",
	}

	if err := s.repo.Create(ctx, job); err != nil {
		return nil, err
	}

	jobCtx, cancel := context.WithCancel(context.Background())
	s.cancels.Store(job.ID.String(), cancel)

	go func() {
		defer s.cancels.Delete(job.ID.String())
		s.sem <- struct{}{}
		defer func() { <-s.sem }()

		startTime := time.Now()
		_ = s.repo.MarkStarted(context.Background(), job.ID)
		_ = s.repo.UpdateProgress(context.Background(), job.ID, 30.0, "Menggabungkan halaman dokumen...")

		outFilename := fmt.Sprintf("merged_%d.pdf", time.Now().Unix())
		outPath := s.getOutPath(outFilename)
		downloadURL := fmt.Sprintf("/api/v1/utility/jobs/%s/download", job.ID)
		defer func() {
			for _, p := range inTempPaths {
				_ = os.Remove(p)
			}
		}()

		args := []string{
			"-sDEVICE=pdfwrite",
			"-dCompatibilityLevel=1.4",
			"-dNOPAUSE",
			"-dQUIET",
			"-dBATCH",
			"-sOutputFile=" + outPath,
		}
		args = append(args, inTempPaths...)

		cmd := exec.CommandContext(jobCtx, "gs", args...)
		out, err := cmd.CombinedOutput()
		duration := time.Since(startTime).Seconds()

		if jobCtx.Err() != nil {
			_ = s.repo.MarkCancelled(context.Background(), job.ID)
			_ = os.Remove(outPath)
			return
		}

		if err != nil {
			_ = s.repo.MarkFailed(context.Background(), job.ID, fmt.Sprintf("Merge error: %s", string(out)), duration)
			return
		}

		fi, _ := os.Stat(outPath)
		outSize := int64(0)
		if fi != nil {
			outSize = fi.Size()
		}

		meta, _ := json.Marshal(map[string]interface{}{
			"files_count": len(inTempPaths),
			"output_size": outSize,
		})

		_ = s.repo.MarkCompleted(context.Background(), job.ID, outPath, downloadURL, meta, duration)
	}()

	return job, nil
}

// -------------------------------------------------------------
// 5. Split PDF Worker
// -------------------------------------------------------------
func (s *ToolJobService) SubmitSplitPDF(
	ctx context.Context,
	userID *uuid.UUID,
	inTempPath, filename string,
	fileSize int64,
	splitRanges string,
) (*model.ToolJob, error) {
	job := &model.ToolJob{
		ID:              uuid.New(),
		UserID:          userID,
		ToolType:        "split-pdf",
		FileName:        filename,
		FileSize:        fileSize,
		Status:          "pending",
		ProgressPercent: 0,
		CurrentStep:     "Menunggu pemisahan halaman PDF...",
	}

	if err := s.repo.Create(ctx, job); err != nil {
		return nil, err
	}

	jobCtx, cancel := context.WithCancel(context.Background())
	s.cancels.Store(job.ID.String(), cancel)

	go func() {
		defer s.cancels.Delete(job.ID.String())
		s.sem <- struct{}{}
		defer func() { <-s.sem }()

		startTime := time.Now()
		_ = s.repo.MarkStarted(context.Background(), job.ID)
		_ = s.repo.UpdateProgress(context.Background(), job.ID, 35.0, "Mengekstrak rentang halaman...")

		outFilename := fmt.Sprintf("split_%s_%d.pdf", strings.TrimSuffix(filepath.Base(filename), filepath.Ext(filename)), time.Now().Unix())
		outPath := s.getOutPath(outFilename)
		downloadURL := fmt.Sprintf("/api/v1/utility/jobs/%s/download", job.ID)
		defer os.Remove(inTempPath)

		pyScript := `
import sys
from pypdf import PdfReader, PdfWriter

in_pdf = sys.argv[1]
out_pdf = sys.argv[2]
ranges_str = sys.argv[3] if len(sys.argv) > 3 else ""

reader = PdfReader(in_pdf)
writer = PdfWriter()
total = len(reader.pages)

pages_to_extract = []
if ranges_str:
    for part in ranges_str.split(','):
        part = part.strip()
        if '-' in part:
            s, e = part.split('-')
            s_num = max(1, int(s))
            e_num = min(total, int(e))
            for p in range(s_num, e_num + 1):
                pages_to_extract.append(p - 1)
        elif part.isdigit():
            p_num = int(part)
            if 1 <= p_num <= total:
                pages_to_extract.append(p_num - 1)
else:
    pages_to_extract = list(range(total))

for p_idx in sorted(list(set(pages_to_extract))):
    writer.add_page(reader.pages[p_idx])

with open(out_pdf, 'wb') as f:
    writer.write(f)
print("SUCCESS")
`
		cmd := exec.CommandContext(jobCtx, util.FindPythonExecutable(), "-c", pyScript, inTempPath, outPath, splitRanges)
		out, err := cmd.CombinedOutput()
		duration := time.Since(startTime).Seconds()

		if jobCtx.Err() != nil {
			_ = s.repo.MarkCancelled(context.Background(), job.ID)
			_ = os.Remove(outPath)
			return
		}

		if err != nil {
			_ = s.repo.MarkFailed(context.Background(), job.ID, fmt.Sprintf("Split error: %s", string(out)), duration)
			return
		}

		fi, _ := os.Stat(outPath)
		outSize := int64(0)
		if fi != nil {
			outSize = fi.Size()
		}

		meta, _ := json.Marshal(map[string]interface{}{
			"split_ranges": splitRanges,
			"output_size":  outSize,
		})

		_ = s.repo.MarkCompleted(context.Background(), job.ID, outPath, downloadURL, meta, duration)
	}()

	return job, nil
}

// -------------------------------------------------------------
// 6. PPTX Auto Summary Worker
// -------------------------------------------------------------
func (s *ToolJobService) SubmitSummarizePPTX(
	ctx context.Context,
	userID *uuid.UUID,
	savedFilePaths []string,
	batchName string,
	totalSize int64,
) (*model.ToolJob, error) {
	if batchName == "" {
		batchName = "Laporan_PPTX_Batch"
	}

	job := &model.ToolJob{
		ID:              uuid.New(),
		UserID:          userID,
		ToolType:        "pptx-summary",
		FileName:        batchName,
		FileSize:        totalSize,
		Status:          "pending",
		ProgressPercent: 0,
		CurrentStep:     "Menyiapkan file presentasi...",
	}

	if err := s.repo.Create(ctx, job); err != nil {
		return nil, err
	}

	jobCtx, cancel := context.WithCancel(context.Background())
	s.cancels.Store(job.ID.String(), cancel)

	go func() {
		defer s.cancels.Delete(job.ID.String())
		s.sem <- struct{}{}
		defer func() { <-s.sem }()

		startTime := time.Now()
		_ = s.repo.MarkStarted(context.Background(), job.ID)
		_ = s.repo.UpdateProgress(context.Background(), job.ID, 20.0, "Mengekstrak slide & teks presentasi...")

		excelFilename := fmt.Sprintf("Summary_%s_%d.xlsx", strings.ReplaceAll(batchName, " ", "_"), time.Now().Unix())
		outExcelPath := s.getOutPath(excelFilename)
		downloadURL := fmt.Sprintf("/api/v1/utility/jobs/%s/download", job.ID)

		jobDir := filepath.Dir(savedFilePaths[0])
		defer os.RemoveAll(jobDir)

		scriptPath := filepath.Join("scripts", "pptx_summary.py")
		if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
			scriptPath = filepath.Join("backend", "scripts", "pptx_summary.py")
			if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
				scriptPath = "/app/scripts/pptx_summary.py"
			}
		}

		_ = s.repo.UpdateProgress(context.Background(), job.ID, 50.0, "Analisis isi presentasi oleh AI Model...")

		cmd := exec.CommandContext(jobCtx, util.FindPythonExecutable(), scriptPath, "--input-dir", jobDir, "--output-excel", outExcelPath)
		cmd.Env = append(os.Environ(), "PYTHONIOENCODING=utf-8", "PYTHONUTF8=1")
		out, err := cmd.CombinedOutput()
		duration := time.Since(startTime).Seconds()

		if jobCtx.Err() != nil {
			_ = s.repo.MarkCancelled(context.Background(), job.ID)
			_ = os.Remove(outExcelPath)
			return
		}

		if err != nil {
			_ = s.repo.MarkFailed(context.Background(), job.ID, fmt.Sprintf("PPTX Summary error: %s", string(out)), duration)
			return
		}

		_ = s.repo.UpdateProgress(context.Background(), job.ID, 85.0, "Menyusun matriks Excel & summary ringkasan...")

		fi, _ := os.Stat(outExcelPath)
		outSize := int64(0)
		if fi != nil {
			outSize = fi.Size()
		}

		meta, _ := json.Marshal(map[string]interface{}{
			"files_count": len(savedFilePaths),
			"output_size": outSize,
			"excel_file":  excelFilename,
		})

		_ = s.repo.MarkCompleted(context.Background(), job.ID, outExcelPath, downloadURL, meta, duration)
	}()

	return job, nil
}
