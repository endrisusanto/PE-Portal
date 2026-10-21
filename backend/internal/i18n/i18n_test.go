package i18n_test

import (
	"testing"

	"pe-portal/internal/i18n"
)

func TestI18nTranslations(t *testing.T) {
	// English
	if got := i18n.T("en", "dashboard"); got != "Dashboard" {
		t.Errorf("Expected Dashboard, got %s", got)
	}

	// Indonesian
	if got := i18n.T("id", "dashboard"); got != "Dasbor" {
		t.Errorf("Expected Dasbor, got %s", got)
	}

	// Korean
	if got := i18n.T("ko", "dashboard"); got != "대시보드" {
		t.Errorf("Expected 대시보드, got %s", got)
	}

	// Fallback to English
	if got := i18n.T("unknown_lang", "save"); got != "Save" {
		t.Errorf("Expected Save, got %s", got)
	}

	// Fallback to key if not present
	if got := i18n.T("en", "non_existing_key_xyz"); got != "non_existing_key_xyz" {
		t.Errorf("Expected non_existing_key_xyz, got %s", got)
	}
}
