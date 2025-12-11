# Startup Guide

Quick reference for starting the Cloud Development Environment.

## One-Command Startup Options

### Option 1: Simple NPM Command (Recommended)

#### Local Development with Azurite
```bash
# Starts: Azurite + Frontend + Backend
pnpm dev:local
```

#### Production with Azure CLI
```bash
# Starts: Frontend + Backend (no Azurite)
# Requires: az login (done beforehand)
pnpm dev:all
```

### Option 2: Bash Script (More Control)

#### Start Everything
```bash
# Basic: Frontend + Backend
./start-dev.sh

# With Azurite: All three services
./start-dev.sh --azurite
```

The script provides:
- ✅ Prerequisite checks (Node.js, pnpm, Azurite)
- ✅ Port conflict detection
- ✅ Automatic dependency installation
- ✅ Color-coded output
- ✅ Clean shutdown on Ctrl+C

---

## Individual Services (Manual Control)

If you prefer starting services separately:

### Terminal 1: Backend
```bash
cd backend
pnpm dev
```

### Terminal 2: Frontend
```bash
pnpm dev
```

### Terminal 3: Azurite (optional)
```bash
azurite --silent --location /tmp/azurite
```

---

## First-Time Setup

### 1. Install Dependencies
```bash
# Frontend dependencies
pnpm install

# Backend dependencies
cd backend && pnpm install && cd ..

# Install concurrently (for pnpm scripts)
pnpm install
```

### 2. Configure Backend
```bash
cd backend
cp .env.example .env
# Edit .env with your settings
```

**Required settings:**
```bash
E2B_API_KEY=your_e2b_api_key_here
```

**For local development (Azurite):**
```bash
AZURE_STORAGE_ENABLED=true
AZURE_AUTH_MODE=key
AZURE_STORAGE_ACCOUNT=devstorageaccount1
AZURE_STORAGE_KEY=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==
```

**For production (Azure CLI):**
```bash
AZURE_STORAGE_ENABLED=true
AZURE_AUTH_MODE=cli
AZURE_STORAGE_ACCOUNT=your_storage_account
# No AZURE_STORAGE_KEY needed
```

### 3. Install Global Tools (if needed)

#### Azurite (for local development)
```bash
npm install -g azurite
```

#### Azure CLI (for production)
```bash
# macOS
brew install azure-cli

# Windows
# Download from: https://aka.ms/installazurecliwindows

# Linux
# See: https://docs.microsoft.com/cli/azure/install-azure-cli-linux

# Login
az login
az account show
```

---

## Quick Reference

| Command | Services | Use Case |
|---------|----------|----------|
| `pnpm dev:local` | Azurite + Frontend + Backend | Local development |
| `pnpm dev:all` | Frontend + Backend | Production with Azure CLI |
| `./start-dev.sh` | Frontend + Backend | Manual control |
| `./start-dev.sh --azurite` | All three | Local with checks |

---

## Troubleshooting

### "Port already in use"

**Frontend (5174):**
```bash
lsof -i :5174 | grep LISTEN | awk '{print $2}' | xargs kill
```

**Backend (3000):**
```bash
lsof -i :3000 | grep LISTEN | awk '{print $2}' | xargs kill
```

**Azurite (10000):**
```bash
lsof -i :10000 | grep LISTEN | awk '{print $2}' | xargs kill
```

### "E2B_API_KEY not set"
```bash
# Get your API key from: https://e2b.dev/dashboard
# Add to backend/.env:
E2B_API_KEY=your_actual_key_here
```

### "Azure CLI authentication required"
```bash
# Login to Azure
az login

# Verify authentication
az account show

# Make sure backend/.env has:
AZURE_AUTH_MODE=cli
```

### "Azurite not found"
```bash
# Install Azurite globally
npm install -g azurite

# Or use key auth with real Azure Storage instead
```

### Services won't start
```bash
# 1. Check prerequisites
./start-dev.sh --help

# 2. Install dependencies
pnpm install
cd backend && pnpm install && cd ..

# 3. Check configuration
cat backend/.env

# 4. Check ports
lsof -i :5174,3000,10000
```

---

## Stopping Services

### If using pnpm scripts
```bash
# Press Ctrl+C in the terminal
# All services will stop together
```

### If using bash script
```bash
# Press Ctrl+C
# Script handles cleanup automatically
```

### If running manually
```bash
# Press Ctrl+C in each terminal
# Or kill all:
pkill -f "vite"
pkill -f "pnpm dev"
pkill -f "azurite"
```

---

## What Runs Where

| Service | Port | URL |
|---------|------|-----|
| Frontend (Vite) | 5174 | http://localhost:5174 |
| Backend (Express) | 3000 | http://localhost:3000 |
| Azurite (Blob) | 10000 | http://localhost:10000 |

---

## Next Steps After Startup

1. **Open browser**: http://localhost:5174
2. **Click "Start Session"**
3. **Wait ~5 seconds** for e2b sandbox to create
4. **Start coding** in the terminal!

Files are automatically persisted in:
- **Local**: Azurite storage at `/tmp/azurite`
- **Production**: Azure Blob Storage

---

**Ready to start coding! 🚀**
