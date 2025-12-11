# Phase 3 Implementation: FUSE + Azure Blob Storage Integration

## Overview

Phase 3 adds persistent file storage to the cloud development environment by integrating Azure Blob Storage via FUSE (blobfuse2). Files created in the sandbox are now automatically stored in Azure Blob Storage, providing persistence across sandbox restarts.

## Architecture

```
Frontend (xterm.js)
    ↓
Backend (WebSocket + e2b SDK)
    ↓
e2b Sandbox (Claude Code)
    ↓
blobfuse2 (FUSE driver)
    ↓
Azure Blob Storage
```

## Changes Made

### 1. E2B Dockerfile Enhancement

**File**: `.e2b/Dockerfile`

Added:
- Microsoft package repository
- blobfuse2 package installation
- FUSE3 libraries (fuse3, libfuse3-dev)
- Mount point directory: `/workspace/files`
- Cache directory: `/tmp/blobfuse2-cache`

### 2. Azure Blob Storage Configuration Manager

**File**: `src/storage/azure-blob.ts`

New module providing:
- Blobfuse2 configuration generation
- YAML config file creation
- Mount/unmount command generation
- Path constants for mount point, cache, logs

Key configuration:
```yaml
mount_point: /workspace/files
cache_path: /tmp/blobfuse2-cache
log_path: /tmp/blobfuse2.log
attribute_expiration: 240s
entry_expiration: 240s
file_cache_timeout: 120s
```

### 3. Enhanced Sandbox Manager

**File**: `src/sandbox/manager.ts`

Added functionality:
- `mountAzureBlob()`: Mounts Azure Blob Storage on sandbox startup
  - Writes blobfuse2 config file
  - Executes mount command
  - Verifies mount succeeded
- `unmountAzureBlob()`: Unmounts storage on sandbox cleanup
- Working directory changes to `/workspace/files` when enabled
- Mount status tracking (`isMounted` flag)

### 4. Environment Configuration

**File**: `src/config/env.ts`

New environment variables:
- `AZURE_STORAGE_ENABLED` (boolean): Enable/disable Azure Storage
- `AZURE_STORAGE_ACCOUNT` (required if enabled): Storage account name
- `AZURE_STORAGE_KEY` (required if enabled): Storage account key
- `AZURE_STORAGE_CONTAINER` (optional): Container name (default: "cloud-dev-workspace")

Validation:
- Conditional validation for Azure credentials (only required when enabled)
- Masked credentials in logs
- Default container name fallback

### 5. Documentation Updates

**Files**: `README.md`, `.env.example`

Added comprehensive documentation:
- Azure Storage setup instructions (production + development)
- Azurite local emulator setup
- Environment variable configuration
- Troubleshooting guide
- Architecture diagrams
- Benefits and use cases

## Usage

### Production Setup

1. Create Azure Storage Account:
   - Go to Azure Portal
   - Create Storage Account (Standard tier)
   - Create container: "cloud-dev-workspace"

2. Configure environment:
```bash
AZURE_STORAGE_ENABLED=true
AZURE_STORAGE_ACCOUNT=your_account_name
AZURE_STORAGE_KEY=your_access_key
AZURE_STORAGE_CONTAINER=cloud-dev-workspace
```

3. Start backend:
```bash
pnpm dev
```

### Development Setup (Azurite)

1. Install and start Azurite:
```bash
npm install -g azurite
azurite --silent --location /tmp/azurite
```

2. Create container:
```bash
az storage container create --name cloud-dev-workspace \
  --connection-string "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;"
```

3. Configure environment:
```bash
AZURE_STORAGE_ENABLED=true
AZURE_STORAGE_ACCOUNT=devstoreaccount1
AZURE_STORAGE_KEY=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==
AZURE_STORAGE_CONTAINER=cloud-dev-workspace
```

### Disabled Mode

To run without Azure Storage (local sandbox only):
```bash
AZURE_STORAGE_ENABLED=false
```

Sandbox will start in `/workspace` directory without persistent storage.

## Benefits

1. **Persistence**: Files survive sandbox restarts
2. **Sharing**: Multiple sandboxes can access the same container
3. **Backup**: Azure Storage provides built-in redundancy
4. **Scale**: Unlimited storage capacity
5. **Transparency**: Standard POSIX file operations work without changes

## Technical Details

### Mount Process

1. Sandbox creates and writes blobfuse2 config to `/tmp/blobfuse2.yaml`
2. Executes: `blobfuse2 mount /workspace/files --config-file=/tmp/blobfuse2.yaml`
3. Verifies mount with: `mountpoint -q /workspace/files`
4. Sets working directory to `/workspace/files`
5. User can use standard file operations (read, write, mkdir, etc.)

### Caching Strategy

- Local cache: `/tmp/blobfuse2-cache`
- File cache timeout: 120 seconds
- Attribute cache timeout: 240 seconds
- Entry cache timeout: 240 seconds

Caching improves performance for repeated file operations while ensuring consistency.

### Error Handling

- Mount failures throw detailed errors with logs
- Verification ensures mount succeeded before proceeding
- Unmount errors logged but don't block cleanup
- Graceful degradation if Azure Storage disabled

## Testing

### Manual Testing Steps

1. Start sandbox with Azure Storage enabled
2. Create file: `echo "test" > /workspace/files/test.txt`
3. Read file: `cat /workspace/files/test.txt`
4. Kill sandbox
5. Start new sandbox
6. Verify file persists: `cat /workspace/files/test.txt`

### Expected Logs

```
[SandboxManager] Creating e2b sandbox...
[SandboxManager] Sandbox created: sbx_abc123
[SandboxManager] Mounting Azure Blob Storage...
[SandboxManager] Blobfuse2 config written to: /tmp/blobfuse2.yaml
[SandboxManager] Executing mount command: blobfuse2 mount /workspace/files...
[SandboxManager] Verifying mount...
[SandboxManager] Azure Blob Storage mounted successfully at: /workspace/files
[SandboxManager] PTY started
```

## Troubleshooting

### Mount Failures

Check:
- Storage account credentials are correct
- Container exists in Azure Storage
- Network connectivity to Azure (or Azurite)
- FUSE is installed in sandbox (automatic from Dockerfile)

View logs:
```bash
# In sandbox
cat /tmp/blobfuse2.log
```

### Files Not Persisting

Verify:
- `AZURE_STORAGE_ENABLED=true` in environment
- Files created in `/workspace/files` (not `/workspace`)
- Mount message appears in logs
- No mount errors in blobfuse2.log

### Performance Issues

Consider:
- Increase cache timeouts in `azure-blob.ts`
- Use Premium SSD storage tier
- Check network latency to Azure region
- Monitor cache hit rates

## Next Steps

Phase 4 (future):
- Enhanced frontend with file browser showing Azure Blob contents
- Visual file management (upload, download, delete)
- Multi-session support with shared workspaces
- Real-time file synchronization across sessions

## Implementation Philosophy

This implementation follows the ruthless simplicity principle:

- **Direct integration**: Minimal abstractions over blobfuse2
- **Clear error handling**: Descriptive messages with context
- **Graceful degradation**: Works without Azure Storage
- **Simple configuration**: Boolean flag enables/disables feature
- **Defensive cleanup**: Always unmounts on sandbox termination

No unnecessary complexity, just what's needed for persistent file storage.

## Files Modified

- `.e2b/Dockerfile` - Added blobfuse2 and FUSE3
- `src/storage/azure-blob.ts` - New configuration manager
- `src/sandbox/manager.ts` - Added mount/unmount logic
- `src/config/env.ts` - Added Azure Storage configuration
- `README.md` - Added Azure Storage documentation
- `.env.example` - Added Azure Storage variables

## Build Verification

Build successful with TypeScript compilation:
```bash
$ pnpm build
> tsc
# No errors
```

All type checks pass. Ready for testing and deployment.
