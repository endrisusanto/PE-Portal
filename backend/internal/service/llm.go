package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"pe-portal/internal/model"
)

type LLMService struct {
	httpClient *http.Client
}

func NewLLMService() *LLMService {
	return &LLMService{
		httpClient: &http.Client{
			Timeout: 45 * time.Second,
		},
	}
}

type openAIChatReq struct {
	Model       string              `json:"model"`
	Messages    []model.ChatMessage `json:"messages"`
	Temperature float64             `json:"temperature,omitempty"`
	MaxTokens   int                 `json:"max_tokens,omitempty"`
}

type openAIChatResp struct {
	Choices []struct {
		Message struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
	Error *struct {
		Message string `json:"message"`
	} `json:"error,omitempty"`
}

type openAIModelsResp struct {
	Data []struct {
		ID string `json:"id"`
	} `json:"data"`
}

// ChatCompletion calls OpenAI-compatible /chat/completions endpoint
func (s *LLMService) ChatCompletion(ctx context.Context, cfg *model.LLMConfig, req *model.AIChatRequest) (string, error) {
	if cfg == nil || !cfg.IsActive {
		return "", fmt.Errorf("active LLM configuration not found")
	}

	baseURL := strings.TrimRight(cfg.BaseURL, "/")
	endpoint := baseURL + "/chat/completions"

	modelToUse := cfg.ModelName
	if req.Model != "" {
		modelToUse = req.Model
	}
	if modelToUse == "" {
		modelToUse = "google/gemma-4-e4b"
	}

	// Prepare messages with SEIN PE system prompt & Expert Chart Designer skill
	systemPrompt := `You are the SEIN PE Engineering AI Assistant for Samsung Electronics Indonesia Production Engineering Group. Assist engineers concisely and accurately with JIG development, BOM checks, IMEI tracking, GBA approvals, MRO, and new model developments (such as S26 Series).

PROFESSIONAL SVG CHART & DIAGRAM SKILL:
When asked for charts (Bar, Line, Area, Donut, KPI), flowcharts, architectures, or circuit layouts, ALWAYS generate presentation-grade, ultra-clean, modern SVG inside ` + "```svg ... ```" + ` codeblocks following these visual standards:
1. Canvas: Always define width="100%", height="100%", viewBox="0 0 740 420" (or 680x360), xmlns="http://www.w3.org/2000/svg". Include an outer dark card background: <rect width="100%" height="100%" rx="14" fill="#0f172a" stroke="#1e293b" stroke-width="1.5"/>.
2. Gradients & Filters: Always define <defs> with smooth linearGradients (e.g. blue-to-cyan, emerald-to-teal, amber-to-orange, violet-to-fuchsia) and subtle drop-shadows (<filter id="glow">).
3. Modern Harmonious Color Palette:
   - Primary Metric: #3b82f6 (Blue) & #38bdf8 (Sky)
   - Success / On-Time: #10b981 (Emerald) & #34d399
   - Warning / In Progress: #f59e0b (Amber) & #fbbf24
   - Accent / AI / Critical: #8b5cf6 (Violet) & #ec4899 (Pink)
   - Danger / Late: #ef4444 (Rose)
   - Gridlines: #1e293b with stroke-dasharray="4 4"
   - Text Typography: font-family="system-ui, -apple-system, sans-serif". Titles: #f8fafc (font-weight="700", font-size="16"). Axis/Labels: #94a3b8 (font-size="11"). Value badges: #f1f5f9 (font-weight="600").
4. Bar Charts: Rounded top corners (<rect rx="5"/>), smooth vertical gradient fills, subtle hover glow, and clean bold value labels above each bar.
5. Line / Area Charts: Smooth bezier curve path (C/S commands), glowing stroke (stroke-width="3"), gradient area fill below with opacity (0.28 to 0.0), and circular data markers (<circle r="4.5" fill="#38bdf8" stroke="#0f172a" stroke-width="2.5"/>).
6. Donut / Progress Charts: Circular stroke-dasharray with rounded ends, center summary text (Total / Percent), and clean legend badges with colored dots.
7. Flowcharts & Schemas: Rounded nodes (rx="8"), icon badges, crisp connection lines with marker-end="url(#arrow)", and clear status indicators.

STRUCTURED DATA & TABLES:
When presenting tabular data or comparisons, format them as clean Markdown tables with header separators (| col | col |).
When reviewing attached documents or logs, provide concise diagnosis and actionable recommendations.`

	messages := []model.ChatMessage{
		{Role: "system", Content: systemPrompt},
	}
	messages = append(messages, req.Messages...)

	payload := openAIChatReq{
		Model:       modelToUse,
		Messages:    messages,
		Temperature: req.Temperature,
		MaxTokens:   req.MaxTokens,
	}
	if payload.Temperature == 0 {
		payload.Temperature = 0.7
	}
	if payload.MaxTokens == 0 {
		payload.MaxTokens = 2048
	}

	jsonBytes, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("failed to marshal chat payload: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(jsonBytes))
	if err != nil {
		return "", fmt.Errorf("failed to create http request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	if cfg.APIKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+cfg.APIKey)
	}

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return "", fmt.Errorf("LLM request failed: %w", err)
	}
	defer resp.Body.Close()

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		return "", fmt.Errorf("LLM API error (HTTP %d): %s", resp.StatusCode, string(bodyBytes))
	}

	var chatResp openAIChatResp
	if err := json.Unmarshal(bodyBytes, &chatResp); err != nil {
		return "", fmt.Errorf("failed to parse LLM response: %w", err)
	}

	if chatResp.Error != nil && chatResp.Error.Message != "" {
		return "", fmt.Errorf("LLM error: %s", chatResp.Error.Message)
	}

	if len(chatResp.Choices) == 0 {
		return "", fmt.Errorf("no response returned from LLM")
	}

	return chatResp.Choices[0].Message.Content, nil
}

// FetchModels queries /models on the active LLM endpoint
func (s *LLMService) FetchModels(ctx context.Context, cfg *model.LLMConfig) ([]string, error) {
	if cfg == nil {
		return nil, fmt.Errorf("LLM configuration is missing")
	}

	baseURL := strings.TrimRight(cfg.BaseURL, "/")
	endpoint := baseURL + "/models"

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}

	if cfg.APIKey != "" {
		httpReq.Header.Set("Authorization", "Bearer "+cfg.APIKey)
	}

	resp, err := s.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to reach /models: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return nil, fmt.Errorf("failed with HTTP %d", resp.StatusCode)
	}

	var mResp openAIModelsResp
	if err := json.NewDecoder(resp.Body).Decode(&mResp); err != nil {
		return nil, err
	}

	var modelIDs []string
	for _, m := range mResp.Data {
		modelIDs = append(modelIDs, m.ID)
	}
	return modelIDs, nil
}
