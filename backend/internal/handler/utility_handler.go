package handler

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
)

type UtilityHandler struct{}

func NewUtilityHandler() *UtilityHandler {
	return &UtilityHandler{}
}

// GetStatus checks if local Python and Ghostscript utilities are available
func (h *UtilityHandler) GetStatus(c echo.Context) error {
	pythonPath, errPy := exec.LookPath("python3")
	gsPath, errGs := exec.LookPath("gs")

	// Check if Pillow is available in python3
	hasPillow := false
	if errPy == nil {
		cmd := exec.Command("python3", "-c", "import PIL; print('OK')")
		if out, err := cmd.Output(); err == nil && string(out)[:2] == "OK" {
			hasPillow = true
		}
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"python_available":      errPy == nil,
		"python_path":           pythonPath,
		"pillow_available":      hasPillow,
		"ghostscript_available": errGs == nil,
		"ghostscript_path":      gsPath,
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
			"message": fmt.Sprintf("PDF compression failed: %v", err),
			"details": string(output),
		})
	}

	fiOrig, _ := os.Stat(inPath)
	fiNew, _ := os.Stat(outPath)

	c.Response().Header().Set("X-Original-Size", strconv.FormatInt(fiOrig.Size(), 10))
	c.Response().Header().Set("X-Compressed-Size", strconv.FormatInt(fiNew.Size(), 10))

	return c.Attachment(outPath, fmt.Sprintf("compressed_%s", file.Filename))
}
