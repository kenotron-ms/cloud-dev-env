# Cloud Development Environment

**Purpose**: Browser-based cloud development environment with persistent storage

A full-featured development environment accessible through a web browser, with all files stored in Azure Blob Storage for persistence across sessions.

## Architecture

```
┌─────────────┐     WebSocket      ┌─────────────┐     PTY      ┌─────────────┐     FUSE      ┌─────────────┐
│   Browser   │ ←─────────────────→ │   Backend   │ ←───────────→ │ e2b Sandbox │ ←───────────→ │Azure Blob   │
│  (xterm.js) │   Terminal I/O      │  (Node.js)  │   Terminal    │ (PTY+bash)  │   File Ops    │Storage      │
└─────────────┘                     └─────────────┘               └─────────────┘               └─────────────┘
```

## Features

- 🖥️ **Browser-based terminal**: xterm.js with full-screen support and auto-resize
- 🔒 **Isolated sandboxes**: Powered by e2b.dev for secure execution
- ☁️ **Cloud persistence**: Azure Blob Storage via FUSE mount
- 🔄 **Auto-reconnect**: Exponential backoff on disconnections
- 📦 **Modular architecture**: Clear separation of concerns
- 🚀 **Fast setup**: Development (Azurite) and production (Azure) modes
- 🎨 **Classic terminal theme**: Dark background with green text
- 🔗 **Clickable links**: Web links automatically detected

## Project Structure

```
cloud-dev-env/
├── README.md                      # This file
├── TESTING-GUIDE.md              # Comprehensive testing guide
├── src/                          # Frontend source
│   ├── App.tsx                   # Main application
│   ├── components/
│   │   └── Terminal.tsx          # xterm.js terminal component
│   └── lib/
│       └── websocket.ts          # WebSocket connection manager
└── backend/                      # Backend source
    ├── README.md                 # Backend documentation
    ├── IMPLEMENTATION.md         # Implementation details
    ├── .e2b/
    │   └── Dockerfile            # E2B sandbox template
    └── src/
        ├── index.ts              # Server entry point
        ├── config/env.ts         # Environment configuration
        ├── sandbox/manager.ts    # E2B sandbox lifecycle
        ├── storage/azure-blob.ts # Azure Blob config generator
        └── websocket/handler.ts  # WebSocket connection handler
```

## Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- E2B API key ([get one here](https://e2b.dev/dashboard))
- Azure Storage account OR Azurite for local development
- Azure CLI (for CLI authentication mode - recommended)

### Local Development Setup

#### Option A: Azure CLI Authentication (Recommended)

1. **Install and authenticate with Azure CLI**:
```bash
# Install Azure CLI (if not already installed)
# macOS: brew install azure-cli
# Windows: Download from https://aka.ms/installazurecliwindows
# Linux: See https://docs.microsoft.com/cli/azure/install-azure-cli-linux

# Login to Azure
az login

# Verify authentication
az account show
```

2. **Setup Frontend**:
```bash
pnpm install
pnpm dev
# Frontend runs on http://localhost:5174
```

3. **Setup Backend**:
```bash
cd backend
cp .env.example .env
# Edit .env with your settings:
#   E2B_API_KEY=your_key
#   AZURE_STORAGE_ENABLED=true
#   AZURE_AUTH_MODE=cli  # Uses Azure CLI credentials (no key needed)
#   AZURE_STORAGE_ACCOUNT=your_storage_account
pnpm install
pnpm dev
# Backend runs on http://localhost:3000
```

4. **Create Blob Container**:
```bash
az storage container create \
  --name cloud-dev-workspace \
  --account-name your_storage_account
```

#### Option B: Key-Based Authentication (Fallback)

Use this for Azurite (local development emulator) or when Azure CLI is not available:

1. **Start Azurite** (Azure Storage emulator):
```bash
npm install -g azurite
azurite --silent --location /tmp/azurite
```

2. **Setup Frontend**: (same as Option A)

3. **Setup Backend**:
```bash
cd backend
cp .env.example .env
# Edit .env with your settings:
#   E2B_API_KEY=your_key
#   AZURE_STORAGE_ENABLED=true
#   AZURE_AUTH_MODE=key  # Uses storage account key
#   AZURE_STORAGE_ACCOUNT=devstorageaccount1
#   AZURE_STORAGE_KEY=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==
pnpm install
pnpm dev
```

4. **Create Blob Container**:
```bash
az storage container create \
  --name cloud-dev-workspace \
  --connection-string "DefaultEndpointsProtocol=http;AccountName=devstorageaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstorageaccount1;"
```

5. **Open Browser**:
   - Navigate to http://localhost:5174
   - Click "Start Session"
   - Wait for terminal to connect
   - Start coding! Files are persisted in Azure Blob Storage

## Testing

See [TESTING-GUIDE.md](./TESTING-GUIDE.md) for comprehensive testing instructions, including:
- Frontend connection tests
- E2B sandbox creation verification
- Azure Blob Storage mount validation
- File persistence tests
- Performance benchmarks
- Common troubleshooting

Quick smoke test:
```bash
# 1. Start services (frontend + backend + Azurite)
# 2. Open http://localhost:5174
# 3. Click "Start Session"
# 4. In terminal, run:
cd /workspace/files
echo "Hello Cloud!" > test.txt
cat test.txt
# Should see: Hello Cloud!

# 5. Verify in Azure:
az storage blob list \
  --container-name cloud-dev-workspace \
  --connection-string "..." \
  --output table
# Should see test.txt
```

## Implementation Status

All phases complete:
- ✅ **Phase 1**: Frontend with xterm.js terminal
- ✅ **Phase 2**: Backend with e2b.dev sandbox integration
- ✅ **Phase 3**: FUSE + Azure Blob Storage mounting
- ✅ **Testing**: Comprehensive testing guide

**What works:**
- ✅ Browser-based terminal with full xterm.js features
- ✅ WebSocket connection with auto-reconnect
- ✅ E2B sandbox creation and management
- ✅ PTY-based interactive terminal
- ✅ Azure Blob Storage mounting via FUSE
- ✅ File persistence across sandbox restarts
- ✅ Graceful cleanup on disconnect/timeout
- ✅ Development mode with Azurite emulator
- ✅ Production mode with real Azure Storage

## Technology Stack

**Frontend:**
- Vite - Fast build tool
- React - UI framework (functional components + hooks)
- TypeScript - Type safety with strict mode
- xterm.js - Terminal emulator with addons

**Backend:**
- Node.js + Express - Web server
- ws - WebSocket library
- TypeScript - Type safety
- e2b SDK - Sandbox management

**Infrastructure:**
- e2b.dev - Sandboxed code execution
- Azure Blob Storage - Cloud file persistence
- blobfuse2 - FUSE driver for Azure Blob
- Azurite - Local Azure emulator

## Configuration

### Frontend Environment Variables

Create `.env`:
```bash
VITE_API_URL=http://localhost:3000  # Backend WebSocket URL
```

### Backend Environment Variables

Create `backend/.env`:

**Option A: Azure CLI Authentication (Recommended)**
```bash
# E2B Configuration (required)
E2B_API_KEY=your_e2b_api_key

# Azure Storage Configuration
AZURE_STORAGE_ENABLED=true
AZURE_AUTH_MODE=cli  # Use Azure CLI credentials (az login)
AZURE_STORAGE_ACCOUNT=your_storage_account
# AZURE_STORAGE_KEY not needed with cli mode
AZURE_STORAGE_CONTAINER=cloud-dev-workspace

# Server Configuration (optional)
PORT=3000
FRONTEND_URL=http://localhost:5174
SANDBOX_TIMEOUT=3600
```

**Option B: Key-Based Authentication (Azurite/Fallback)**
```bash
# E2B Configuration (required)
E2B_API_KEY=your_e2b_api_key

# Azure Storage Configuration
AZURE_STORAGE_ENABLED=true
AZURE_AUTH_MODE=key  # Use storage account key
AZURE_STORAGE_ACCOUNT=devstorageaccount1
AZURE_STORAGE_KEY=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==
AZURE_STORAGE_CONTAINER=cloud-dev-workspace

# Server Configuration (optional)
PORT=3000
FRONTEND_URL=http://localhost:5174
SANDBOX_TIMEOUT=3600
```

## Troubleshooting

### "WebSocket connection failed"
- Verify backend is running on correct port
- Check CORS settings in backend
- Verify VITE_API_URL matches backend address

### "E2B sandbox creation failed"
- Check E2B_API_KEY is valid
- Verify E2B account has available quota
- Check E2B dashboard for error details

### "Azure Blob mount failed"
- Verify Azure credentials are correct
- Check blob container exists
- For Azurite: Ensure Azurite is running

### "Files not persisting"
- Verify working directory is `/workspace/files`
- Check mount status: `df -h /workspace/files`
- Verify blob container has write permissions

See [TESTING-GUIDE.md](./TESTING-GUIDE.md) for detailed troubleshooting.

## Design Philosophy

Following ruthless simplicity and modular design principles:

1. **Minimal abstractions**: Direct implementations without unnecessary layers
2. **Clear module boundaries**: Self-contained components with explicit contracts
3. **Graceful degradation**: System handles failures at every level
4. **Development-friendly**: Easy local setup with Azurite emulator
5. **Production-ready**: Seamless transition to real Azure Storage

## Contributing

See [backend/IMPLEMENTATION.md](./backend/IMPLEMENTATION.md) for detailed implementation notes.

## License

MIT License - Part of the agent-sandbox cloud development environment project.

## Acknowledgments

Built with:
- [e2b.dev](https://e2b.dev) - Sandboxed code execution
- [xterm.js](https://xtermjs.org) - Terminal emulator
- [Vite](https://vitejs.dev) - Build tool
- [React](https://react.dev) - UI framework
- [Azure Blob Storage](https://azure.microsoft.com/services/storage/blobs/) - Cloud storage
- [blobfuse2](https://github.com/Azure/azure-storage-fuse) - FUSE driver

---

**Ready to code in the cloud! ☁️**
