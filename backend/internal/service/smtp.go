package service

import (
	"crypto/tls"
	"fmt"
	"net"
	"net/smtp"
	"strings"
	"time"

	"pe-portal/internal/model"
)

type SMTPService struct{}

func NewSMTPService() *SMTPService {
	return &SMTPService{}
}

// SendEmail dispatches an HTML email using Go standard net/smtp
func (s *SMTPService) SendEmail(cfg *model.SMTPConfig, to []string, cc []string, subject string, htmlBody string) error {
	if cfg == nil {
		return fmt.Errorf("SMTP configuration is missing")
	}

	allRecipients := append([]string{}, to...)
	for _, c := range cc {
		if strings.TrimSpace(c) != "" {
			allRecipients = append(allRecipients, strings.TrimSpace(c))
		}
	}

	if len(allRecipients) == 0 {
		return fmt.Errorf("no recipients specified")
	}

	// Build MIME message
	fromHeader := fmt.Sprintf("%s <%s>", cfg.FromName, cfg.FromEmail)
	if cfg.FromName == "" {
		fromHeader = cfg.FromEmail
	}

	var msg strings.Builder
	msg.WriteString(fmt.Sprintf("From: %s\r\n", fromHeader))
	msg.WriteString(fmt.Sprintf("To: %s\r\n", strings.Join(to, ", ")))
	if len(cc) > 0 {
		msg.WriteString(fmt.Sprintf("Cc: %s\r\n", strings.Join(cc, ", ")))
	}
	msg.WriteString(fmt.Sprintf("Subject: %s\r\n", subject))
	msg.WriteString("MIME-Version: 1.0\r\n")
	msg.WriteString("Content-Type: text/html; charset=UTF-8\r\n")
	msg.WriteString("\r\n")
	msg.WriteString(htmlBody)

	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)

	// Auth setup
	var auth smtp.Auth
	if cfg.Username != "" && cfg.Password != "" {
		auth = smtp.PlainAuth("", cfg.Username, cfg.Password, cfg.Host)
	}

	// Direct SSL/TLS (commonly port 465)
	if cfg.Encryption == "ssl" || cfg.Port == 465 {
		tlsConfig := &tls.Config{
			ServerName:         cfg.Host,
			InsecureSkipVerify: true, // Allow corporate self-signed certs
		}
		conn, err := tls.DialWithDialer(&net.Dialer{Timeout: 10 * time.Second}, "tcp", addr, tlsConfig)
		if err != nil {
			return fmt.Errorf("failed to connect via SSL/TLS: %w", err)
		}
		defer conn.Close()

		client, err := smtp.NewClient(conn, cfg.Host)
		if err != nil {
			return fmt.Errorf("failed to create SMTP client: %w", err)
		}
		defer client.Close()

		if auth != nil {
			if ok, _ := client.Extension("AUTH"); ok {
				if err = client.Auth(auth); err != nil {
					return fmt.Errorf("SMTP authentication failed: %w", err)
				}
			}
		}

		if err = client.Mail(cfg.FromEmail); err != nil {
			return fmt.Errorf("SMTP MAIL command failed: %w", err)
		}
		for _, recipient := range allRecipients {
			if err = client.Rcpt(strings.TrimSpace(recipient)); err != nil {
				return fmt.Errorf("SMTP RCPT command failed for %s: %w", recipient, err)
			}
		}

		w, err := client.Data()
		if err != nil {
			return fmt.Errorf("SMTP DATA command failed: %w", err)
		}
		if _, err = w.Write([]byte(msg.String())); err != nil {
			return fmt.Errorf("failed to write email body: %w", err)
		}
		if err = w.Close(); err != nil {
			return fmt.Errorf("failed to close email stream: %w", err)
		}

		return client.Quit()
	}

	// Standard SMTP with STARTTLS (Port 587 or 25)
	conn, err := net.DialTimeout("tcp", addr, 10*time.Second)
	if err != nil {
		return fmt.Errorf("failed to connect to SMTP host: %w", err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, cfg.Host)
	if err != nil {
		return fmt.Errorf("failed to establish SMTP session: %w", err)
	}
	defer client.Close()

	if cfg.Encryption == "tls" || cfg.Encryption == "starttls" {
		if ok, _ := client.Extension("STARTTLS"); ok {
			tlsConfig := &tls.Config{
				ServerName:         cfg.Host,
				InsecureSkipVerify: true,
			}
			if err = client.StartTLS(tlsConfig); err != nil {
				return fmt.Errorf("STARTTLS upgrade failed: %w", err)
			}
		}
	}

	if auth != nil {
		if ok, _ := client.Extension("AUTH"); ok {
			if err = client.Auth(auth); err != nil {
				return fmt.Errorf("SMTP authentication failed: %w", err)
			}
		}
	}

	if err = client.Mail(cfg.FromEmail); err != nil {
		return fmt.Errorf("SMTP MAIL command failed: %w", err)
	}
	for _, recipient := range allRecipients {
		if err = client.Rcpt(strings.TrimSpace(recipient)); err != nil {
			return fmt.Errorf("SMTP RCPT command failed for %s: %w", recipient, err)
		}
	}

	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("SMTP DATA command failed: %w", err)
	}
	if _, err = w.Write([]byte(msg.String())); err != nil {
		return fmt.Errorf("failed to write message content: %w", err)
	}
	if err = w.Close(); err != nil {
		return fmt.Errorf("failed to complete message transfer: %w", err)
	}

	return client.Quit()
}

// TestConnection sends a short test probe to verify reachability and credentials
func (s *SMTPService) TestConnection(cfg *model.SMTPConfig, testRecipient string) error {
	if testRecipient == "" {
		testRecipient = cfg.FromEmail
	}

	subject := "[TEST] SEIN PE-Portal SMTP Connection Verification"
	body := fmt.Sprintf(`
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; padding: 20px; color: #1f2937;">
  <div style="max-width: 500px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; background: #ffffff;">
    <h2 style="color: #0d7377; margin-top: 0;">✓ SMTP Gateway Connected</h2>
    <p>This is an automated test message from <strong>SEIN PE-Portal</strong>.</p>
    <div style="background: #f3f4f6; padding: 12px; border-radius: 6px; font-size: 13px; font-family: monospace;">
      Host: %s:%d<br>
      Encryption: %s<br>
      Sender: %s<br>
      Timestamp: %s
    </div>
    <p style="font-size: 12px; color: #6b7280; margin-top: 20px;">SEIN Production Engineering Team Portal Automated Engine</p>
  </div>
</body>
</html>
`, cfg.Host, cfg.Port, cfg.Encryption, cfg.FromEmail, time.Now().Format(time.RFC1123))

	return s.SendEmail(cfg, []string{testRecipient}, nil, subject, body)
}
