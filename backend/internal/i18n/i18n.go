package i18n

import (
	"embed"
	"encoding/json"
	"strings"
)

//go:embed locales/*.json
var localesFS embed.FS

var translations = make(map[string]map[string]string)

func init() {
	langs := []string{"en", "id", "ko"}
	for _, lang := range langs {
		data, err := localesFS.ReadFile("locales/" + lang + ".json")
		if err == nil {
			var m map[string]string
			if err := json.Unmarshal(data, &m); err == nil {
				translations[lang] = m
			}
		}
	}
}

// T translates a key into target language with English fallback
func T(lang, key string) string {
	lang = strings.ToLower(strings.TrimSpace(lang))
	if len(lang) > 2 {
		lang = lang[:2]
	}

	if m, ok := translations[lang]; ok {
		if val, exists := m[key]; exists {
			return val
		}
	}

	if m, ok := translations["en"]; ok {
		if val, exists := m[key]; exists {
			return val
		}
	}

	return key
}

// GetTranslations returns the full dictionary for a given language
func GetTranslations(lang string) map[string]string {
	lang = strings.ToLower(strings.TrimSpace(lang))
	if len(lang) > 2 {
		lang = lang[:2]
	}
	if m, ok := translations[lang]; ok {
		return m
	}
	return translations["en"]
}
