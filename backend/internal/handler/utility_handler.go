package handler

import (
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
)

type UtilityHandler struct{}

func NewUtilityHandler() *UtilityHandler {
	return &UtilityHandler{}
}

// GetStatus checks if local Python, Ghostscript, and FFmpeg VAAPI utilities are available
func (h *UtilityHandler) GetStatus(c echo.Context) error {
	pythonPath, errPy := exec.LookPath("python3")
	gsPath, errGs := exec.LookPath("gs")
	ffmpegPath, errFfmpeg := exec.LookPath("ffmpeg")

	// Check if Pillow is available in python3
	hasPillow := false
	if errPy == nil {
		cmd := exec.Command("python3", "-c", "import PIL; print('OK')")
		if out, err := cmd.Output(); err == nil && len(out) >= 2 && string(out)[:2] == "OK" {
			hasPillow = true
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
		"ghostscript_available": errGs == nil,
		"ghostscript_path":      gsPath,
		"ffmpeg_available":      errFfmpeg == nil,
		"ffmpeg_path":           ffmpegPath,
		"vaapi_available":       hasVaapi,
		"local_engine":          "SEIN Local Offline Engine",
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

	cmd := exec.Command("python3", scriptPath, inPath, outPath, tolerance, bgColor, feather)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"message": fmt.Sprintf("Python local processing failed: %v", err),
			"details": string(output),
		})
	}

	return c.Attachment(outPath, fmt.Sprintf("nobg_%s.png", file.Filename))
}

func formatPDFErrorMessage(action string, output string, err error) string {
	lower := strings.ToLower(output)
	if strings.Contains(lower, "invalid xref table") ||
		strings.Contains(lower, "cannot find") ||
		strings.Contains(lower, "not a pdf file") ||
		strings.Contains(lower, "syntaxerror") ||
		strings.Contains(lower, "undefined") {
		return "Dokumen tidak dapat diproses karena terdeteksi terenkripsi oleh sistem keamanan korporat (Samsung NASCA / DRM). Solusi: Buka dokumen di Adobe Acrobat Reader atau MS Office, tekan Ctrl+P, pilih printer 'Microsoft Print to PDF', lalu simpan sebagai file PDF baru."
	}
	return fmt.Sprintf("PDF %s failed: %v", action, err)
}

// CompressPDF executes local Ghostscript compression
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

	// Run Ghostscript if available
	setting := "/ebook"
	switch quality {
	case "screen":
		setting = "/screen" // 72 dpi
	case "printer":
		setting = "/printer" // 300 dpi
	case "prepress":
		setting = "/prepress"
	}

	cmd := exec.Command("gs", "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.4",
		fmt.Sprintf("-dPDFSETTINGS=%s", setting),
		"-dNOPAUSE", "-dQUIET", "-dBATCH",
		fmt.Sprintf("-sOutputFile=%s", outPath), inPath)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"message": formatPDFErrorMessage("compression", string(output), err),
			"details": string(output),
		})
	}

	fiOrig, _ := os.Stat(inPath)
	fiNew, _ := os.Stat(outPath)

	c.Response().Header().Set("X-Original-Size", strconv.FormatInt(fiOrig.Size(), 10))
	c.Response().Header().Set("X-Compressed-Size", strconv.FormatInt(fiNew.Size(), 10))

	return c.Attachment(outPath, fmt.Sprintf("compressed_%s", file.Filename))
}

// MergePDF merges multiple PDF files into one using Ghostscript
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

	args := []string{"-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.4", "-dNOPAUSE", "-dQUIET", "-dBATCH", fmt.Sprintf("-sOutputFile=%s", outPath)}
	args = append(args, inPaths...)

	cmd := exec.Command("gs", args...)
	output, err := cmd.CombinedOutput()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"message": formatPDFErrorMessage("merge", string(output), err),
			"details": string(output),
		})
	}

	return c.Attachment(outPath, "merged_document.pdf")
}

// SplitPDF extracts a page range from a PDF file using Ghostscript
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

	cmd := exec.Command("gs", "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.4",
		fmt.Sprintf("-dFirstPage=%s", firstPage),
		fmt.Sprintf("-dLastPage=%s", lastPage),
		"-dNOPAUSE", "-dQUIET", "-dBATCH",
		fmt.Sprintf("-sOutputFile=%s", outPath), inPath)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{
			"message": formatPDFErrorMessage("split", string(output), err),
			"details": string(output),
		})
	}

	return c.Attachment(outPath, fmt.Sprintf("split_pages_%s-%s_%s", firstPage, lastPage, file.Filename))
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

