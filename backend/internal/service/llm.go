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
			Timeout: 120 * time.Second,
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

	// Prepare messages with SEIN PE system prompt
	systemPrompt := "You are the SEIN PE Engineering AI Assistant, designed for the Samsung Electronics Indonesia Production Engineering Group. Assist engineers concisely and accurately with JIG development, BOM checks, IMEI tracking, GBA approvals, MRO, and new model developments (such as S26 Series). When analyzing attached photos, PCB layouts, components, or defect images, inspect them carefully and provide detailed technical observations. When presenting structured data or comparisons, format them as clean Markdown tables. When asked for diagrams, flowcharts, architectures, or circuit layouts, generate valid, self-contained SVG graphics enclosed in ```svg ... ``` codeblocks with explicit viewBox and xmlns. When reviewing attached documents, reports, or logs, provide concise diagnosis and actionable recommendations."

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
		payload.MaxTokens = 4096
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
