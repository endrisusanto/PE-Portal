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

// loginAuth implements LOGIN authentication (commonly used by Microsoft Exchange and enterprise SMTP)
type loginAuth struct {
	username, password string
}

func LoginAuth(username, password string) smtp.Auth {
	return &loginAuth{username, password}
}

func (a *loginAuth) Start(server *smtp.ServerInfo) (string, []byte, error) {
	return "LOGIN", []byte(a.username), nil
}

func (a *loginAuth) Next(fromServer []byte, more bool) ([]byte, error) {
	if more {
		switch strings.ToLower(string(fromServer)) {
		case "username:", "user:":
			return []byte(a.username), nil
		case "password:", "pass:":
			return []byte(a.password), nil
		default:
			// Fallback: send password on second challenge
			return []byte(a.password), nil
		}
	}
	return nil, nil
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

	// Direct SSL/TLS (commonly port 465)
	if cfg.Encryption == "ssl" || cfg.Port == 465 {
		tlsConfig := &tls.Config{
			ServerName:         cfg.Host,
			InsecureSkipVerify: true, // verify_peer: false, allow_self_signed: true
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

		if cfg.Username != "" && cfg.Password != "" {
			if ok, auths := client.Extension("AUTH"); ok {
				var auth smtp.Auth
				if strings.Contains(strings.ToUpper(auths), "LOGIN") {
					auth = LoginAuth(cfg.Username, cfg.Password)
				} else {
					auth = smtp.PlainAuth("", cfg.Username, cfg.Password, cfg.Host)
				}
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

	// Standard SMTP connection (Port 25 or 587)
	conn, err := net.DialTimeout("tcp", addr, 10*time.Second)
	if err != nil {
		return fmt.Errorf("failed to connect to SMTP host %s: %w", addr, err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, cfg.Host)
	if err != nil {
		return fmt.Errorf("failed to establish SMTP session: %w", err)
	}
	defer client.Close()

	// SMTPSecure = 'auto' or 'tls' or 'starttls': Upgrade to TLS if STARTTLS supported by server
	enc := strings.ToLower(strings.TrimSpace(cfg.Encryption))
	if enc == "auto" || enc == "tls" || enc == "starttls" || enc == "" {
		if ok, _ := client.Extension("STARTTLS"); ok {
			tlsConfig := &tls.Config{
				ServerName:         cfg.Host,
				InsecureSkipVerify: true, // SMTPOptions verify_peer=false, verify_peer_name=false
			}
			if err = client.StartTLS(tlsConfig); err != nil && enc != "auto" {
				return fmt.Errorf("STARTTLS upgrade failed: %w", err)
			}
		}
	}

	// Authentication (supports LOGIN & PLAIN with fallback)
	if cfg.Username != "" && cfg.Password != "" {
		if ok, auths := client.Extension("AUTH"); ok {
			var auth smtp.Auth
			if strings.Contains(strings.ToUpper(auths), "LOGIN") {
				auth = LoginAuth(cfg.Username, cfg.Password)
			} else {
				auth = smtp.PlainAuth("", cfg.Username, cfg.Password, cfg.Host)
			}
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
  <div style="width: 100%; border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; background: #ffffff;">
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
