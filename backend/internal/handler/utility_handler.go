package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"pe-portal/internal/util"
)

type UtilityHandler struct{}

func NewUtilityHandler() *UtilityHandler {
	return &UtilityHandler{}
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
			result["download_url"] = fmt.Sprintf("/api/v1/utility/pptx-summary/download/%s", actualExcelName)
			return c.JSON(http.StatusOK, result)
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"success":      true,
		"raw_output":   outStr,
		"download_url": fmt.Sprintf("/api/v1/utility/pptx-summary/download/%s", excelFilename),
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

	return c.Attachment(filePath, cleanName)
}

// findPythonExecutable detects the python binary, prioritizing "python" on Windows
func findPythonExecutable() string {
	return util.FindPythonExecutable()
}



