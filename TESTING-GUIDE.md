# End-to-End Testing Guide

This guide walks through testing the complete cloud development environment from frontend to Azure Blob Storage.

## System Architecture

```
┌─────────────┐     WebSocket      ┌─────────────┐     PTY      ┌─────────────┐     FUSE      ┌─────────────┐
│   Browser   │ ←─────────────────→ │   Backend   │ ←───────────→ │ e2b Sandbox │ ←───────────→ │Azure Blob   │
│  (xterm.js) │   Terminal I/O      │  (Node.js)  │   Terminal    │ (PTY+bash)  │   File Ops    │Storage      │
└─────────────┘                     └─────────────┘               └─────────────┘               └─────────────┘
```

## Prerequisites

### 1. E2B API Key
```bash
# Get your API key from https://e2b.dev/dashboard
export E2B_API_KEY="your_e2b_api_key"
```

### 2. Azure Storage (Option A: Azure CLI Authentication - Recommended)
```bash
# Install Azure CLI (if not already installed)
# macOS: brew install azure-cli
# Windows: Download from https://aka.ms/installazurecliwindows
# Linux: See https://docs.microsoft.com/cli/azure/install-azure-cli-linux

# Login to Azure
az login

# Verify authentication
az account show

# Use these settings
export AZURE_AUTH_MODE="cli"
export AZURE_STORAGE_ACCOUNT="your_storage_account_name"
export AZURE_STORAGE_CONTAINER="cloud-dev-workspace"
# No AZURE_STORAGE_KEY needed with CLI auth
```

### 2. Azure Storage (Option B: Key-Based Authentication - Azurite/Fallback)
```bash
# Install Azurite (Azure Storage emulator)
npm install -g azurite

# Start Azurite
azurite --silent --location /tmp/azurite --debug /tmp/azurite-debug.log

# Use these credentials (Azurite defaults - requires key mode)
export AZURE_AUTH_MODE="key"
export AZURE_STORAGE_ACCOUNT="devstorageaccount1"
export AZURE_STORAGE_KEY="Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw=="
export AZURE_STORAGE_CONTAINER="cloud-dev-workspace"
```

### 2. Azure Storage (Option C: Production with Key)
```bash
# Create Azure Storage account via Azure Portal
# Get credentials from Azure Portal → Storage Account → Access Keys

export AZURE_AUTH_MODE="key"
export AZURE_STORAGE_ACCOUNT="your_storage_account_name"
export AZURE_STORAGE_KEY="your_access_key"
export AZURE_STORAGE_CONTAINER="cloud-dev-workspace"
```

### 3. Create Azure Blob Container
```bash
# For Azure with CLI auth (recommended)
az storage container create \
  --name cloud-dev-workspace \
  --account-name $AZURE_STORAGE_ACCOUNT

# For Azure with key auth
az storage container create \
  --name cloud-dev-workspace \
  --account-name $AZURE_STORAGE_ACCOUNT \
  --account-key $AZURE_STORAGE_KEY

# For Azurite (local with key auth)
az storage container create \
  --name cloud-dev-workspace \
  --connection-string "DefaultEndpointsProtocol=http;AccountName=devstorageaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstorageaccount1;"
```

## Setup Steps

### 1. Frontend Setup
```bash
cd cloud-dev-env
pnpm install
pnpm dev
# Frontend should be running on http://localhost:5174
```

### 2. Backend Setup
```bash
cd backend

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
# Required:
#   E2B_API_KEY=your_key
#   AZURE_STORAGE_ENABLED=true
#   AZURE_AUTH_MODE=cli (or key)
#   AZURE_STORAGE_ACCOUNT=your_account
#   AZURE_STORAGE_KEY=your_key (only if AZURE_AUTH_MODE=key)

# Install dependencies
pnpm install

# Start backend
pnpm dev
# Backend should be running on http://localhost:3000
```

## Testing Scenarios

### Test 1: Frontend Connection

**Goal**: Verify frontend can connect to backend

**Steps**:
1. Open browser to http://localhost:5174
2. Click "Start Session" button
3. Observe connection status

**Expected Results**:
- ✅ Connection status shows "Connecting..."
- ✅ Status changes to "Connected"
- ✅ Terminal appears with green text on dark background

**Debug**:
- Check browser console for WebSocket errors
- Check backend logs: `pnpm dev` output
- Verify backend is running on port 3000

---

### Test 2: E2B Sandbox Creation

**Goal**: Verify e2b sandbox is created and shell is working

**Steps**:
1. Wait for terminal to connect
2. Type: `echo "Hello from sandbox"`
3. Press Enter

**Expected Results**:
- ✅ Command executes in ~2-5 seconds
- ✅ Output: `Hello from sandbox`
- ✅ New prompt appears

**Debug**:
- Check backend logs for "Sandbox created"
- Check for E2B API errors
- Verify E2B_API_KEY is valid
- Check E2B dashboard for active sandboxes

---

### Test 3: Azure Blob Storage Mount

**Goal**: Verify FUSE mount to Azure Blob Storage is working

**Steps**:
1. In terminal, type: `df -h | grep /workspace/files`
2. Press Enter
3. Type: `mount | grep blobfuse2`
4. Press Enter

**Expected Results**:
- ✅ `/workspace/files` appears in filesystem list
- ✅ blobfuse2 mount is visible
- ✅ Mount shows available space

**Debug**:
- Check backend logs for "Azure Blob Storage mounted"
- Check for blobfuse2 errors in backend logs
- Verify Azure credentials in .env
- Check if container exists: `az storage container list`
- For Azurite: Verify Azurite is running (`ps aux | grep azurite`)

---

### Test 4: File Persistence

**Goal**: Verify files written in sandbox persist in Azure Blob Storage

**Steps**:
1. In terminal, type: `cd /workspace/files`
2. Type: `echo "Test content" > test.txt`
3. Type: `cat test.txt` (should show "Test content")
4. Verify file in Azure:

```bash
# In another terminal, check blob storage
# For CLI auth:
az storage blob list \
  --container-name cloud-dev-workspace \
  --account-name $AZURE_STORAGE_ACCOUNT \
  --output table

# For key auth:
az storage blob list \
  --container-name cloud-dev-workspace \
  --account-name $AZURE_STORAGE_ACCOUNT \
  --account-key $AZURE_STORAGE_KEY \
  --output table

# Should show test.txt blob
```

5. In browser terminal, type: `rm test.txt`
6. Verify file deleted from Azure (re-run list command)

**Expected Results**:
- ✅ File appears in blob storage after creation
- ✅ File content is correct
- ✅ File disappears from blob storage after deletion

**Debug**:
- Check working directory: `pwd` (should be /workspace/files)
- Check mount status: `df -h /workspace/files`
- Check blob container exists
- For Azurite: Check /tmp/azurite directory

---

### Test 5: Terminal Resize

**Goal**: Verify terminal resizes correctly

**Steps**:
1. Resize browser window
2. Observe terminal adjusts to fill space
3. Type a long command to verify line wrapping

**Expected Results**:
- ✅ Terminal fills available space
- ✅ Text wraps correctly at new width
- ✅ No visual glitches

**Debug**:
- Check browser console for resize events
- Check backend logs for "Terminal resized" messages

---

### Test 6: Disconnect/Reconnect

**Goal**: Verify graceful handling of disconnections

**Steps**:
1. While connected, stop backend: `Ctrl+C` in backend terminal
2. Observe frontend behavior
3. Restart backend: `pnpm dev`
4. Wait for auto-reconnect

**Expected Results**:
- ✅ Frontend shows "Disconnected" status
- ✅ Frontend shows "Connecting..." after 1 second
- ✅ Frontend reconnects when backend is back
- ✅ New sandbox is created (old one was cleaned up)

**Debug**:
- Check browser console for reconnection attempts
- Check backend logs for cleanup messages
- Verify exponential backoff (1s, 2s, 4s, 8s...)

---

### Test 7: Inactivity Timeout

**Goal**: Verify sandbox cleans up after inactivity

**Steps**:
1. Connect to terminal
2. Wait 60 minutes (or set `SANDBOX_TIMEOUT_SECONDS=60` in .env for faster testing)
3. Observe disconnection

**Expected Results**:
- ✅ Terminal disconnects after timeout period
- ✅ Frontend shows "Disconnected" status
- ✅ Backend logs show "Sandbox timeout, cleaning up"
- ✅ E2B sandbox is killed

**Debug**:
- Check backend logs for timeout messages
- Verify SANDBOX_TIMEOUT_SECONDS setting in .env
- Check E2B dashboard (sandbox should be gone)

---

## Performance Benchmarks

### Connection Time
- **Target**: < 5 seconds from "Start Session" to usable terminal
- **Measurement**: Time from WebSocket connect to first prompt

### Command Execution
- **Target**: < 500ms for simple commands (`echo`, `ls`)
- **Measurement**: Time from Enter press to output appears

### File Operations
- **Target**:
  - Small files (< 1KB): < 1 second
  - Medium files (1-10MB): < 5 seconds
  - Large files (> 10MB): Acceptable for cloud storage

### Reconnection Time
- **Target**: < 2 seconds to reconnect after disconnect
- **Measurement**: Time from backend restart to terminal ready

## Common Issues

### Issue: "WebSocket connection failed"
**Cause**: Backend not running or wrong URL
**Fix**:
- Check backend is on port 3000
- Verify VITE_API_URL in frontend .env

### Issue: "E2B sandbox creation failed"
**Cause**: Invalid API key or quota exceeded
**Fix**:
- Check E2B_API_KEY is correct
- Check E2B dashboard for quota/billing issues

### Issue: "Azure Blob mount failed"
**Cause**: Invalid credentials, not authenticated, or container doesn't exist
**Fix**:
- For CLI mode: Run `az login` and verify with `az account show`
- For key mode: Verify AZURE_STORAGE_ACCOUNT and AZURE_STORAGE_KEY
- Create container if missing
- For Azurite: Use key mode (CLI auth not supported by Azurite)
- Check backend logs for specific error messages

### Issue: "Azure CLI authentication required"
**Cause**: Using AZURE_AUTH_MODE=cli but not logged in
**Fix**:
- Run `az login` to authenticate
- Verify authentication: `az account show`
- Check Azure CLI credentials are copied to sandbox (backend logs)

### Issue: "Files not persisting"
**Cause**: Writing to wrong directory (not /workspace/files)
**Fix**:
- Use `cd /workspace/files` before creating files
- Check mount: `df -h /workspace/files`

### Issue: "Terminal not resizing"
**Cause**: xterm-addon-fit not working
**Fix**:
- Check browser console for errors
- Verify xterm-addon-fit is installed
- Check Terminal.tsx resize handler

## Success Criteria

All tests pass when:
- ✅ Frontend connects to backend
- ✅ Terminal is interactive and responsive
- ✅ E2B sandbox creates successfully
- ✅ Azure Blob Storage mounts correctly
- ✅ Files persist across sandbox restarts
- ✅ Disconnections are handled gracefully
- ✅ Performance meets targets

## Next Steps

After successful testing:

1. **Production Deployment**:
   - Switch from Azurite to real Azure Storage
   - Update environment variables
   - Deploy backend to cloud (AWS, Azure, GCP)
   - Deploy frontend to CDN (Vercel, Netlify, Cloudflare)

2. **Security Hardening**:
   - Add authentication (OAuth, JWT)
   - Rate limiting on WebSocket connections
   - Sandbox resource limits (CPU, memory)
   - Azure Storage SAS tokens (instead of account keys)

3. **Feature Enhancements**:
   - File browser UI
   - Multiple terminal tabs
   - Collaboration (multiple users in same sandbox)
   - Snapshot/restore sandbox state

4. **Monitoring**:
   - Connection success rate
   - Average sandbox creation time
   - File operation latency
   - Error rate tracking

---

**Happy Testing! 🚀**
