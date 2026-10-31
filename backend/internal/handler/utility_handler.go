package handler

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/labstack/echo/v4"
	"pe-portal/internal/model"
	"pe-portal/internal/repository"
	"pe-portal/internal/service"
	"pe-portal/internal/util"
)

type WITranslateJob struct {
	JobID           string    `json:"job_id"`
	Status          string    `json:"status"` // "processing", "completed", "failed"
	CurrentPage     int       `json:"current_page"`
	TotalPages      int       `json:"total_pages"`
	ProgressPercent float64   `json:"progress_percent"`
	Message         string    `json:"message"`
	DownloadURL     string    `json:"download_url,omitempty"`
	Filename        string    `json:"filename"`
	TranslatedFile  string    `json:"translated_file,omitempty"`
	TranslatedCount int       `json:"translated_count"`
	DurationSec     float64   `json:"duration_sec"`
	Error           string    `json:"error,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
}

type UtilityHandler struct {
	llmRepo        *repository.LLMRepository
	wiRepo         *repository.WITranslatorRepository
	toolJobService *service.ToolJobService
	wiJobs         sync.Map
	workerSem      chan struct{}
}

func NewUtilityHandler(llmRepo *repository.LLMRepository, wiRepo *repository.WITranslatorRepository, toolJobService ...*service.ToolJobService) *UtilityHandler {
	var ts *service.ToolJobService
	if len(toolJobService) > 0 {
		ts = toolJobService[0]
	}
	return &UtilityHandler{
		llmRepo:        llmRepo,
		wiRepo:         wiRepo,
		toolJobService: ts,
		workerSem:      make(chan struct{}, 2), // max 2 concurrent document translations
	}
}

// GetStatus checks if local Python, Ghostscript, and FFmpeg VAAPI utilities are available
func (h *UtilityHandler) GetStatus(c echo.Context) error {
	pythonBin := findPythonExecutable()
	pythonPath, errPy := exec.LookPath(pythonBin)
	gsPath, errGs := exec.LookPath("gs")
	ffmpegPath, errFfmpeg := exec.LookPath("ffmpeg")

	// Check if Pillow and pypdf are available in python
	hasPillow := false
	hasPyPDF := false
	if errPy == nil || pythonBin != "" {
		cmdPil := exec.Command(pythonBin, "-c", "import PIL; print('OK')")
		if out, err := cmdPil.Output(); err == nil && len(out) >= 2 && string(out)[:2] == "OK" {
			hasPillow = true
		}
		cmdPdf := exec.Command(pythonBin, "-c", "import pypdf; print('OK')")
		if out, err := cmdPdf.Output(); err == nil && len(out) >= 2 && string(out)[:2] == "OK" {
			hasPyPDF = true
		}
	}

	hasVaapi := false
	if _, err := os.Stat("/dev/dri/renderD128"); err == nil && errFfmpeg == nil {
		hasVaapi = true
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"python_available":      errPy == nil,
		"python_path":           pythonPath,
		"pillow_available":      hasPillow,
		"pypdf_available":       hasPyPDF,
		"ghostscript_available": errGs == nil,
		"ghostscript_path":      gsPath,
		"ffmpeg_available":      errFfmpeg == nil,
		"ffmpeg_path":           ffmpegPath,
		"vaapi_available":       hasVaapi,
		"local_engine":          "SEIN Local Offline Engine (Python & GS)",
	})
}

// RemoveBackground executes local Python Pillow script without external APIs
func (h *UtilityHandler) RemoveBackground(c echo.Context) error {
	file, err := c.FormFile("image")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "No image file provided"})
	}

	src, err := file.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to open image"})
	}
	defer src.Close()

	// Parameters
	tolerance := c.FormValue("tolerance")
	if tolerance == "" {
		tolerance = "35"
	}
	bgColor := c.FormValue("bg_color")
	if bgColor == "" {
		bgColor = "auto"
	}
	feather := c.FormValue("feather")
	if feather == "" {
		feather = "2"
	}

	// Create temp files
	tempDir := os.TempDir()
	now := time.Now().UnixNano()
	inPath := filepath.Join(tempDir, fmt.Sprintf("in_%d%s", now, filepath.Ext(file.Filename)))
	outPath := filepath.Join(tempDir, fmt.Sprintf("out_%d.png", now))
	defer os.Remove(inPath)
	defer os.Remove(outPath)

	dst, err := os.Create(inPath)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to save temp input"})
	}
	if _, err := io.Copy(dst, src); err != nil {
		dst.Close()
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to write temp input"})
	}
	dst.Close()

	// Locate remove_bg.py
	scriptPath := filepath.Join("scripts", "remove_bg.py")
	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		// Try backend/scripts
		scriptPath = filepath.Join("backend", "scripts", "remove_bg.py")
		if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
			scriptPath = "/app/scripts/remove_bg.py"
		}
	}

	cmd := exec.Command(findPythonExecutable(), scriptPath, inPath, outPath, tolerance, bgColor, feather)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"message": fmt.Sprintf("Python local processing failed: %v", err),
			"details": string(output),
		})
	}

	return c.Attachment(outPath, fmt.Sprintf("nobg_%s.png", file.Filename))
}

// findPDFHandlerScript locates the pdf_handler.py script
func findPDFHandlerScript() string {
	candidates := []string{
		filepath.Join("scripts", "pdf_handler.py"),
		filepath.Join("backend", "scripts", "pdf_handler.py"),
		"/app/scripts/pdf_handler.py",
	}
	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil {
			return p
		}
	}
	return "scripts/pdf_handler.py"
}

// formatPDFErrorMessage formats clean error message, parsing python json error if present
func formatPDFErrorMessage(action string, output string, err error) string {
	var errData map[string]interface{}
	outStr := strings.TrimSpace(output)
	sIdx := strings.Index(outStr, "{")
	eIdx := strings.LastIndex(outStr, "}")
	if sIdx >= 0 && eIdx > sIdx {
		if jsonErr := json.Unmarshal([]byte(outStr[sIdx:eIdx+1]), &errData); jsonErr == nil {
			if errMsg, ok := errData["error"].(string); ok && errMsg != "" {
				return fmt.Sprintf("PDF %s gagal: %s", action, errMsg)
			}
		}
	}
	return fmt.Sprintf("PDF %s failed: %v", action, err)
}

// CompressPDF executes high-resilience Python PDF compression (DRM/NASCA resilient)
func (h *UtilityHandler) CompressPDF(c echo.Context) error {
	file, err := c.FormFile("document")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "No document provided"})
	}

	src, err := file.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to open document"})
	}
	defer src.Close()

	quality := c.FormValue("quality") // screen, ebook, printer, prepress
	if quality == "" {
		quality = "ebook" // 150 dpi standard
	}

	tempDir := os.TempDir()
	now := time.Now().UnixNano()
	inPath := filepath.Join(tempDir, fmt.Sprintf("in_%d.pdf", now))
	outPath := filepath.Join(tempDir, fmt.Sprintf("compressed_%d.pdf", now))
	defer os.Remove(inPath)
	defer os.Remove(outPath)

	dst, err := os.Create(inPath)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to save temp file"})
	}
	if _, err := io.Copy(dst, src); err != nil {
		dst.Close()
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to write temp file"})
	}
	dst.Close()

	pythonBin := findPythonExecutable()
	scriptPath := findPDFHandlerScript()

	// 1. Run Python PDF Engine (Lenient & DRM/NASCA resilient)
	cmd := exec.Command(pythonBin, scriptPath, "compress",
		"--input", inPath,
		"--output", outPath,
		"--quality", quality,
	)
	cmd.Env = append(os.Environ(), "PYTHONIOENCODING=utf-8", "PYTHONUTF8=1")
	output, err := cmd.CombinedOutput()

	if err == nil {
		if fiNew, statErr := os.Stat(outPath); statErr == nil && fiNew.Size() > 0 {
			fiOrig, _ := os.Stat(inPath)
			c.Response().Header().Set("X-Original-Size", strconv.FormatInt(fiOrig.Size(), 10))
			c.Response().Header().Set("X-Compressed-Size", strconv.FormatInt(fiNew.Size(), 10))
			return c.Attachment(outPath, fmt.Sprintf("compressed_%s", file.Filename))
		}
	}

	// 2. Fallback to Ghostscript if available
	setting := "/ebook"
	switch quality {
	case "screen":
		setting = "/screen"
	case "printer":
		setting = "/printer"
	case "prepress":
		setting = "/prepress"
	}
	cmdGs := exec.Command("gs", "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.4",
		fmt.Sprintf("-dPDFSETTINGS=%s", setting),
		"-dNOPAUSE", "-dQUIET", "-dBATCH",
		fmt.Sprintf("-sOutputFile=%s", outPath), inPath)
	outGs, errGs := cmdGs.CombinedOutput()
	if errGs == nil {
		fiOrig, _ := os.Stat(inPath)
		fiNew, _ := os.Stat(outPath)
		c.Response().Header().Set("X-Original-Size", strconv.FormatInt(fiOrig.Size(), 10))
		c.Response().Header().Set("X-Compressed-Size", strconv.FormatInt(fiNew.Size(), 10))
		return c.Attachment(outPath, fmt.Sprintf("compressed_%s", file.Filename))
	}

	return c.JSON(http.StatusInternalServerError, map[string]string{
		"message": formatPDFErrorMessage("compression", string(output), err),
		"details": string(output) + "\n" + string(outGs),
	})
}

// MergePDF merges multiple PDF files into one using resilient Python Engine
func (h *UtilityHandler) MergePDF(c echo.Context) error {
	form, err := c.MultipartForm()
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "No documents provided"})
	}

	files := form.File["documents"]
	if len(files) < 2 {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "Please provide at least 2 PDF documents to merge"})
	}

	tempDir := os.TempDir()
	now := time.Now().UnixNano()
	var inPaths []string
	defer func() {
		for _, p := range inPaths {
			_ = os.Remove(p)
		}
	}()

	for idx, file := range files {
		src, err := file.Open()
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{"message": fmt.Sprintf("Failed to open %s", file.Filename)})
		}
		inPath := filepath.Join(tempDir, fmt.Sprintf("merge_%d_%d.pdf", now, idx))
		dst, err := os.Create(inPath)
		if err != nil {
			src.Close()
			return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to create temp file"})
		}
		_, _ = io.Copy(dst, src)
		src.Close()
		dst.Close()
		inPaths = append(inPaths, inPath)
	}

	outPath := filepath.Join(tempDir, fmt.Sprintf("merged_%d.pdf", now))
	defer os.Remove(outPath)

	pythonBin := findPythonExecutable()
	scriptPath := findPDFHandlerScript()

	// 1. Run Python PDF Engine
	args := []string{scriptPath, "merge", "--inputs"}
	args = append(args, inPaths...)
	args = append(args, "--output", outPath)

	cmd := exec.Command(pythonBin, args...)
	cmd.Env = append(os.Environ(), "PYTHONIOENCODING=utf-8", "PYTHONUTF8=1")
	output, err := cmd.CombinedOutput()
	if err == nil {
		if fiNew, statErr := os.Stat(outPath); statErr == nil && fiNew.Size() > 0 {
			return c.Attachment(outPath, "merged_document.pdf")
		}
	}

	// 2. Fallback to Ghostscript
	gsArgs := []string{"-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.4", "-dNOPAUSE", "-dQUIET", "-dBATCH", fmt.Sprintf("-sOutputFile=%s", outPath)}
	gsArgs = append(gsArgs, inPaths...)
	cmdGs := exec.Command("gs", gsArgs...)
	outGs, errGs := cmdGs.CombinedOutput()
	if errGs == nil {
		return c.Attachment(outPath, "merged_document.pdf")
	}

	return c.JSON(http.StatusInternalServerError, map[string]string{
		"message": formatPDFErrorMessage("merge", string(output), err),
		"details": string(output) + "\n" + string(outGs),
	})
}

// SplitPDF extracts a page range from a PDF file using resilient Python Engine
func (h *UtilityHandler) SplitPDF(c echo.Context) error {
	file, err := c.FormFile("document")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "No document provided"})
	}

	src, err := file.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to open document"})
	}
	defer src.Close()

	firstPage := c.FormValue("first_page")
	lastPage := c.FormValue("last_page")
	pages := c.FormValue("pages")
	if firstPage == "" {
		firstPage = "1"
	}
	if lastPage == "" {
		lastPage = firstPage
	}

	tempDir := os.TempDir()
	now := time.Now().UnixNano()
	inPath := filepath.Join(tempDir, fmt.Sprintf("split_in_%d.pdf", now))
	outPath := filepath.Join(tempDir, fmt.Sprintf("split_out_%d.pdf", now))
	defer os.Remove(inPath)
	defer os.Remove(outPath)

	dst, err := os.Create(inPath)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to save temp file"})
	}
	if _, err := io.Copy(dst, src); err != nil {
		dst.Close()
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to write temp file"})
	}
	dst.Close()

	pythonBin := findPythonExecutable()
	scriptPath := findPDFHandlerScript()

	downloadName := fmt.Sprintf("split_%s", file.Filename)
	if pages != "" {
		downloadName = fmt.Sprintf("split_p%s_%s", strings.ReplaceAll(strings.ReplaceAll(pages, " ", ""), ",", "_"), file.Filename)
	} else {
		downloadName = fmt.Sprintf("split_pages_%s-%s_%s", firstPage, lastPage, file.Filename)
	}

	// 1. Run Python PDF Engine
	pyArgs := []string{scriptPath, "split", "--input", inPath, "--output", outPath}
	if pages != "" {
		pyArgs = append(pyArgs, "--pages", pages)
	} else {
		pyArgs = append(pyArgs, "--first-page", firstPage, "--last-page", lastPage)
	}

	cmd := exec.Command(pythonBin, pyArgs...)
	cmd.Env = append(os.Environ(), "PYTHONIOENCODING=utf-8", "PYTHONUTF8=1")
	output, err := cmd.CombinedOutput()
	if err == nil {
		if fiNew, statErr := os.Stat(outPath); statErr == nil && fiNew.Size() > 0 {
			return c.Attachment(outPath, downloadName)
		}
	}

	// 2. Fallback to Ghostscript
	cmdGs := exec.Command("gs", "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.4",
		fmt.Sprintf("-dFirstPage=%s", firstPage),
		fmt.Sprintf("-dLastPage=%s", lastPage),
		"-dNOPAUSE", "-dQUIET", "-dBATCH",
		fmt.Sprintf("-sOutputFile=%s", outPath), inPath)
	outGs, errGs := cmdGs.CombinedOutput()
	if errGs == nil {
		return c.Attachment(outPath, downloadName)
	}

	return c.JSON(http.StatusInternalServerError, map[string]string{
		"message": formatPDFErrorMessage("split", string(output), err),
		"details": string(output) + "\n" + string(outGs),
	})
}

// CompressVideo compresses uploaded video using h264_vaapi hardware acceleration or fast CPU fallback
func (h *UtilityHandler) CompressVideo(c echo.Context) error {
	file, err := c.FormFile("video")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "No video file provided"})
	}

	src, err := file.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to open video file"})
	}
	defer src.Close()

	quality := c.FormValue("quality") // "high", "medium", "low"
	if quality == "" {
		quality = "medium"
	}
	resolution := c.FormValue("resolution") // "original", "1080p", "720p", "480p"
	if resolution == "" {
		resolution = "original"
	}
	encoderMode := c.FormValue("encoder") // "auto", "vaapi", "cpu"
	if encoderMode == "" {
		encoderMode = "auto"
	}
	muteAudio := c.FormValue("mute_audio") == "true"

	// Create temp directory for processing
	tempDir := os.TempDir()
	now := time.Now().UnixNano()
	inExt := strings.ToLower(filepath.Ext(file.Filename))
	if inExt == "" {
		inExt = ".mp4"
	}
	inPath := filepath.Join(tempDir, fmt.Sprintf("vin_%d%s", now, inExt))
	outPath := filepath.Join(tempDir, fmt.Sprintf("vout_%d.mp4", now))
	defer os.Remove(inPath)
	defer os.Remove(outPath)

	dst, err := os.Create(inPath)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to create temp input file"})
	}
	if _, err := io.Copy(dst, src); err != nil {
		dst.Close()
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to save input video"})
	}
	dst.Close()

	// Determine resolution filter
	var scaleFilter string
	switch resolution {
	case "1080p":
		scaleFilter = "scale=-2:1080"
	case "720p":
		scaleFilter = "scale=-2:720"
	case "480p":
		scaleFilter = "scale=-2:480"
	default:
		scaleFilter = ""
	}

	// Determine QP/CRF based on quality
	var qpVaapi, crfX264 string
	switch quality {
	case "high":
		qpVaapi = "24"
		crfX264 = "23"
	case "low":
		qpVaapi = "33"
		crfX264 = "32"
	default: // medium
		qpVaapi = "28"
		crfX264 = "28"
	}

	usedEncoder := "libx264"

	// Attempt VAAPI hardware acceleration first if requested or auto
	if encoderMode == "auto" || encoderMode == "vaapi" {
		if _, err := os.Stat("/dev/dri/renderD128"); err == nil {
			var vfParts []string
			if scaleFilter != "" {
				vfParts = append(vfParts, scaleFilter)
			}
			vfParts = append(vfParts, "format=nv12", "hwupload")
			vfStr := strings.Join(vfParts, ",")

			args := []string{
				"-y",
				"-vaapi_device", "/dev/dri/renderD128",
				"-i", inPath,
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

			cmd := exec.Command("ffmpeg", args...)
			output, err := cmd.CombinedOutput()
			if err == nil {
				if fi, statErr := os.Stat(outPath); statErr == nil && fi.Size() > 0 {
					usedEncoder = "h264_vaapi"
				}
			} else {
				fmt.Printf("[VideoCompress] VAAPI encoding notice: %v (output: %s)\n", err, string(output))
			}
		}
	}

	// Fallback to CPU libx264 veryfast if VAAPI wasn't used or failed
	if usedEncoder != "h264_vaapi" {
		var args []string
		args = append(args, "-y", "-i", inPath)

		if scaleFilter != "" {
			args = append(args, "-vf", scaleFilter)
		}

		args = append(args,
			"-c:v", "libx264",
			"-preset", "veryfast",
			"-crf", crfX264,
			"-pix_fmt", "yuv420p",
		)

		if muteAudio {
			args = append(args, "-an")
		} else {
			args = append(args, "-c:a", "aac", "-b:a", "128k")
		}
		args = append(args, outPath)

		cmd := exec.Command("ffmpeg", args...)
		output, err := cmd.CombinedOutput()
		if err != nil {
			return c.JSON(http.StatusInternalServerError, map[string]string{
				"message": fmt.Sprintf("Video compression failed: %v", err),
				"details": string(output),
			})
		}
		usedEncoder = "libx264"
	}

	// Calculate statistics
	inInfo, _ := os.Stat(inPath)
	outInfo, _ := os.Stat(outPath)
	var inSize, outSize int64
	if inInfo != nil {
		inSize = inInfo.Size()
	}
	if outInfo != nil {
		outSize = outInfo.Size()
	}

	c.Response().Header().Set("X-Encoder-Used", usedEncoder)
	c.Response().Header().Set("X-Original-Size", fmt.Sprintf("%d", inSize))
	c.Response().Header().Set("X-Compressed-Size", fmt.Sprintf("%d", outSize))
	c.Response().Header().Set("Access-Control-Expose-Headers", "X-Encoder-Used, X-Original-Size, X-Compressed-Size")

	cleanBaseName := strings.TrimSuffix(file.Filename, filepath.Ext(file.Filename))
	downloadName := fmt.Sprintf("%s_compressed.mp4", cleanBaseName)

	return c.Attachment(outPath, downloadName)
}

// SummarizePPTX receives multiple .pptx files, extracts defect conclusions and countermeasures using Python script,
// and returns the extracted table data along with the generated Excel download filename.
func (h *UtilityHandler) SummarizePPTX(c echo.Context) error {
	form, err := c.MultipartForm()
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "Failed to parse multipart form"})
	}

	files := form.File["files"]
	if len(files) == 0 {
		files = form.File["pptx_files"]
	}
	if len(files) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "No PowerPoint (.pptx) files provided"})
	}

	// Create temp directory for this batch
	now := time.Now().UnixNano()
	jobDir := filepath.Join(os.TempDir(), fmt.Sprintf("pptx_batch_%d", now))
	if err := os.MkdirAll(jobDir, 0755); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to create temp job directory"})
	}
	defer os.RemoveAll(jobDir)

	// Save all uploaded files to jobDir
	var savedPaths []string
	for _, fileHeader := range files {
		if !strings.HasSuffix(strings.ToLower(fileHeader.Filename), ".pptx") {
			continue
		}
		src, err := fileHeader.Open()
		if err != nil {
			continue
		}
		dstPath := filepath.Join(jobDir, filepath.Base(fileHeader.Filename))
		dst, err := os.Create(dstPath)
		if err == nil {
			io.Copy(dst, src)
			dst.Close()
			savedPaths = append(savedPaths, dstPath)
		}
		src.Close()
	}

	if len(savedPaths) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "No valid .pptx files could be read"})
	}

	// Prepare output excel path in file storage or temp
	storageDir := os.Getenv("FILE_STORAGE_PATH")
	if storageDir == "" {
		storageDir = "/data/files"
	}
	if _, err := os.Stat(storageDir); os.IsNotExist(err) {
		storageDir = filepath.Join(os.TempDir(), "pe_summary_reports")
		_ = os.MkdirAll(storageDir, 0755)
	}

	excelFilename := fmt.Sprintf("Summary_Report_%s.xlsx", time.Now().Format("20060102_150405"))
	outExcelPath := filepath.Join(storageDir, excelFilename)

	// Locate pptx_summary.py
	scriptPath := filepath.Join("scripts", "pptx_summary.py")
	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		scriptPath = filepath.Join("backend", "scripts", "pptx_summary.py")
		if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
			scriptPath = "/app/scripts/pptx_summary.py"
		}
	}

	pythonBin := findPythonExecutable()

	cmdArgs := []string{scriptPath, "--input-dir", jobDir, "--output-excel", outExcelPath}
	cmd := exec.Command(pythonBin, cmdArgs...)
	cmd.Env = append(os.Environ(),
		"PYTHONIOENCODING=utf-8",
		"PYTHONUTF8=1",
	)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]interface{}{
			"message": fmt.Sprintf("Python execution failed: %v", err),
			"details": string(output),
		})
	}

	// Parse JSON from output
	var result map[string]interface{}
	outStr := strings.TrimSpace(string(output))
	startIdx := strings.Index(outStr, "{")
	endIdx := strings.LastIndex(outStr, "}")
	if startIdx >= 0 && endIdx > startIdx {
		jsonStr := outStr[startIdx : endIdx+1]
		if err := json.Unmarshal([]byte(jsonStr), &result); err == nil {
			// Check what the actual excel file was named
			actualExcelName := excelFilename
			if nameFromRes, ok := result["excel_file"].(string); ok && nameFromRes != "" {
				actualExcelName = nameFromRes
			}
			result["download_url"] = fmt.Sprintf("/utility/pptx-summary/download/%s", actualExcelName)
			return c.JSON(http.StatusOK, result)
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":      true,
		"raw_output":   outStr,
		"download_url": fmt.Sprintf("/utility/pptx-summary/download/%s", excelFilename),
	})
}

// DownloadPPTXSummary serves the generated excel summary report
func (h *UtilityHandler) DownloadPPTXSummary(c echo.Context) error {
	filename := c.Param("filename")
	if filename == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "Filename required"})
	}

	// Clean filename to prevent path traversal
	cleanName := filepath.Base(filename)
	storageDir := os.Getenv("FILE_STORAGE_PATH")
	if storageDir == "" {
		storageDir = "/data/files"
	}

	filePath := filepath.Join(storageDir, cleanName)
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		// Try temp fallback
		filePath = filepath.Join(os.TempDir(), "pe_summary_reports", cleanName)
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			filePath = filepath.Join(os.TempDir(), cleanName)
			if _, err := os.Stat(filePath); os.IsNotExist(err) {
				return c.JSON(http.StatusNotFound, map[string]string{"message": "Summary file not found or expired"})
			}
		}
	}

	c.Response().Header().Set(echo.HeaderContentType, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	return c.Attachment(filePath, cleanName)
}

// findPythonExecutable detects the python binary, prioritizing "python" on Windows
func findPythonExecutable() string {
	return util.FindPythonExecutable()
}

// TranslateWIPDF handles upload of Working Instruction PDF and kicks off batch translation
func (h *UtilityHandler) TranslateWIPDF(c echo.Context) error {
	file, err := c.FormFile("file")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "No file uploaded: " + err.Error()})
	}

	targetLang := c.FormValue("target_lang")
	if targetLang == "" {
		targetLang = "id"
	}
	mode := c.FormValue("mode")
	if mode == "" {
		mode = "replace"
	}

	jobID := uuid.New().String()
	tempDir := filepath.Join(os.TempDir(), "wi_translator", jobID)
	if err := os.MkdirAll(tempDir, 0755); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to create working directory: " + err.Error()})
	}

	src, err := file.Open()
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "Failed to open uploaded file: " + err.Error()})
	}
	defer src.Close()

	inputPDFPath := filepath.Join(tempDir, filepath.Base(file.Filename))
	dst, err := os.Create(inputPDFPath)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to save file: " + err.Error()})
	}
	if _, err = io.Copy(dst, src); err != nil {
		dst.Close()
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to write file: " + err.Error()})
	}
	dst.Close()

	// Storage directory for translated files
	storageDir := os.Getenv("FILE_STORAGE_PATH")
	if storageDir == "" {
		storageDir = "/data/files"
	}
	if _, err := os.Stat(storageDir); os.IsNotExist(err) {
		storageDir = filepath.Join(os.TempDir(), "pe_translated_wi")
		_ = os.MkdirAll(storageDir, 0755)
	}

	ext := filepath.Ext(file.Filename)
	base := strings.TrimSuffix(filepath.Base(file.Filename), ext)
	outFilename := fmt.Sprintf("[%s]_%s_%s%s", strings.ToUpper(targetLang), base, time.Now().Format("20060102_150405"), ext)
	outPDFPath := filepath.Join(storageDir, outFilename)

	job := &WITranslateJob{
		JobID:           jobID,
		Status:          "processing",
		CurrentPage:     0,
		TotalPages:      0,
		ProgressPercent: 0,
		Message:         "Inisialisasi dokumen...",
		Filename:        file.Filename,
		TranslatedFile:  outFilename,
		CreatedAt:       time.Now(),
	}
	h.wiJobs.Store(jobID, job)

	// Locate python script
	scriptPath := filepath.Join("scripts", "pdf_wi_translator.py")
	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		scriptPath = filepath.Join("backend", "scripts", "pdf_wi_translator.py")
		if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
			scriptPath = "/app/scripts/pdf_wi_translator.py"
		}
	}

	pythonBin := findPythonExecutable()

	// Check active LLM config
	var llmURL, llmModel, llmKey string
	if h.llmRepo != nil {
		if cfg, _, err := h.llmRepo.GetActiveLLM(context.Background(), nil); err == nil && cfg != nil && cfg.IsActive {
			llmURL = cfg.BaseURL
			llmModel = cfg.ModelName
			llmKey = cfg.APIKey
		}
	}

	// Launch async translation worker
	go func() {
		cmdArgs := []string{
			scriptPath,
			"--input-file", inputPDFPath,
			"--output-pdf", outPDFPath,
			"--target-lang", targetLang,
			"--mode", mode,
			"--batch-size", "5",
		}
		if llmURL != "" {
			cmdArgs = append(cmdArgs, "--llm-url", llmURL)
		}
		if llmModel != "" {
			cmdArgs = append(cmdArgs, "--llm-model", llmModel)
		}
		if llmKey != "" {
			cmdArgs = append(cmdArgs, "--llm-api-key", llmKey)
		}

		cmd := exec.Command(pythonBin, cmdArgs...)
		cmd.Env = append(os.Environ(),
			"PYTHONIOENCODING=utf-8",
			"PYTHONUTF8=1",
		)

		var stderrBuf bytes.Buffer
		cmd.Stderr = &stderrBuf

		stdout, err := cmd.StdoutPipe()
		if err != nil {
			job.Status = "failed"
			job.Error = "Failed to open stdout pipe: " + err.Error()
			job.Message = job.Error
			return
		}
		if err := cmd.Start(); err != nil {
			job.Status = "failed"
			job.Error = "Failed to start python script: " + err.Error()
			job.Message = job.Error
			return
		}

		// ponytail: defensive 1MB buffer for streaming progress
		scanner := bufio.NewScanner(stdout)
		scanBuf := make([]byte, 64*1024)
		scanner.Buffer(scanBuf, 1024*1024)
		for scanner.Scan() {
			line := strings.TrimSpace(scanner.Text())
			if line == "" {
				continue
			}
			var progressData map[string]interface{}
			if err := json.Unmarshal([]byte(line), &progressData); err == nil {
				if curr, ok := progressData["current"].(float64); ok {
					job.CurrentPage = int(curr)
				}
				if tot, ok := progressData["total"].(float64); ok {
					job.TotalPages = int(tot)
				}
				if pct, ok := progressData["percent"].(float64); ok {
					job.ProgressPercent = pct
				}
				if msg, ok := progressData["message"].(string); ok && msg != "" {
					job.Message = msg
				}
				if succ, ok := progressData["success"].(bool); ok && succ {
					job.Status = "completed"
					job.ProgressPercent = 100.0
					if count, ok := progressData["translated_blocks"].(float64); ok {
						job.TranslatedCount = int(count)
					}
					if dur, ok := progressData["duration_sec"].(float64); ok {
						job.DurationSec = dur
					}
					job.DownloadURL = fmt.Sprintf("/api/v1/utility/translate-wi-pdf/download/%s", outFilename)
				} else if errVal, ok := progressData["error"].(string); ok && errVal != "" {
					job.Status = "failed"
					job.Error = errVal
					job.Message = "Gagal: " + errVal
				}
			}
		}

		if err := cmd.Wait(); err != nil {
			if job.Status != "completed" {
				job.Status = "failed"
				if job.Error == "" {
					stderrStr := strings.TrimSpace(stderrBuf.String())
					if stderrStr != "" {
						lines := strings.Split(stderrStr, "\n")
						job.Error = strings.TrimSpace(lines[len(lines)-1])
					} else {
						job.Error = "Python process error: " + err.Error()
					}
					job.Message = job.Error
				}
			}
		} else {
			if job.Status != "failed" {
				job.Status = "completed"
				job.ProgressPercent = 100.0
				job.DownloadURL = fmt.Sprintf("/api/v1/utility/translate-wi-pdf/download/%s", outFilename)
			}
		}
	}()

	return c.JSON(http.StatusOK, map[string]interface{}{
		"job_id":  jobID,
		"status":  "processing",
		"message": "Penerjemahan dokumen dimulai di latar belakang...",
	})
}

// GetTranslateWIStatus returns live translation progress
func (h *UtilityHandler) GetTranslateWIStatus(c echo.Context) error {
	jobID := c.Param("jobId")
	val, ok := h.wiJobs.Load(jobID)
	if !ok {
		return c.JSON(http.StatusNotFound, map[string]string{"message": "Job not found"})
	}
	job := val.(*WITranslateJob)
	return c.JSON(http.StatusOK, job)
}

// DownloadTranslatedWIPDF serves the translated PDF document
func (h *UtilityHandler) DownloadTranslatedWIPDF(c echo.Context) error {
	filename := c.Param("filename")
	if filename == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "Filename required"})
	}

	// ponytail: unescape URL encoded characters (e.g. %5BID%5D -> [ID], %20 -> space)
	if decoded, err := url.PathUnescape(filename); err == nil && decoded != "" {
		filename = decoded
	} else if decoded, err := url.QueryUnescape(filename); err == nil && decoded != "" {
		filename = decoded
	}

	cleanName := filepath.Base(filename)
	storageDir := os.Getenv("FILE_STORAGE_PATH")
	if storageDir == "" {
		storageDir = "/data/files"
	}

	filePath := filepath.Join(storageDir, cleanName)
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		filePath = filepath.Join(os.TempDir(), "pe_translated_wi", cleanName)
		if _, err := os.Stat(filePath); os.IsNotExist(err) {
			filePath = filepath.Join(os.TempDir(), cleanName)
			if _, err := os.Stat(filePath); os.IsNotExist(err) {
				return c.JSON(http.StatusNotFound, map[string]string{"message": "Translated PDF not found or expired"})
			}
		}
	}

	return c.Attachment(filePath, cleanName)
}

// processWIJob runs pdf_wi_translator.py for a specific persistent job in background
func (h *UtilityHandler) processWIJob(job *model.WITranslationJob) {
	if h.wiRepo == nil {
		return
	}

	h.workerSem <- struct{}{}
	defer func() { <-h.workerSem }()

	ctx := context.Background()
	_ = h.wiRepo.MarkProcessing(ctx, job.ID)
	startTime := time.Now()
	if job.StartedAt != nil {
		startTime = *job.StartedAt
	}

	storageDir := os.Getenv("FILE_STORAGE_PATH")
	if storageDir == "" {
		if runtime.GOOS == "windows" {
			storageDir = filepath.Join("data", "files")
		} else {
			storageDir = "/data/files"
		}
	}
	if err := os.MkdirAll(storageDir, 0755); err != nil {
		storageDir = filepath.Join(".", "data", "files")
		_ = os.MkdirAll(storageDir, 0755)
	}

	timestamp := time.Now().Format("20060102_150405")
	cleanBase := strings.TrimSuffix(filepath.Base(job.FileName), filepath.Ext(job.FileName))
	outFilename := fmt.Sprintf("[%s]_WI_%s_%s.pdf", strings.ToUpper(job.TargetLang), cleanBase, timestamp)
	outPath := filepath.Join(storageDir, outFilename)

	scriptPath := filepath.Join("scripts", "pdf_wi_translator.py")
	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		scriptPath = filepath.Join("backend", "scripts", "pdf_wi_translator.py")
		if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
			scriptPath = "/app/scripts/pdf_wi_translator.py"
		}
	}

	pythonBin := util.FindPythonExecutable()

	// ponytail: resolve input file path defensively (support absolute, relative, or Windows paths)
	inputPath := job.FilePath
	if !filepath.IsAbs(inputPath) {
		if abs, err := filepath.Abs(inputPath); err == nil {
			inputPath = abs
		}
	}
	if _, err := os.Stat(inputPath); os.IsNotExist(err) {
		altPath := filepath.Join(storageDir, "wi_uploads", filepath.Base(job.FilePath))
		if _, err := os.Stat(altPath); err == nil {
			inputPath = altPath
		}
	}

	cmdArgs := []string{
		scriptPath,
		"--input-file", inputPath,
		"--output-pdf", outPath,
		"--target-lang", job.TargetLang,
		"--mode", job.Mode,
		"--batch-size", "5",
	}

	if h.llmRepo != nil {
		if cfg, _, err := h.llmRepo.GetActiveLLM(ctx, nil); err == nil && cfg != nil && cfg.IsActive {
			if cfg.BaseURL != "" {
				cmdArgs = append(cmdArgs, "--llm-url", cfg.BaseURL)
			}
			if cfg.ModelName != "" {
				cmdArgs = append(cmdArgs, "--llm-model", cfg.ModelName)
			}
			if cfg.APIKey != "" {
				cmdArgs = append(cmdArgs, "--llm-api-key", cfg.APIKey)
			}
		}
	}

	cmd := exec.Command(pythonBin, cmdArgs...)
	cmd.Env = append(os.Environ(),
		"PYTHONIOENCODING=utf-8",
		"PYTHONUTF8=1",
	)

	var stderrBuf bytes.Buffer
	cmd.Stderr = &stderrBuf

	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		_ = h.wiRepo.MarkFailed(ctx, job.ID, "Failed to create stdout pipe: "+err.Error(), 0)
		return
	}

	if err := cmd.Start(); err != nil {
		_ = h.wiRepo.MarkFailed(ctx, job.ID, "Failed to start python translator: "+err.Error(), 0)
		return
	}

	// ponytail: defensive 1MB buffer for streaming progress
	scanner := bufio.NewScanner(stdoutPipe)
	scanBuf := make([]byte, 64*1024)
	scanner.Buffer(scanBuf, 1024*1024)
	var finalSuccess bool
	var translatedBlocks int
	var durationSec float64
	var lastErr string

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		var progressData map[string]interface{}
		if err := json.Unmarshal([]byte(line), &progressData); err == nil {
			var currPage, totalPages int
			var pct float64
			var msg string

			if curr, ok := progressData["current"].(float64); ok {
				currPage = int(curr)
			}
			if tot, ok := progressData["total"].(float64); ok {
				totalPages = int(tot)
			}
			if p, ok := progressData["percent"].(float64); ok {
				pct = p
			}
			if m, ok := progressData["message"].(string); ok {
				msg = m
			}

			if succ, ok := progressData["success"].(bool); ok && succ {
				finalSuccess = true
				if count, ok := progressData["translated_blocks"].(float64); ok {
					translatedBlocks = int(count)
				}
				if dur, ok := progressData["duration_sec"].(float64); ok {
					durationSec = dur
				}
			} else if errVal, ok := progressData["error"].(string); ok && errVal != "" {
				lastErr = errVal
			}

			if currPage > 0 || totalPages > 0 || pct > 0 {
				_ = h.wiRepo.UpdateProgress(ctx, job.ID, currPage, totalPages, pct, msg)
			}
		}
	}

	if scanErr := scanner.Err(); scanErr != nil && lastErr == "" {
		lastErr = "Scanner error: " + scanErr.Error()
	}

	if durationSec <= 0 {
		durationSec = math.Round(time.Since(startTime).Seconds()*100) / 100
	}

	if err := cmd.Wait(); err != nil {
		if !finalSuccess {
			if lastErr == "" {
				stderrStr := strings.TrimSpace(stderrBuf.String())
				if stderrStr != "" {
					lines := strings.Split(stderrStr, "\n")
					lastErr = strings.TrimSpace(lines[len(lines)-1])
					if lastErr == "" {
						lastErr = stderrStr
					}
				} else {
					lastErr = "Process exit error: " + err.Error()
				}
			}
			_ = h.wiRepo.MarkFailed(ctx, job.ID, lastErr, durationSec)
			return
		}
	}

	if finalSuccess {
		dlURL := fmt.Sprintf("/api/v1/utility/translate-wi-pdf/download/%s", outFilename)
		_ = h.wiRepo.MarkCompleted(ctx, job.ID, outFilename, dlURL, translatedBlocks, durationSec)
	} else if lastErr != "" {
		_ = h.wiRepo.MarkFailed(ctx, job.ID, lastErr, durationSec)
	} else {
		dlURL := fmt.Sprintf("/api/v1/utility/translate-wi-pdf/download/%s", outFilename)
		_ = h.wiRepo.MarkCompleted(ctx, job.ID, outFilename, dlURL, translatedBlocks, durationSec)
	}
}

// UploadWIJobs accepts multiple PDF uploads and creates persistent pending jobs
func (h *UtilityHandler) UploadWIJobs(c echo.Context) error {
	if h.wiRepo == nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "WI repository not initialized")
	}

	form, err := c.MultipartForm()
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid multipart form: "+err.Error())
	}

	files := form.File["files"]
	if len(files) == 0 {
		files = form.File["file"]
	}
	if len(files) == 0 {
		return echo.NewHTTPError(http.StatusBadRequest, "No files uploaded")
	}

	targetLang := c.FormValue("target_lang")
	if targetLang == "" {
		targetLang = "id"
	}
	mode := c.FormValue("mode")
	if mode == "" {
		mode = "replace"
	}

	storageDir := os.Getenv("FILE_STORAGE_PATH")
	if storageDir == "" {
		if runtime.GOOS == "windows" {
			storageDir = filepath.Join("data", "files")
		} else {
			storageDir = "/data/files"
		}
	}
	if err := os.MkdirAll(storageDir, 0755); err != nil {
		storageDir = filepath.Join(".", "data", "files")
		_ = os.MkdirAll(storageDir, 0755)
	}
	uploadDir := filepath.Join(storageDir, "wi_uploads")
	_ = os.MkdirAll(uploadDir, 0755)

	var createdJobs []*model.WITranslationJob

	for _, file := range files {
		if !strings.HasSuffix(strings.ToLower(file.Filename), ".pdf") {
			continue // only PDFs allowed
		}

		src, err := file.Open()
		if err != nil {
			continue
		}

		jobID := uuid.New()
		savedName := fmt.Sprintf("%s_%s", jobID.String(), file.Filename)
		savedPath := filepath.Join(uploadDir, savedName)

		dst, err := os.Create(savedPath)
		if err != nil {
			src.Close()
			continue
		}
		_, err = io.Copy(dst, src)
		src.Close()
		dst.Close()
		if err != nil {
			continue
		}

		job := &model.WITranslationJob{
			ID:              jobID,
			FileName:        file.Filename,
			FilePath:        savedPath,
			FileSize:        file.Size,
			TargetLang:      targetLang,
			Mode:            mode,
			Status:          "pending",
			CurrentPage:     0,
			TotalPages:      0,
			ProgressPercent: 0,
			Message:         "Menunggu antrean untuk dieksekusi",
		}

		if err := h.wiRepo.Create(c.Request().Context(), job); err == nil {
			createdJobs = append(createdJobs, job)
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"count":   len(createdJobs),
		"jobs":    createdJobs,
	})
}

// ListWIJobs returns all WI translation jobs from the database
func (h *UtilityHandler) ListWIJobs(c echo.Context) error {
	if h.wiRepo == nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "WI repository not initialized")
	}

	jobs, err := h.wiRepo.List(c.Request().Context(), 100)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to fetch jobs: "+err.Error())
	}
	if jobs == nil {
		jobs = []*model.WITranslationJob{}
	}
	return c.JSON(http.StatusOK, jobs)
}

type ExecuteJobsReq struct {
	JobIDs []string `json:"job_ids"`
}

// ExecuteWIJobs triggers processing for selected or pending jobs
func (h *UtilityHandler) ExecuteWIJobs(c echo.Context) error {
	if h.wiRepo == nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "WI repository not initialized")
	}

	var req ExecuteJobsReq
	_ = c.Bind(&req)

	var uuids []uuid.UUID
	for _, idStr := range req.JobIDs {
		if u, err := uuid.Parse(idStr); err == nil {
			uuids = append(uuids, u)
		}
	}

	jobs, err := h.wiRepo.GetPendingJobs(c.Request().Context(), uuids)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to get pending jobs: "+err.Error())
	}

	for _, job := range jobs {
		j := job
		go h.processWIJob(j)
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"queued":  len(jobs),
		"message": fmt.Sprintf("%d berkas dimasukkan ke antrean terjemahan server", len(jobs)),
	})
}

// DeleteWIJob deletes a single job and its associated files
func (h *UtilityHandler) DeleteWIJob(c echo.Context) error {
	if h.wiRepo == nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "WI repository not initialized")
	}

	idStr := c.Param("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid job id")
	}

	job, err := h.wiRepo.Delete(c.Request().Context(), id)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete job: "+err.Error())
	}

	if job != nil {
		_ = os.Remove(job.FilePath)
		if job.TranslatedFile != "" {
			storageDir := os.Getenv("FILE_STORAGE_PATH")
			if storageDir == "" {
				storageDir = "/data/files"
			}
			_ = os.Remove(filepath.Join(storageDir, job.TranslatedFile))
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Pekerjaan terjemahan berhasil dihapus",
	})
}

type DeleteBatchReq struct {
	JobIDs []string `json:"job_ids"`
}

// DeleteBatchWIJobs deletes multiple jobs and their associated files
func (h *UtilityHandler) DeleteBatchWIJobs(c echo.Context) error {
	if h.wiRepo == nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "WI repository not initialized")
	}

	var req DeleteBatchReq
	if err := c.Bind(&req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid request body")
	}

	var uuids []uuid.UUID
	for _, idStr := range req.JobIDs {
		if u, err := uuid.Parse(idStr); err == nil {
			uuids = append(uuids, u)
		}
	}

	jobs, err := h.wiRepo.DeleteBatch(c.Request().Context(), uuids)
	if err != nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "Failed to delete jobs: "+err.Error())
	}

	storageDir := os.Getenv("FILE_STORAGE_PATH")
	if storageDir == "" {
		storageDir = "/data/files"
	}
	for _, job := range jobs {
		_ = os.Remove(job.FilePath)
		if job.TranslatedFile != "" {
			_ = os.Remove(filepath.Join(storageDir, job.TranslatedFile))
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success": true,
		"deleted": len(jobs),
		"message": fmt.Sprintf("%d pekerjaan berhasil dihapus", len(jobs)),
	})
}

// DownloadWISourceFile serves the original uploaded PDF artifact
func (h *UtilityHandler) DownloadWISourceFile(c echo.Context) error {
	if h.wiRepo == nil {
		return echo.NewHTTPError(http.StatusInternalServerError, "WI repository not initialized")
	}
	jobID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "Invalid job ID")
	}
	job, err := h.wiRepo.GetByID(c.Request().Context(), jobID)
	if err != nil || job == nil {
		return echo.NewHTTPError(http.StatusNotFound, "Job not found")
	}
	if _, err := os.Stat(job.FilePath); os.IsNotExist(err) {
		return c.JSON(http.StatusNotFound, map[string]string{"message": "Source file not found on server"})
	}
	return c.Attachment(job.FilePath, job.FileName)
}

// -------------------------------------------------------------
// Asynchronous Server-Side Background Jobs for Tools
// -------------------------------------------------------------

func (h *UtilityHandler) extractUserID(c echo.Context) *uuid.UUID {
	if uidVal := c.Get("user_id"); uidVal != nil {
		if uidStr, ok := uidVal.(string); ok && uidStr != "" {
			if u, err := uuid.Parse(uidStr); err == nil {
				return &u
			}
		}
	}
	return nil
}

// SubmitVideoCompressJob starts async video compression
func (h *UtilityHandler) SubmitVideoCompressJob(c echo.Context) error {
	if h.toolJobService == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Tool job service not initialized"})
	}
	file, err := c.FormFile("video")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "No video file provided"})
	}
	src, err := file.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to open video file"})
	}
	defer src.Close()

	quality := c.FormValue("quality")
	if quality == "" {
		quality = "medium"
	}
	resolution := c.FormValue("resolution")
	if resolution == "" {
		resolution = "original"
	}
	encoder := c.FormValue("encoder")
	if encoder == "" {
		encoder = "auto"
	}
	muteAudio := c.FormValue("mute_audio") == "true"

	tempDir := os.TempDir()
	now := time.Now().UnixNano()
	inExt := strings.ToLower(filepath.Ext(file.Filename))
	if inExt == "" {
		inExt = ".mp4"
	}
	inPath := filepath.Join(tempDir, fmt.Sprintf("vin_%d%s", now, inExt))
	dst, err := os.Create(inPath)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to create temp input file"})
	}
	if _, err := io.Copy(dst, src); err != nil {
		dst.Close()
		_ = os.Remove(inPath)
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to save input video"})
	}
	dst.Close()

	userID := h.extractUserID(c)
	job, err := h.toolJobService.SubmitVideoCompress(c.Request().Context(), userID, inPath, file.Filename, file.Size, quality, resolution, encoder, muteAudio)
	if err != nil {
		_ = os.Remove(inPath)
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to submit background video compression: " + err.Error()})
	}

	return c.JSON(http.StatusAccepted, job)
}

// SubmitRemoveBackgroundJob starts async background removal
func (h *UtilityHandler) SubmitRemoveBackgroundJob(c echo.Context) error {
	if h.toolJobService == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Tool job service not initialized"})
	}
	file, err := c.FormFile("image")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "No image file provided"})
	}
	src, err := file.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to open image file"})
	}
	defer src.Close()

	tolerance := c.FormValue("tolerance")
	if tolerance == "" {
		tolerance = "35"
	}
	bgColor := c.FormValue("bg_color")
	if bgColor == "" {
		bgColor = "auto"
	}
	feather := c.FormValue("feather")
	if feather == "" {
		feather = "2"
	}

	tempDir := os.TempDir()
	now := time.Now().UnixNano()
	inExt := strings.ToLower(filepath.Ext(file.Filename))
	if inExt == "" {
		inExt = ".png"
	}
	inPath := filepath.Join(tempDir, fmt.Sprintf("imgin_%d%s", now, inExt))
	dst, err := os.Create(inPath)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to create temp input image"})
	}
	if _, err := io.Copy(dst, src); err != nil {
		dst.Close()
		_ = os.Remove(inPath)
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to save input image"})
	}
	dst.Close()

	userID := h.extractUserID(c)
	job, err := h.toolJobService.SubmitRemoveBackground(c.Request().Context(), userID, inPath, file.Filename, file.Size, tolerance, bgColor, feather)
	if err != nil {
		_ = os.Remove(inPath)
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to submit background removal: " + err.Error()})
	}

	return c.JSON(http.StatusAccepted, job)
}

// SubmitCompressPDFJob starts async PDF compression
func (h *UtilityHandler) SubmitCompressPDFJob(c echo.Context) error {
	if h.toolJobService == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Tool job service not initialized"})
	}
	file, err := c.FormFile("pdf")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "No PDF file provided"})
	}
	src, err := file.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to open PDF file"})
	}
	defer src.Close()

	quality := c.FormValue("quality")
	if quality == "" {
		quality = "ebook"
	}
	targetSizeMB := c.FormValue("target_size_mb")

	tempDir := os.TempDir()
	now := time.Now().UnixNano()
	inPath := filepath.Join(tempDir, fmt.Sprintf("pdfin_%d.pdf", now))
	dst, err := os.Create(inPath)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to create temp input PDF"})
	}
	if _, err := io.Copy(dst, src); err != nil {
		dst.Close()
		_ = os.Remove(inPath)
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to save input PDF"})
	}
	dst.Close()

	userID := h.extractUserID(c)
	job, err := h.toolJobService.SubmitCompressPDF(c.Request().Context(), userID, inPath, file.Filename, file.Size, quality, targetSizeMB)
	if err != nil {
		_ = os.Remove(inPath)
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to submit PDF compression: " + err.Error()})
	}

	return c.JSON(http.StatusAccepted, job)
}

// SubmitMergePDFJob starts async PDF merge
func (h *UtilityHandler) SubmitMergePDFJob(c echo.Context) error {
	if h.toolJobService == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Tool job service not initialized"})
	}
	form, err := c.MultipartForm()
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "Failed to parse form"})
	}
	files := form.File["files"]
	if len(files) < 2 {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "Minimal 2 file PDF untuk digabungkan"})
	}

	tempDir := os.TempDir()
	now := time.Now().UnixNano()
	var inPaths []string
	var totalSize int64

	for idx, fHeader := range files {
		src, err := fHeader.Open()
		if err != nil {
			continue
		}
		p := filepath.Join(tempDir, fmt.Sprintf("merge_%d_%d.pdf", now, idx))
		dst, err := os.Create(p)
		if err == nil {
			io.Copy(dst, src)
			dst.Close()
			inPaths = append(inPaths, p)
			totalSize += fHeader.Size
		}
		src.Close()
	}

	if len(inPaths) < 2 {
		for _, p := range inPaths {
			_ = os.Remove(p)
		}
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "Gagal membaca minimal 2 file PDF"})
	}

	outName := c.FormValue("output_name")
	if outName == "" {
		outName = fmt.Sprintf("Merged_%d_Dokumen.pdf", len(inPaths))
	}

	userID := h.extractUserID(c)
	job, err := h.toolJobService.SubmitMergePDF(c.Request().Context(), userID, inPaths, outName, totalSize)
	if err != nil {
		for _, p := range inPaths {
			_ = os.Remove(p)
		}
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to submit PDF merge: " + err.Error()})
	}

	return c.JSON(http.StatusAccepted, job)
}

// SubmitSplitPDFJob starts async PDF split
func (h *UtilityHandler) SubmitSplitPDFJob(c echo.Context) error {
	if h.toolJobService == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Tool job service not initialized"})
	}
	file, err := c.FormFile("pdf")
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "No PDF file provided"})
	}
	src, err := file.Open()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to open PDF file"})
	}
	defer src.Close()

	splitRanges := c.FormValue("ranges")
	tempDir := os.TempDir()
	now := time.Now().UnixNano()
	inPath := filepath.Join(tempDir, fmt.Sprintf("splitin_%d.pdf", now))
	dst, err := os.Create(inPath)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to create temp input PDF"})
	}
	if _, err := io.Copy(dst, src); err != nil {
		dst.Close()
		_ = os.Remove(inPath)
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to save input PDF"})
	}
	dst.Close()

	userID := h.extractUserID(c)
	job, err := h.toolJobService.SubmitSplitPDF(c.Request().Context(), userID, inPath, file.Filename, file.Size, splitRanges)
	if err != nil {
		_ = os.Remove(inPath)
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to submit PDF split: " + err.Error()})
	}

	return c.JSON(http.StatusAccepted, job)
}

// SubmitSummarizePPTXJob starts async PPTX summary
func (h *UtilityHandler) SubmitSummarizePPTXJob(c echo.Context) error {
	if h.toolJobService == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Tool job service not initialized"})
	}
	form, err := c.MultipartForm()
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "Failed to parse form"})
	}
	files := form.File["files"]
	if len(files) == 0 {
		files = form.File["pptx_files"]
	}
	if len(files) == 0 {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "No PPTX files provided"})
	}

	now := time.Now().UnixNano()
	jobDir := filepath.Join(os.TempDir(), fmt.Sprintf("pptx_job_%d", now))
	_ = os.MkdirAll(jobDir, 0755)

	var savedPaths []string
	var totalSize int64
	for _, fHeader := range files {
		if !strings.HasSuffix(strings.ToLower(fHeader.Filename), ".pptx") {
			continue
		}
		src, err := fHeader.Open()
		if err != nil {
			continue
		}
		p := filepath.Join(jobDir, filepath.Base(fHeader.Filename))
		dst, err := os.Create(p)
		if err == nil {
			io.Copy(dst, src)
			dst.Close()
			savedPaths = append(savedPaths, p)
			totalSize += fHeader.Size
		}
		src.Close()
	}

	if len(savedPaths) == 0 {
		_ = os.RemoveAll(jobDir)
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "No valid PPTX files saved"})
	}

	batchName := c.FormValue("batch_name")
	if batchName == "" {
		batchName = fmt.Sprintf("Laporan_%d_File", len(savedPaths))
	}

	userID := h.extractUserID(c)
	job, err := h.toolJobService.SubmitSummarizePPTX(c.Request().Context(), userID, savedPaths, batchName, totalSize)
	if err != nil {
		_ = os.RemoveAll(jobDir)
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Failed to submit PPTX summary: " + err.Error()})
	}

	return c.JSON(http.StatusAccepted, job)
}

// GetToolJobStatus returns current progress & status of a specific background job
func (h *UtilityHandler) GetToolJobStatus(c echo.Context) error {
	if h.toolJobService == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Tool job service not initialized"})
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "Invalid job ID"})
	}
	job, err := h.toolJobService.GetJob(c.Request().Context(), id)
	if err != nil || job == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"message": "Job not found"})
	}
	return c.JSON(http.StatusOK, job)
}

// ListActiveToolJobs returns currently executing tools
func (h *UtilityHandler) ListActiveToolJobs(c echo.Context) error {
	if h.toolJobService == nil {
		return c.JSON(http.StatusOK, []model.ToolJob{})
	}
	userID := h.extractUserID(c)
	list, err := h.toolJobService.ListActive(c.Request().Context(), userID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": err.Error()})
	}
	return c.JSON(http.StatusOK, list)
}

// ListRecentToolJobs returns recent jobs (both finished and running)
func (h *UtilityHandler) ListRecentToolJobs(c echo.Context) error {
	if h.toolJobService == nil {
		return c.JSON(http.StatusOK, []model.ToolJob{})
	}
	userID := h.extractUserID(c)
	list, err := h.toolJobService.ListRecent(c.Request().Context(), userID, 15)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": err.Error()})
	}
	return c.JSON(http.StatusOK, list)
}

// CancelToolJob cancels an ongoing background tool process
func (h *UtilityHandler) CancelToolJob(c echo.Context) error {
	if h.toolJobService == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Tool job service not initialized"})
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "Invalid job ID"})
	}
	if err := h.toolJobService.CancelJob(c.Request().Context(), id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "Job cancelled"})
}

// DeleteToolJob deletes job record and generated file
func (h *UtilityHandler) DeleteToolJob(c echo.Context) error {
	if h.toolJobService == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Tool job service not initialized"})
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "Invalid job ID"})
	}
	if err := h.toolJobService.DeleteJob(c.Request().Context(), id); err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": err.Error()})
	}
	return c.JSON(http.StatusOK, map[string]string{"message": "Job deleted"})
}

// DownloadToolJobResult streams the generated result file to the client with appropriate headers
func (h *UtilityHandler) DownloadToolJobResult(c echo.Context) error {
	if h.toolJobService == nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"message": "Tool job service not initialized"})
	}
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "Invalid job ID"})
	}
	job, err := h.toolJobService.GetJob(c.Request().Context(), id)
	if err != nil || job == nil {
		return c.JSON(http.StatusNotFound, map[string]string{"message": "Job not found"})
	}
	if job.Status != "completed" || job.OutputPath == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"message": "File belum siap atau proses belum selesai"})
	}
	if _, err := os.Stat(job.OutputPath); os.IsNotExist(err) {
		return c.JSON(http.StatusNotFound, map[string]string{"message": "File hasil tidak ditemukan di server"})
	}

	dlName := filepath.Base(job.OutputPath)
	return c.Attachment(job.OutputPath, dlName)
}





