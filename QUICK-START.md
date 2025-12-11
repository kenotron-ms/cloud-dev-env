# Quick Start

## One Command to Rule Them All

### Local Development (Recommended)
```bash
pnpm dev
```

This starts **everything** you need:
- ✅ Azurite (Azure Storage emulator)
- ✅ Frontend (http://localhost:5174)
- ✅ Backend (http://localhost:3000)

### Production (with Azure CLI)
```bash
pnpm dev:prod
```

This starts frontend + backend only (requires `az login` first).

---

## First Time Setup (One Time Only)

```bash
# 1. Install dependencies
pnpm install

# 2. Configure backend
cd backend
cp .env.example .env
# Edit .env: Add your E2B_API_KEY

# 3. Install Azurite globally
npm install -g azurite

# 4. Install concurrently
cd ..
pnpm install
```

---

## What You Need

1. **E2B API Key**: Get from https://e2b.dev/dashboard
2. **Azurite**: `npm install -g azurite`
3. **Backend .env file**: `cp backend/.env.example backend/.env`

---

## Usage

```bash
# Start everything (local development)
pnpm dev

# Open browser
open http://localhost:5174

# Click "Start Session"
# Wait ~5 seconds
# Start coding!
```

---

## Stopping

```bash
# Press Ctrl+C in the terminal
# All services stop together
```

---

## Common Issues

### "E2B_API_KEY not set"
```bash
# Add to backend/.env:
E2B_API_KEY=your_key_here
```

### "Azurite command not found"
```bash
npm install -g azurite
```

### "Port already in use"
```bash
# Kill all services
pkill -f "vite"
pkill -f "azurite"
```

---

## That's It!

Run `pnpm dev` and you're good to go! 🚀
