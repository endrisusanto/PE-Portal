# 🏭 PE-Portal (SEIN Production Engineer Team Platform)

[![Go Version](https://img.shields.io/badge/Go-1.22+-00ADD8?style=flat&logo=go)](https://golang.org)
[![React](https://img.shields.io/badge/React-19.0-61DAFB?style=flat&logo=react)](https://react.dev)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?style=flat&logo=postgresql)](https://www.postgresql.org)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?style=flat&logo=redis)](https://redis.io)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat&logo=docker)](https://www.docker.com)
[![License](https://img.shields.io/badge/License-Proprietary%20%2F%20Internal-red.svg)](LICENSE)

An all-in-one, ultra-fast, low-resource engineering management platform specifically engineered for the **SEIN PE Group** (~30 engineers). Designed to streamline best practice innovations, product model stage developments, digital reports, automated email dispatch, and AI/MCP integrations with responsive design and rich visual themes.

---

## 👥 SEIN PE Group Structure

The platform is architected around the distinct workflows of the three core divisions in SEIN PE:

```
                          ┌────────────────────────────────┐
                          │         SEIN PE Group          │
                          └──────────────┬─────────────────┘
                                         │
        ┌────────────────────────────────┼────────────────────────────────┐
        ▼                                ▼                                ▼
┌──────────────────────┐      ┌──────────────────────┐      ┌──────────────────────┐
│    PE Production     │      │       PE Mecha       │      │ PE Solution Product. │
├──────────────────────┤      ├──────────────────────┤      ├──────────────────────┤
│ • BOM Management     │      │ • JIG Development    │      │ • IMEI Management    │
│ • Setup Work Instruct│      │ • Unit BOX Develop.  │      │ • Program PGM Mgmt   │
│ • Support Production │      │ • MRO Management     │      │ • Technical Analyst  │
│                      │      │ • Mechanical Analyst │      │ • Software Develop.  │
│                      │      │ • Support Production │      │ • GBA Task Manager   │
│                      │      │                      │      │ • Release Management │
│                      │      │                      │      │ • Sample Management  │
└──────────────────────┘      └──────────────────────┘      └──────────────────────┘
```

---

## 🌟 Key Features

### 💡 1. Innovation & Best Practice (BP) Management
- Idea pipeline tracking (Draft, Review, Testing, Implemented, Archived).
- Voting, team comments, cost-saving calculations, and tag-based discovery.
- Cross-divisional sharing between Production, Mecha, and Solution.

### 🚀 2. Project Development & Milestone Tracking
- Timeline, priority, status badges, and team member assignments.
- Task breakdown for JIG developments, Unit BOX builds, and MRO maintenance.

### 📱 3. New Model Development (NMD)
- Dedicated stage tracking for upcoming commercial devices (e.g., **S26 Series — Codename: Paradigm**).
- Stage gates: `Proto` ➔ `EVT` ➔ `DVT` ➔ `PVT` ➔ `MP` (Mass Production).
- Issue logs, risk register, and readiness checklists.

### 📑 4. IMEI Management & Knowledge Articles
- Categorized articles and technical runbooks grouped by model series.
- Fast full-text search and tagging for production line troubleshooting.

### 📂 5. Engineering Document Archive Database
- Centralized technical drawing, spec sheet, and procedure repository.
- **View-only Document Viewer**: Safe in-browser preview for PDF, DOCX, XLSX, and images without high-memory Office servers.

### 🤖 6. AI Assistant & Model Context Protocol (MCP) Integration
- **Interactive Engineering Chat**: Real-time floating AI assistant connected to OpenAI-compatible LLMs (e.g. **LM Studio** endpoint `https://lmstudio.endrisusanto.my.id/v1`).
- **Personal LLM Key Override**: Engineers can configure their own custom provider & API key in their Profile.
- **Custom MCP Client Support**: Direct connection to external MCP servers such as the Google Build Approval (GBA) Task Server (`http://107.102.39.55:3800/mcp`).

### 📧 7. Digital Work Reports & Scheduled Email Dispatch
- **Rich Document Editor**: Notion-like block editor with 1-click database scrapers (insert live Innovation, Project, or Model data).
- **Flexible & Responsive Email Template**: Fluid table layout scaling up to `960px` with mobile `@media` optimization.
- **Interactive Recipient Chips**: Email tags with `✕` remove buttons, keyboard navigation (`Enter`, `,`, `Backspace`), and multi-address paste parser.
- **Custom Email Contact Lists**: Save and 1-click insert recipient groups (e.g., *Part Leader, Mecha Team, Solution Group*).
- **Automated Scheduling**: Cron-based background dispatcher with custom delivery hour selection and full transmission audit logs.

### 🎨 8. Decorative Themes & 60 FPS Animated Backgrounds
- **Zero Bloat (`/ponytail`)**: Built with native standard CSS variables and lightweight HTML5 Canvas 2D without heavy 3D/particle libraries.
- **Curated Theme Presets**:
  - 🌸 **Sakura Mochi (Cute)**: Floating cherry blossom petals with 3D rotation & soft pastel bubbles.
  - ⚡ **Neon Emerald (Cyberpunk)**: Matrix digital data streamers & green neon horizon glow.
  - 🌌 **Galactic Cobalt**: Twinkling celestial starfield with diamond flares & cosmic nebula drift.
  - 🌅 **Sunset Amber**: Warm rising forge embers with golden flickering sparks.
  - 🔮 **Cyber Lavender**: Ethereal rotating violet crystal diamond stars & cosmic aura.
  - 🏢 **SEIN Corporate Teal**: Geometric constellation engineering nodes with dynamic proximity links.
  - 🎨 **Personal Custom Scheme**: Live HTML5 Hex Color Picker (`#rrggbb`) with dynamic tint generation.
- **Tactile Dark Mode**: Fine sand grain micro-filter overlay for high-end visual surface depth.
- **User Controls**: Instant 1-click toggle switch in the TopBar (🎨) and Profile settings.

### 🌐 9. Multilingual Support (3 Languages)
- **Compact Segmented Switch Buttons**: `🌐 [ EN | ID | KO ]` for instant 1-click language toggling.
- Fully translated into **English**, **Bahasa Indonesia**, and **한국어 (Korean)**.

### 🔐 10. Security & Enterprise Authentication
- Role-Based Access Control (**Admin**, **Engineer**, **Viewer**).
- Dual Authentication engine: Local JWT Session or corporate **LDAP / Active Directory**.
- Granular action audit logging.

---

## 🛠️ Technology Stack

| Layer | Technologies | Highlights |
| :--- | :--- | :--- |
| **Frontend** | React 19, Vite, Vanilla CSS Modules, Lucide Icons | Ultra-fast build (< 300ms), 0 external UI bloat, responsive |
| **Backend** | Go 1.22+, Gin Web Framework, pgx | Low memory footprint (< 35MB idle), fast concurrency |
| **Database** | PostgreSQL 16 | Relational data, full schema migrations, indexes |
| **Cache & Queue**| Redis 7 | Fast token blacklist, scheduled task coordination |
| **AI / Protocol**| OpenAI-compatible API, Model Context Protocol (MCP) | LM Studio, Claude, Gemini, GBA MCP |
| **Container** | Docker, Docker Compose, Nginx Alpine | Production-ready multi-stage containers |

---

## 🚀 Quick Start (Docker Compose)

### 1. Clone the Repository
```bash
git clone https://github.com/endrisusanto/PE-Portal.git
cd PE-Portal
```

### 🪟 Windows Auto-Deploy (1-Click Launch)
If you are deploying on Windows:
- Simply double-click **`deploy-windows.bat`** (Command Prompt), OR
- Run in PowerShell:
```powershell
.\deploy-windows.ps1
```
The script will automatically detect Docker Desktop, initialize `.env`, build and run all containers, and automatically launch your default browser to `http://localhost:3025`.

---

### 🐧 Linux / macOS Deployment (Manual Docker Compose)

### 2. Configure Environment Variables
Copy the example environment configuration:
```bash
cp .env.example .env
```
*(Optionally adjust ports, database passwords, or SMTP host inside `.env`)*

### 3. Launch Services
Start all containers in detached mode:
```bash
docker compose up -d --build
```

### 4. Access the Application
Open your web browser and navigate to:
```
http://localhost:3025
```

### 5. Default Credentials
| Role | Username | Password |
| :--- | :--- | :--- |
| **Administrator** | `admin` | `admin123` |
| **Production Engineer** | `engineer` | `engineer123` |
| **Viewer** | `viewer` | `viewer123` |

*(Please change default passwords in production via the Profile page).*

---

## 🌐 Port Mapping

| Service | Container Name | Internal Port | Host Port | Description |
| :--- | :--- | :--- | :--- | :--- |
| **Frontend** | `pe-portal-frontend` | `80` | `3025` | Nginx Alpine React SPA |
| **Backend API** | `pe-portal-backend` | `8085` | `8085` | Go Gin REST API |
| **Database** | `pe-portal-postgres` | `5432` | `5432` | PostgreSQL 16 DB |
| **Cache** | `pe-portal-redis` | `6379` | `6379` | Redis 7 Task/Cache |

---

## 💻 Local Development Setup (Without Docker)

### Prerequisites
- **Go**: 1.22+
- **Node.js**: 20+ & npm
- **PostgreSQL**: 16+
- **Redis**: 7+

### 1. Database Setup
```bash
createdb -U postgres pe_portal
psql -U postgres -d pe_portal -f migrations/001_init.sql
psql -U postgres -d pe_portal -f migrations/002_seed.sql
psql -U postgres -d pe_portal -f migrations/003_reports_smtp.sql
psql -U postgres -d pe_portal -f migrations/004_llm_config.sql
psql -U postgres -d pe_portal -f migrations/005_user_email_lists.sql
```

### 2. Run Backend
```bash
cd backend
export DATABASE_URL="postgres://postgres:password@localhost:5432/pe_portal?sslmode=disable"
export REDIS_URL="redis://localhost:6379"
export JWT_SECRET="your_development_secret_key"
go run cmd/server/main.go
```

### 3. Run Frontend
```bash
cd frontend
npm install
npm run dev
```
Frontend development server will be available at `http://localhost:5173` (proxied to API at `8085`).

---

## 📁 Repository Structure

```
PE-Portal/
├── .env.example              # Template environment configuration
├── .gitignore                # Git ignore rules for Go, Node, and secrets
├── docker-compose.yml        # Docker compose service definition
├── README.md                 # Project documentation
│
├── backend/                  # Go REST API backend
│   ├── cmd/server/main.go    # Application entrypoint
│   ├── Dockerfile            # Multi-stage Go build container
│   ├── go.mod / go.sum       # Go module dependencies
│   ├── internal/
│   │   ├── auth/             # JWT and LDAP providers
│   │   ├── config/           # Environment loader
│   │   ├── database/         # Postgres and Redis connection pools
│   │   ├── handler/          # HTTP request handlers (REST)
│   │   ├── i18n/             # Server-side localization files
│   │   ├── middleware/       # RBAC, Auth, Audit log middlewares
│   │   ├── model/            # Go domain struct definitions
│   │   ├── repository/       # Database SQL queries
│   │   └── service/          # SMTP dispatcher, LLM client, cron scheduler
│   └── migrations/           # Database SQL schema migrations (001 - 005)
│
├── frontend/                 # React 19 + Vite frontend
│   ├── Dockerfile            # Multi-stage build with Nginx Alpine
│   ├── nginx.conf            # Nginx reverse proxy & SPA router config
│   ├── package.json          # Frontend dependencies
│   ├── vite.config.js        # Vite build & proxy settings
│   └── src/
│       ├── api/              # Axios HTTP client with JWT interceptor
│       ├── components/
│       │   ├── common/       # Button, EmailChipInput, LanguageSwitcher,
│       │   │                 # ThemePalettePicker, ThemeAnimatedBackground, Modal
│       │   └── layout/       # AppShell, TopBar, Sidebar
│       ├── contexts/         # AuthContext, ThemeContext, LanguageContext
│       ├── pages/            # Dashboard, Innovations, Projects, Models,
│       │                     # IMEI, Documents, Reports, ReportEditor, Profile, Settings
│       ├── index.css         # Design system tokens, grain, palettes
│       └── main.jsx          # React DOM root entrypoint
```

---

## 📄 License & Attribution

Internal engineering tool developed for **SEIN PE Group**.  
Built with care following the principles of high-performance engineering (`/ponytail`) and polished interface design (`/emil-design-eng` & `/better-ui`).
