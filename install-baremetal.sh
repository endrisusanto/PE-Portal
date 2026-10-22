#!/usr/bin/env bash
# ==============================================================================
# SEIN PE-Portal - Bare Metal Automated Installer & Setup
# Mode: /ponytail (Minimalist, senior-dev, idempotent, zero unnecessary bloat)
# ==============================================================================
# Features:
#   1. Automatic Git Clone / Repo Sync
#   2. System Runtime Dependencies (Go 1.22+, Node.js 20+, PostgreSQL 16, Redis, Python3)
#   3. Database Creation & Migration (PostgreSQL + Redis)
#   4. Environment Configuration (.env setup)
#   5. Backend Binary Compilation & Frontend Production Build
#   6. Standalone Process Runner (start/stop) & Optional Systemd Services
# ==============================================================================

set -euo pipefail

# Text formatting
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${CYAN}================================================================${NC}"
echo -e "${CYAN}    SEIN PRODUCTION ENGINEER PORTAL - BARE METAL INSTALLER      ${NC}"
echo -e "${CYAN}================================================================${NC}"

REPO_URL="https://github.com/endrisusanto/PE-Portal.git"
DEFAULT_INSTALL_DIR="PE-Portal"
DB_NAME="pe_portal"
DB_USER="pe_portal"
DB_PASS="sein_pe_portal_secret_2026"
BACKEND_PORT="8085"
FRONTEND_PORT="3025"

# Determine privilege helper
SUDO=""
if [ "$(id -u)" -ne 0 ]; then
    if command -v sudo >/dev/null 2>&1; then
        SUDO="sudo"
    else
        echo -e "${RED}[ERROR] This installer requires root or sudo privileges.${NC}"
        exit 1
    fi
fi

# Detect calling user
ACTUAL_USER="${SUDO_USER:-$USER}"

# ------------------------------------------------------------------------------
# STEP 1: Repository Detection & Git Clone
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[1/6] Checking Repository Directory...${NC}"

if [ -f "backend/cmd/server/main.go" ] && [ -f "frontend/package.json" ]; then
    PROJECT_DIR="$(pwd)"
    echo -e "${GREEN}✓ Already inside PE-Portal repository:${NC} ${PROJECT_DIR}"
elif [ -d "$DEFAULT_INSTALL_DIR/backend/cmd/server" ]; then
    cd "$DEFAULT_INSTALL_DIR"
    PROJECT_DIR="$(pwd)"
    echo -e "${GREEN}✓ Found existing PE-Portal directory:${NC} ${PROJECT_DIR}"
else
    echo -e "${YELLOW}Cloning repository from ${REPO_URL}...${NC}"
    if ! command -v git >/dev/null 2>&1; then
        echo "Installing git..."
        $SUDO apt-get update -y && $SUDO apt-get install -y git
    fi
    git clone "$REPO_URL" "$DEFAULT_INSTALL_DIR"
    cd "$DEFAULT_INSTALL_DIR"
    PROJECT_DIR="$(pwd)"
    echo -e "${GREEN}✓ Repository cloned to:${NC} ${PROJECT_DIR}"
fi

# ------------------------------------------------------------------------------
# STEP 2: Install System Packages & Runtimes
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[2/6] Installing System Dependencies (Debian/Ubuntu)...${NC}"

if command -v apt-get >/dev/null 2>&1; then
    $SUDO apt-get update -y
    $SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y \
        curl wget build-essential git \
        postgresql postgresql-contrib \
        redis-server \
        python3 python3-pip python3-venv \
        ca-certificates gnupg
else
    echo -e "${YELLOW}[NOTE] Non-Debian/Ubuntu system detected. Ensure PostgreSQL, Redis, Go, and Node.js are installed manually.${NC}"
fi

# Verify / Install Go (1.22+)
echo -e "\nChecking Go runtime..."
NEED_GO_INSTALL=false
if command -v go >/dev/null 2>&1; then
    GO_VER=$(go version | awk '{print $3}' | sed 's/go//')
    GO_MAJOR=$(echo "$GO_VER" | cut -d. -f1)
    GO_MINOR=$(echo "$GO_VER" | cut -d. -f2)
    if [ "$GO_MAJOR" -lt 1 ] || { [ "$GO_MAJOR" -eq 1 ] && [ "$GO_MINOR" -lt 22 ]; }; then
        echo -e "${YELLOW}Installed Go (${GO_VER}) is below 1.22. Updating...${NC}"
        NEED_GO_INSTALL=true
    else
        echo -e "${GREEN}✓ Go runtime is ready:${NC} $(go version)"
    fi
else
    NEED_GO_INSTALL=true
fi

if [ "$NEED_GO_INSTALL" = true ]; then
    echo -e "${YELLOW}Installing Go 1.22.8 official binary...${NC}"
    GO_TAR="go1.22.8.linux-amd64.tar.gz"
    curl -fsSL "https://go.dev/dl/${GO_TAR}" -o "/tmp/${GO_TAR}"
    $SUDO rm -rf /usr/local/go
    $SUDO tar -C /usr/local -xzf "/tmp/${GO_TAR}"
    rm -f "/tmp/${GO_TAR}"
    
    # Ensure /usr/local/go/bin is in PATH
    if ! echo "$PATH" | grep -q "/usr/local/go/bin"; then
        export PATH="/usr/local/go/bin:$PATH"
        echo 'export PATH="/usr/local/go/bin:$PATH"' | $SUDO tee -a /etc/profile.d/go.sh >/dev/null
    fi
    echo -e "${GREEN}✓ Go installed:${NC} $(go version)"
fi

# Verify / Install Node.js (20+ LTS)
echo -e "\nChecking Node.js & npm..."
NEED_NODE_INSTALL=false
if command -v node >/dev/null 2>&1; then
    NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$NODE_VER" -lt 18 ]; then
        echo -e "${YELLOW}Node.js (${NODE_VER}) is below v18 LTS. Updating...${NC}"
        NEED_NODE_INSTALL=true
    else
        echo -e "${GREEN}✓ Node.js runtime is ready:${NC} $(node -v), npm: $(npm -v)"
    fi
else
    NEED_NODE_INSTALL=true
fi

if [ "$NEED_NODE_INSTALL" = true ]; then
    echo -e "${YELLOW}Installing Node.js 20.x LTS via NodeSource...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash -
    $SUDO apt-get install -y nodejs
    echo -e "${GREEN}✓ Node.js installed:${NC} $(node -v), npm: $(npm -v)"
fi

# Optional Python Pillow for local background removal
if command -v python3 >/dev/null 2>&1; then
    echo -e "\nChecking Python Pillow dependency..."
    python3 -c "import PIL" 2>/dev/null || {
        echo -e "${YELLOW}Installing Pillow for local image tools...${NC}"
        $SUDO apt-get install -y python3-pil || pip3 install --break-system-packages pillow 2>/dev/null || true
    }
fi

# ------------------------------------------------------------------------------
# STEP 3: Database & Cache Setup (PostgreSQL & Redis)
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[3/6] Configuring Database (PostgreSQL) & Cache (Redis)...${NC}"

# Enable & start system services
if command -v systemctl >/dev/null 2>&1; then
    $SUDO systemctl enable --now postgresql || true
    $SUDO systemctl enable --now redis-server || $SUDO systemctl enable --now redis || true
fi

# Create PostgreSQL User & Database
echo "Creating database user and database if not present..."
$SUDO -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER'" | grep -q 1 || \
    $SUDO -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"

$SUDO -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
    $SUDO -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

$SUDO -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" >/dev/null

echo -e "${GREEN}✓ PostgreSQL database '${DB_NAME}' and user '${DB_USER}' configured.${NC}"

# Test Redis connection
if command -v redis-cli >/dev/null 2>&1; then
    if redis-cli ping | grep -q PONG; then
        echo -e "${GREEN}✓ Redis server is active and responding (PONG).${NC}"
    else
        echo -e "${YELLOW}[!] Redis is not responding to ping. Starting Redis service...${NC}"
        $SUDO systemctl restart redis-server || $SUDO systemctl restart redis || true
    fi
fi

# ------------------------------------------------------------------------------
# STEP 4: Environment Configuration (.env)
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[4/6] Setting up Environment Variables (.env)...${NC}"

mkdir -p "$PROJECT_DIR/data/files" "$PROJECT_DIR/bin" "$PROJECT_DIR/logs"

if [ ! -f "$PROJECT_DIR/.env" ]; then
    echo "Creating .env configuration for bare-metal..."
    cat > "$PROJECT_DIR/.env" <<EOF
# ==============================================================================
# SEIN PE-Portal Bare Metal Environment Configuration
# ==============================================================================

# Application Ports
PORT=${BACKEND_PORT}
BACKEND_PORT=${BACKEND_PORT}
FRONTEND_PORT=${FRONTEND_PORT}
DB_PORT=5432
REDIS_PORT=6379

# Database Connections (Bare Metal Localhost)
POSTGRES_DB=${DB_NAME}
POSTGRES_USER=${DB_USER}
DB_PASSWORD=${DB_PASS}
DATABASE_URL=postgres://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}?sslmode=disable
LOCAL_DATABASE_URL=postgres://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}?sslmode=disable

# Cache Connections
REDIS_URL=redis://localhost:6379
LOCAL_REDIS_URL=redis://localhost:6379

# JWT Security
JWT_SECRET=pe_portal_jwt_secret_super_secure_key_2026_sein_pe_group_random_64

# File Storage
FILE_STORAGE_PATH=${PROJECT_DIR}/data/files
LOCAL_FILE_STORAGE_PATH=${PROJECT_DIR}/data/files

# Authentication Provider: local | ldap
AUTH_PROVIDER=local

# Intranet Data Sources
GBA_API_URL=http://107.102.39.55/tkdn/api_kanban.php
SOFTWARE_MR_URL=http://107.102.39.55/companion-release-cheatsheet
SOFTWARE_MR_API_URL=http://107.102.39.55/companion-release-cheatsheet/api_releases.php
EOF
    echo -e "${GREEN}✓ Generated .env file.${NC}"
else
    echo -e "${GREEN}✓ Existing .env file found.${NC}"
fi

# ------------------------------------------------------------------------------
# STEP 5: Build Backend Binary & Frontend Production Bundle
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[5/6] Building Backend & Frontend...${NC}"

# Backend build
echo "Compiling Go backend server binary..."
(
    cd "$PROJECT_DIR/backend"
    go mod download
    go build -o "$PROJECT_DIR/bin/pe-portal-backend" cmd/server/main.go
)
echo -e "${GREEN}✓ Backend compiled successfully -> bin/pe-portal-backend${NC}"

# Frontend build
echo "Building React frontend production bundle..."
(
    cd "$PROJECT_DIR/frontend"
    npm install
    npm run build
)
echo -e "${GREEN}✓ Frontend production bundle built -> frontend/dist${NC}"

# ------------------------------------------------------------------------------
# STEP 6: Setup Standalone Runner Scripts & Systemd Services
# ------------------------------------------------------------------------------
echo -e "\n${YELLOW}[6/6] Generating Process Management Scripts...${NC}"

# 1. start-baremetal.sh
cat > "$PROJECT_DIR/start-baremetal.sh" << 'EOF'
#!/usr/bin/env bash
# ponytail: clean standalone runner for bare-metal
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

mkdir -p "$DIR/logs"

# Ensure postgres & redis services are running
if command -v systemctl >/dev/null 2>&1; then
    sudo systemctl start postgresql 2>/dev/null || true
    sudo systemctl start redis-server 2>/dev/null || sudo systemctl start redis 2>/dev/null || true
fi

# Stop existing running processes if any
"$DIR/stop-baremetal.sh" >/dev/null 2>&1 || true

echo "Starting PE-Portal Backend (Port 8085)..."
"$DIR/bin/pe-portal-backend" > "$DIR/logs/backend.log" 2>&1 &
echo $! > "$DIR/logs/backend.pid"

echo "Starting PE-Portal Frontend (Port 3025)..."
(cd "$DIR/frontend" && npm run preview -- --port 3025 --host) > "$DIR/logs/frontend.log" 2>&1 &
echo $! > "$DIR/logs/frontend.pid"

sleep 2

if ps -p $(cat "$DIR/logs/backend.pid") > /dev/null 2>&1 && ps -p $(cat "$DIR/logs/frontend.pid") > /dev/null 2>&1; then
    echo -e "\033[0;32m✓ SEIN PE-Portal is running successfully!\033[0m"
    echo -e "  - Frontend UI:  \033[1;33mhttp://localhost:3025\033[0m"
    echo -e "  - Backend API:  \033[1;33mhttp://localhost:8085\033[0m"
    echo -e "  - Logs:         $DIR/logs/"
    echo -e "  - Stop Command: ./stop-baremetal.sh"
else
    echo -e "\033[0;31m[!] One or more services failed to start. Check logs in $DIR/logs/\033[0m"
fi
EOF
chmod +x "$PROJECT_DIR/start-baremetal.sh"

# 2. stop-baremetal.sh
cat > "$PROJECT_DIR/stop-baremetal.sh" << 'EOF'
#!/usr/bin/env bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "Stopping PE-Portal bare metal services..."
if [ -f "$DIR/logs/backend.pid" ]; then
    kill $(cat "$DIR/logs/backend.pid") 2>/dev/null || true
    rm -f "$DIR/logs/backend.pid"
fi
if [ -f "$DIR/logs/frontend.pid" ]; then
    kill $(cat "$DIR/logs/frontend.pid") 2>/dev/null || true
    rm -f "$DIR/logs/frontend.pid"
fi

# Clean up any lingering node or backend processes on our ports
pkill -f "pe-portal-backend" 2>/dev/null || true
pkill -f "vite preview --port 3025" 2>/dev/null || true

echo "PE-Portal services stopped."
EOF
chmod +x "$PROJECT_DIR/stop-baremetal.sh"

# 3. Optional Systemd Unit Registration
if command -v systemctl >/dev/null 2>&1; then
    echo "Creating systemd service definitions..."
    
    # Backend Service
    cat <<EOF | $SUDO tee /etc/systemd/system/pe-portal-backend.service >/dev/null
[Unit]
Description=SEIN PE-Portal Backend Service
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=${ACTUAL_USER}
WorkingDirectory=${PROJECT_DIR}
ExecStart=${PROJECT_DIR}/bin/pe-portal-backend
Restart=always
RestartSec=5
StandardOutput=append:${PROJECT_DIR}/logs/backend.log
StandardError=append:${PROJECT_DIR}/logs/backend.log
EnvironmentFile=${PROJECT_DIR}/.env

[Install]
WantedBy=multi-user.target
EOF

    # Frontend Service
    NODE_BIN="$(which node || echo "/usr/bin/node")"
    NPM_BIN="$(which npm || echo "/usr/bin/npm")"
    cat <<EOF | $SUDO tee /etc/systemd/system/pe-portal-frontend.service >/dev/null
[Unit]
Description=SEIN PE-Portal Frontend Service
After=network.target pe-portal-backend.service

[Service]
Type=simple
User=${ACTUAL_USER}
WorkingDirectory=${PROJECT_DIR}/frontend
ExecStart=${NPM_BIN} run preview -- --port 3025 --host
Restart=always
RestartSec=5
StandardOutput=append:${PROJECT_DIR}/logs/frontend.log
StandardError=append:${PROJECT_DIR}/logs/frontend.log

[Install]
WantedBy=multi-user.target
EOF

    $SUDO systemctl daemon-reload
    echo -e "${GREEN}✓ Systemd service files installed (pe-portal-backend.service, pe-portal-frontend.service).${NC}"
fi

# Set proper ownership for non-root user
$SUDO chown -R "$ACTUAL_USER:$ACTUAL_USER" "$PROJECT_DIR/data" "$PROJECT_DIR/bin" "$PROJECT_DIR/logs" "$PROJECT_DIR/.env" 2>/dev/null || true

echo -e "\n${CYAN}================================================================${NC}"
echo -e "${GREEN}🎉 BARE METAL INSTALLATION COMPLETED SUCCESSFULLY!${NC}"
echo -e "${CYAN}================================================================${NC}"
echo -e "You can manage the application using either method below:\n"
echo -e "${YELLOW}Method 1: Standalone Runner (Quickest, No Root Required)${NC}"
echo -e "  Start:  ${CYAN}./start-baremetal.sh${NC}"
echo -e "  Stop:   ${CYAN}./stop-baremetal.sh${NC}"
echo -e "  Logs:   ${CYAN}tail -f logs/backend.log logs/frontend.log${NC}\n"
if command -v systemctl >/dev/null 2>&1; then
echo -e "${YELLOW}Method 2: Systemd Daemon (Auto-Start on Boot)${NC}"
echo -e "  Enable & Start:  ${CYAN}sudo systemctl enable --now pe-portal-backend pe-portal-frontend${NC}"
echo -e "  Check Status:    ${CYAN}sudo systemctl status pe-portal-backend pe-portal-frontend${NC}"
echo -e "  Restart:         ${CYAN}sudo systemctl restart pe-portal-backend pe-portal-frontend${NC}\n"
fi
echo -e "${CYAN}Web Portal Access:${NC}"
echo -e "  - Frontend UI:   ${GREEN}http://localhost:${FRONTEND_PORT}${NC}"
echo -e "  - Backend API:   ${GREEN}http://localhost:${BACKEND_PORT}${NC}"
echo -e "  - Default Login: ${YELLOW}admin${NC} / ${YELLOW}admin123${NC}"
echo -e "${CYAN}================================================================${NC}\n"
