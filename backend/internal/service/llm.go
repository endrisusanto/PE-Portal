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
	Stream      bool                `json:"stream"`
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

	modelToUse := cfg.ModelName
	if req.Model != "" {
		modelToUse = req.Model
	}
	if modelToUse == "" {
		modelToUse = "google/gemma-4-e4b"
	}

	// Prepare messages with SEIN PE system prompt
	systemPrompt := "You are the SEIN PE Engineering AI Assistant, designed for the Samsung Electronics Indonesia Production Engineering Group. Assist engineers concisely and accurately with JIG development, BOM checks, IMEI tracking, GBA approvals, MRO, and new model developments (such as S26 Series). When analyzing attached photos, PCB layouts, components, or defect images, inspect them carefully and provide detailed technical observations. When presenting structured data or comparisons, format them as clean Markdown tables. When asked for diagrams, flowcharts, architectures, or circuit layouts, generate valid, self-contained SVG graphics enclosed in ```svg ... ``` codeblocks with explicit viewBox and xmlns. When reviewing attached documents, reports, or logs, provide concise diagnosis and actionable recommendations."
	if req.SystemPrompt != "" {
		systemPrompt = req.SystemPrompt
	}

	messages := []model.ChatMessage{
		{Role: "system", Content: systemPrompt},
	}
	for _, m := range req.Messages {
		if m.Role != "system" {
			messages = append(messages, m)
		}
	}

	payload := openAIChatReq{
		Model:       modelToUse,
		Messages:    messages,
		Temperature: req.Temperature,
		MaxTokens:   req.MaxTokens,
		Stream:      false,
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

	// ponytail: Support Docker container accessing host services (localhost -> host.docker.internal / bridge gateway)
	candidates := []string{strings.TrimRight(cfg.BaseURL, "/")}
	if IsRunningInDocker() {
		if c := GetCandidateURLs(cfg.BaseURL); len(c) > 0 {
			candidates = c
		}
	}

	var lastErr error
	for _, candBaseURL := range candidates {
		candBaseURL = strings.TrimRight(candBaseURL, "/")
		endpoint := candBaseURL + "/chat/completions"

		httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(jsonBytes))
		if err != nil {
			lastErr = err
			continue
		}

		httpReq.Header.Set("Content-Type", "application/json")
		if cfg.APIKey != "" {
			httpReq.Header.Set("Authorization", "Bearer "+cfg.APIKey)
		}

		resp, err := s.httpClient.Do(httpReq)
		if err != nil {
			lastErr = fmt.Errorf("LLM request failed (%s): %w", candBaseURL, err)
			continue
		}

		bodyBytes, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			lastErr = fmt.Errorf("failed to read response: %w", err)
			continue
		}

		if resp.StatusCode >= 400 {
			lastErr = fmt.Errorf("LLM API error (HTTP %d): %s", resp.StatusCode, string(bodyBytes))
			continue
		}

		// ponytail: fallback if upstream provider returned SSE streaming chunks (data: {...})
		trimmedBody := bytes.TrimSpace(bodyBytes)
		if bytes.HasPrefix(trimmedBody, []byte("data:")) {
			var contentBuilder strings.Builder
			for _, line := range strings.Split(string(trimmedBody), "\n") {
				line = strings.TrimSpace(line)
				if !strings.HasPrefix(line, "data:") {
					continue
				}
				chunkData := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
				if chunkData == "[DONE]" || chunkData == "" {
					continue
				}
				var chunk struct {
					Choices []struct {
						Delta struct {
							Content string `json:"content"`
						} `json:"delta"`
						Message struct {
							Content string `json:"content"`
						} `json:"message"`
					} `json:"choices"`
				}
				if err := json.Unmarshal([]byte(chunkData), &chunk); err == nil && len(chunk.Choices) > 0 {
					if chunk.Choices[0].Delta.Content != "" {
						contentBuilder.WriteString(chunk.Choices[0].Delta.Content)
					} else if chunk.Choices[0].Message.Content != "" {
						contentBuilder.WriteString(chunk.Choices[0].Message.Content)
					}
				}
			}
			if contentBuilder.Len() > 0 {
				return contentBuilder.String(), nil
			}
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

	return "", lastErr
}

// FetchModels queries /models on the active LLM endpoint
func (s *LLMService) FetchModels(ctx context.Context, cfg *model.LLMConfig) ([]string, error) {
	if cfg == nil {
		return nil, fmt.Errorf("LLM configuration is missing")
	}

	// ponytail: Support Docker container accessing host services (localhost -> host.docker.internal / bridge gateway)
	candidates := []string{strings.TrimRight(cfg.BaseURL, "/")}
	if IsRunningInDocker() {
		if c := GetCandidateURLs(cfg.BaseURL); len(c) > 0 {
			candidates = c
		}
	}

	var lastErr error
	for _, candBaseURL := range candidates {
		candBaseURL = strings.TrimRight(candBaseURL, "/")
		endpoint := candBaseURL + "/models"

		httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
		if err != nil {
			lastErr = err
			continue
		}

		if cfg.APIKey != "" {
			httpReq.Header.Set("Authorization", "Bearer "+cfg.APIKey)
		}

		resp, err := s.httpClient.Do(httpReq)
		if err != nil {
			lastErr = fmt.Errorf("failed to reach %s: %w", endpoint, err)
			continue
		}

		var mResp openAIModelsResp
		err = json.NewDecoder(resp.Body).Decode(&mResp)
		resp.Body.Close()
		if err != nil {
			lastErr = err
			continue
		}

		if resp.StatusCode >= 400 {
			lastErr = fmt.Errorf("failed with HTTP %d from %s", resp.StatusCode, endpoint)
			continue
		}

		var modelIDs []string
		for _, m := range mResp.Data {
			if m.ID != "" {
				modelIDs = append(modelIDs, m.ID)
			}
		}
		return modelIDs, nil
	}

	return nil, lastErr
}
