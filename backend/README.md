# Cloud Development Environment - Backend

Backend server for the cloud development environment, providing WebSocket-based terminal access to e2b sandboxes running Claude Code.

## Architecture

```
Frontend (xterm.js) → Backend (WebSocket + e2b SDK) → e2b Sandbox (Claude Code)
```

The backend:
- Accepts WebSocket connections from the frontend
- Creates e2b sandboxes with Claude Code pre-installed
- Streams terminal I/O bidirectionally between frontend and sandbox
- Manages sandbox lifecycle (creation, cleanup, timeout)

## Setup

### Prerequisites

- Node.js 20+
- pnpm (or npm/yarn)
- E2B API key (get from [e2b.dev](https://e2b.dev/docs))
- Anthropic API key (get from [console.anthropic.com](https://console.anthropic.com/))

### Installation

1. Install dependencies:
```bash
pnpm install
```

2. Configure environment:
```bash
cp .env.example .env
```

3. Edit `.env` and add your API keys:
```bash
E2B_API_KEY=your_e2b_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

### Development

Start the development server with auto-reload:
```bash
pnpm dev
```

The server will start on port 3000 (or the PORT specified in `.env`):
- Health check: `http://localhost:3000/health`
- WebSocket: `ws://localhost:3000/terminal`

### Production

Build and start the production server:
```bash
pnpm build
pnpm start
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `E2B_API_KEY` | Yes | - | E2B API key for sandbox creation |
| `ANTHROPIC_API_KEY` | Yes | - | Anthropic API key for Claude Code |
| `PORT` | No | 3000 | Server port |
| `FRONTEND_URL` | No | http://localhost:5174 | Frontend URL for CORS |
| `SANDBOX_TIMEOUT` | No | 3600 | Sandbox timeout in seconds (1 hour) |
| `AZURE_STORAGE_ENABLED` | No | false | Enable Azure Blob Storage integration |
| `AZURE_STORAGE_ACCOUNT` | Conditional | - | Azure Storage account name (required if enabled) |
| `AZURE_STORAGE_KEY` | Conditional | - | Azure Storage account key (required if enabled) |
| `AZURE_STORAGE_CONTAINER` | No | cloud-dev-workspace | Azure Blob container name |

## Project Structure

```
backend/
├── src/
│   ├── config/
│   │   └── env.ts              # Environment configuration
│   ├── sandbox/
│   │   └── manager.ts          # E2B sandbox management
│   ├── websocket/
│   │   └── handler.ts          # WebSocket connection handling
│   └── index.ts                # Server entry point
├── .e2b/
│   └── Dockerfile              # E2B sandbox template
├── package.json
├── tsconfig.json
└── .env.example
```

## API

### Health Check

**GET** `/health`

Returns server health status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.45
}
```

### WebSocket Terminal

**WebSocket** `/terminal`

Establishes a WebSocket connection for terminal I/O with an e2b sandbox.

**Client → Server Messages:**

Input:
```json
{
  "type": "input",
  "data": "ls -la\n"
}
```

Resize:
```json
{
  "type": "resize",
  "cols": 80,
  "rows": 24
}
```

**Server → Client Messages:**

Status:
```json
{
  "type": "status",
  "message": "Initializing sandbox..."
}
```

Ready:
```json
{
  "type": "ready"
}
```

Output:
```json
{
  "type": "output",
  "data": "total 8\ndrwxr-xr-x 2 user user 4096 Jan 1 00:00 .\n..."
}
```

Error:
```json
{
  "type": "error",
  "message": "Failed to create sandbox: ..."
}
```

## E2B Sandbox

The backend creates e2b sandboxes using a custom Dockerfile that includes:
- Ubuntu 22.04 base image
- Node.js 20
- Claude Code CLI
- Git and build tools
- blobfuse2 (Microsoft's FUSE driver for Azure Blob Storage)
- FUSE3 libraries

Each sandbox:
- Runs in isolation
- Has Claude Code pre-installed with ANTHROPIC_API_KEY configured
- Starts in `/workspace` directory (or `/workspace/files` if Azure Storage enabled)
- Times out after 1 hour of inactivity (configurable)
- Cleans up automatically on disconnect
- Optionally mounts Azure Blob Storage via FUSE

## Error Handling

The backend handles:
- Sandbox creation failures (network, quota limits)
- WebSocket disconnections (graceful cleanup)
- Process crashes (automatic sandbox termination)
- Timeout (inactivity-based cleanup)
- Shutdown signals (SIGTERM, SIGINT)

All errors are logged to console with appropriate context.

## Logging

The backend logs:
- Configuration on startup
- WebSocket connection events
- Sandbox lifecycle events (create, ready, exit, cleanup)
- Terminal resize events
- Errors with full context

Example log output:
```
Configuration loaded: { port: 3000, frontendUrl: 'http://localhost:5174', ... }
[Server] Backend server running on port 3000
[WebSocket] New connection established
[SandboxManager] Creating e2b sandbox...
[SandboxManager] Sandbox created: sbx_abc123
[SandboxManager] Shell process started
[WebSocket] Sandbox ready for input
[WebSocket] Connection closed
[SandboxManager] Killing sandbox: sbx_abc123
```

## Design Philosophy

This backend follows the implementation philosophy:

- **Ruthless simplicity**: Direct integration with e2b SDK, minimal abstractions
- **Clear module boundaries**: Config, sandbox, websocket are separate concerns
- **Graceful error handling**: Failures are logged and don't crash the server
- **Defensive cleanup**: Sandboxes always cleaned up, even on errors

## Troubleshooting

### "Missing required environment variable: E2B_API_KEY"

Ensure `.env` file exists with valid `E2B_API_KEY`. Get a key from [e2b.dev/docs](https://e2b.dev/docs).

### "Failed to create sandbox"

Check:
- E2B API key is valid
- Account has available quota
- Network connection is stable

### WebSocket connection fails

Verify:
- Backend is running (`pnpm dev`)
- Port 3000 is not in use
- CORS is configured correctly for your frontend URL

### Sandbox times out too quickly

Increase `SANDBOX_TIMEOUT` in `.env` (value in seconds).

## Azure Blob Storage Integration (Phase 3)

The backend supports persistent file storage via Azure Blob Storage mounted through FUSE.

### Setup Azure Storage

#### Option 1: Production (Azure Storage Account)

1. Create an Azure Storage account:
   - Go to [Azure Portal](https://portal.azure.com)
   - Create a new Storage Account
   - Choose "Standard" performance tier
   - Select your preferred region

2. Get your credentials:
   - Navigate to Storage Account → Access Keys
   - Copy the storage account name
   - Copy one of the access keys

3. Create a container:
   - Navigate to Storage Account → Containers
   - Create a new container named `cloud-dev-workspace` (or your custom name)
   - Set access level to "Private"

4. Configure backend:
```bash
AZURE_STORAGE_ENABLED=true
AZURE_STORAGE_ACCOUNT=your_account_name
AZURE_STORAGE_KEY=your_access_key
AZURE_STORAGE_CONTAINER=cloud-dev-workspace
```

#### Option 2: Development (Azurite Local Emulator)

1. Install Azurite:
```bash
npm install -g azurite
```

2. Start Azurite:
```bash
azurite --silent --location /tmp/azurite --debug /tmp/azurite-debug.log
```

3. Create container (using Azure Storage Explorer or az cli):
```bash
az storage container create --name cloud-dev-workspace \
  --connection-string "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;"
```

4. Configure backend:
```bash
AZURE_STORAGE_ENABLED=true
AZURE_STORAGE_ACCOUNT=devstoreaccount1
AZURE_STORAGE_KEY=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==
AZURE_STORAGE_CONTAINER=cloud-dev-workspace
```

### How It Works

When Azure Storage is enabled:

1. **Sandbox startup**:
   - Generates blobfuse2 configuration file
   - Mounts Azure Blob container at `/workspace/files`
   - Sets working directory to mounted location
   - All files created in sandbox persist to Azure Blob Storage

2. **File operations**:
   - Files written to `/workspace/files` → Stored in Azure Blob
   - Files read from `/workspace/files` → Retrieved from Azure Blob
   - Local caching improves performance

3. **Sandbox cleanup**:
   - Unmounts Azure Blob Storage gracefully
   - Cache is cleaned up
   - Files remain in Azure Blob Storage

### Benefits

- **Persistence**: Files survive sandbox restarts
- **Sharing**: Multiple sandboxes can access the same container
- **Backup**: Azure Storage provides redundancy
- **Scale**: Unlimited storage capacity
- **POSIX**: Standard file operations work transparently

### Architecture

```
Frontend → Backend → e2b Sandbox → blobfuse2 → Azure Blob Storage
                                      ↓
                                 Local Cache
                              (/tmp/blobfuse2-cache)
```

### Troubleshooting

#### "Failed to mount Azure Blob Storage"

Check:
- Storage account name and key are correct
- Container exists
- Network connectivity to Azure (or Azurite for local dev)
- FUSE is properly installed in sandbox (should be automatic)

#### Files not persisting

Verify:
- `AZURE_STORAGE_ENABLED=true` in `.env`
- Sandbox shows "Azure Blob Storage mounted at /workspace/files"
- Files are created in `/workspace/files` (not `/workspace`)

#### Slow file operations

Consider:
- Increase cache timeout in `azure-blob.ts`
- Use faster storage tier (Premium SSD)
- Check network latency to Azure region

## Next Steps

This is Phase 3 of the cloud development environment. Next phases:

- **Phase 4**: Enhanced frontend with file browser showing Azure Blob contents
- **Phase 5**: Multi-session support with shared workspaces
- **Phase 6**: Collaboration features (shared sessions, live editing)

## License

MIT
