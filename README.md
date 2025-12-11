# Cloud Development Environment

**Purpose**: Browser-based cloud development environment with persistent storage

A full-featured development environment accessible through a web browser, with all files stored in **Cloudflare R2** for persistence across sessions.

## Architecture

```
┌─────────────┐     WebSocket      ┌─────────────┐     PTY      ┌─────────────┐    s3fs/FUSE   ┌─────────────┐
│   Browser   │ ←─────────────────→ │   Backend   │ ←───────────→ │ E2B Sandbox │ ←──────────────→ │Cloudflare R2│
│  (xterm.js) │   Terminal I/O      │  (Node.js)  │   Terminal    │ (PTY+bash)  │   File Ops      │   Storage   │
└─────────────┘                     └─────────────┘               └─────────────┘                 └─────────────┘
```

## Features

- 🖥️ **Browser-based terminal**: xterm.js with full-screen support and auto-resize
- 🔒 **Isolated sandboxes**: Powered by [E2B](https://e2b.dev) for secure execution
- ☁️ **Cloud persistence**: Cloudflare R2 (10GB free) via s3fs FUSE mount
- 🔄 **Sandbox reuse**: Connect to existing sandboxes to avoid rate limits
- ⚡ **High performance**: 4 vCPU, 4GB RAM sandboxes
- 📦 **Modular architecture**: Clear separation of concerns
- 🎨 **Classic terminal theme**: Dark background with green text
- 🔗 **Clickable links**: Web links automatically detected

## Quick Start

### Prerequisites

- Node.js 18+ and pnpm
- [E2B API key](https://e2b.dev/dashboard)
- [Cloudflare R2 account](https://dash.cloudflare.com) (free tier: 10GB storage)

### 1. Create Cloudflare R2 Bucket

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → **R2**
2. Click **Create bucket**
3. Name: `cloud-dev-workspace`
4. Click **Create**

### 2. Generate R2 API Tokens

1. R2 → **Manage R2 API Tokens**
2. Click **Create API token**
3. Permissions: **Admin Read & Write**
4. Copy:
   - Access Key ID
   - Secret Access Key
   - R2 endpoint URL

### 3. Build E2B Template

```bash
cd backend/.e2b
e2b template build
# This creates a custom template with s3fs, 4 vCPU, 4GB RAM
```

### 4. Setup Frontend

```bash
pnpm install
```

### 5. Setup Backend

```bash
cd backend
cp .env.example .env
# Edit .env:
#   E2B_API_KEY=your_e2b_key
#   CLOUD_STORAGE_ENABLED=true
#   CLOUD_STORAGE_TYPE=r2
#   R2_ACCESS_KEY_ID=your_r2_access_key
#   R2_SECRET_ACCESS_KEY=your_r2_secret
#   R2_ENDPOINT=https://your-account.r2.cloudflarestorage.com
#   R2_BUCKET=cloud-dev-workspace

pnpm install
```

### 6. Run Development Servers

```bash
# From project root:
pnpm dev

# This starts:
# - Frontend: http://localhost:5173 (or 5174 if 5173 is busy)
# - Backend: http://localhost:3000
```

### 7. Open in Browser

1. Navigate to http://localhost:5173
2. Click **"Start Session"**
3. Wait for terminal to connect
4. Start coding! Your files persist in Cloudflare R2

## Project Structure

```
cloud-dev-env/
├── README.md                      # This file
├── src/                          # Frontend source
│   ├── App.tsx                   # Main application
│   ├── components/
│   │   └── Terminal.tsx          # xterm.js terminal component
│   └── lib/
│       └── websocket.ts          # WebSocket connection manager
└── backend/                      # Backend source
    ├── .e2b/
    │   ├── Dockerfile            # E2B sandbox template (Ubuntu + s3fs)
    │   └── e2b.toml              # Template config (4 vCPU, 4GB RAM)
    └── src/
        ├── index.ts              # Server entry point
        ├── config/env.ts         # Environment configuration
        ├── sandbox/manager.ts    # E2B sandbox lifecycle + R2 mounting
        ├── storage/r2.ts         # R2 storage manager
        └── websocket/handler.ts  # WebSocket connection handler
```

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
- [E2B](https://e2b.dev) - Cloud sandboxed execution (4 vCPU, 4GB RAM)
- [Cloudflare R2](https://developers.cloudflare.com/r2/) - S3-compatible object storage (10GB free)
- s3fs - FUSE driver for S3-compatible storage

## Why Cloudflare R2?

- ✅ **10GB free storage** (forever)
- ✅ **No egress fees** (unlike AWS S3)
- ✅ **S3-compatible API** (works with s3fs)
- ✅ **Simple authentication** (access key + secret)
- ✅ **No tenant policy restrictions** (unlike Azure)

## Configuration

### Sandbox Reuse (Recommended)

To avoid E2B rate limits, reuse existing sandboxes:

```bash
# When backend creates a sandbox, it logs:
# [SandboxManager] To reuse this sandbox, set E2B_SANDBOX_ID=ixxx...

# Add to backend/.env:
E2B_SANDBOX_ID=your_sandbox_id
```

Next restart will connect to the existing sandbox instead of creating a new one.

### Template Resources

Configured in `backend/.e2b/e2b.toml`:
```toml
cpu_count = 4
memory_mb = 4096
```

Modify these values and rebuild the template to change sandbox resources.

## Troubleshooting

### "WebSocket connection failed"
- Verify backend is running on port 3000
- Check frontend CORS settings match
- Ensure no firewall blocking WebSocket connections

### "E2B sandbox creation failed"
- Check E2B_API_KEY is valid
- Verify E2B quota/credits
- Review E2B dashboard for errors

### "R2 mount failed"
- Verify R2 bucket exists (`cloud-dev-workspace`)
- Check R2 credentials are correct
- Ensure bucket permissions allow read/write

### "Files not persisting"
- Verify working directory is `/workspace/files`
- Check mount status: `df -h /workspace/files`
- Test R2 access: List files in Cloudflare R2 dashboard

### "Multiple sandboxes being created"
- Set `E2B_SANDBOX_ID` in backend/.env to reuse sandboxes
- This prevents creating new sandboxes on every connection

## Design Philosophy

Following ruthless simplicity and modular design principles:

1. **Minimal abstractions**: Direct implementations without unnecessary layers
2. **Clear module boundaries**: Self-contained components with explicit contracts
3. **Graceful degradation**: System handles failures at every level
4. **S3-compatible storage**: Use R2's simple auth instead of fighting Azure policies
5. **Sandbox reuse**: Avoid rate limits by connecting to existing sandboxes

## Implementation Status

All phases complete:
- ✅ **Phase 1**: Frontend with xterm.js terminal
- ✅ **Phase 2**: Backend with E2B sandbox integration
- ✅ **Phase 3**: R2 + s3fs storage mounting
- ✅ **Phase 4**: Sandbox reuse and performance optimization

**What works:**
- ✅ Browser-based terminal with full xterm.js features
- ✅ WebSocket connection with auto-reconnect
- ✅ E2B sandbox creation and reuse
- ✅ PTY-based interactive terminal (no timeouts)
- ✅ Cloudflare R2 storage mounting via s3fs
- ✅ File persistence across sandbox restarts
- ✅ Graceful cleanup on disconnect/timeout
- ✅ High-performance sandboxes (4 vCPU, 4GB RAM)

## Contributing

See [backend/IMPLEMENTATION.md](./backend/IMPLEMENTATION.md) for detailed implementation notes.

## License

MIT License

## Acknowledgments

Built with:
- [E2B](https://e2b.dev) - Sandboxed code execution platform
- [xterm.js](https://xtermjs.org) - Terminal emulator
- [Vite](https://vitejs.dev) - Build tool
- [React](https://react.dev) - UI framework
- [Cloudflare R2](https://developers.cloudflare.com/r2/) - S3-compatible object storage
- [s3fs](https://github.com/s3fs-fuse/s3fs-fuse) - FUSE driver for S3

---

**Ready to code in the cloud! ☁️**
