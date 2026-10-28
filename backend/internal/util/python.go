package util

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

// FindPythonExecutable detects the python binary across operating systems.
// On Windows, it strictly prioritizes "python" over "python3", per SEIN environment standards.
// On Linux / Docker, it uses "python3" with fallback to "python".
func FindPythonExecutable() string {
	if runtime.GOOS == "windows" {
		// Strict Windows priority: "python", then "py", then common Windows installation directories
		for _, cmd := range []string{"python", "py"} {
			if path, err := exec.LookPath(cmd); err == nil && path != "" {
				return cmd
			}
		}

		winCandidates := []string{
			`C:\Python312\python.exe`,
			`C:\Python311\python.exe`,
			`C:\Python310\python.exe`,
			`C:\Python39\python.exe`,
			`C:\Program Files\Python312\python.exe`,
			`C:\Program Files\Python311\python.exe`,
			`C:\Program Files\Python310\python.exe`,
		}

		if userProfile := os.Getenv("USERPROFILE"); userProfile != "" {
			winCandidates = append(winCandidates,
				filepath.Join(userProfile, `AppData\Local\Programs\Python\Python312\python.exe`),
				filepath.Join(userProfile, `AppData\Local\Programs\Python\Python311\python.exe`),
				filepath.Join(userProfile, `AppData\Local\Programs\Python\Python310\python.exe`),
				filepath.Join(userProfile, `AppData\Local\Programs\Python\Python39\python.exe`),
			)
		}

		for _, p := range winCandidates {
			if info, err := os.Stat(p); err == nil && !info.IsDir() {
				return p
			}
		}

		// Fallback to "python" for Windows cmd/powershell
		return "python"
	}

	// Linux / Docker container priority: "python3", then "python"
	for _, cmd := range []string{"python3", "python", "py"} {
		if path, err := exec.LookPath(cmd); err == nil && path != "" {
			return cmd
		}
	}

	return "python3"
}
