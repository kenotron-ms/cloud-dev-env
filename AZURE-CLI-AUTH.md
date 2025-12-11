# Azure CLI Authentication Support

This document describes the Azure CLI authentication feature added to the cloud development environment.

## Overview

The system now supports two authentication modes for Azure Blob Storage:

1. **Azure CLI authentication (recommended)** - Uses `az login` credentials via Azure Active Directory
2. **Key-based authentication (fallback)** - Uses storage account keys (required for Azurite)

## Benefits of Azure CLI Authentication

✅ **No sensitive keys in environment variables** - More secure credential management
✅ **Uses Azure Active Directory** - Modern authentication with better security
✅ **Supports Managed Identity** - Seamlessly transitions to production deployments
✅ **Follows Azure security best practices** - Recommended by Microsoft
✅ **Automatic token refresh** - Azure CLI handles token lifecycle

## How It Works

### CLI Authentication Mode (`AZURE_AUTH_MODE=cli`)

1. User runs `az login` on their host machine
2. Azure CLI stores credentials in `~/.azure/` directory
3. Backend copies Azure CLI credentials to E2B sandbox at startup
4. blobfuse2 uses `mode: msi` which leverages Azure CLI credentials
5. In production, this seamlessly uses Managed Identity (no code changes needed)

### Key Authentication Mode (`AZURE_AUTH_MODE=key`)

1. User provides `AZURE_STORAGE_KEY` in environment variables
2. blobfuse2 uses `mode: key` with the provided account key
3. Required for Azurite (local development emulator)

## Configuration

### Environment Variables

**New variable:**
```bash
AZURE_AUTH_MODE=cli  # or "key"
```

**CLI mode (recommended for Azure Storage):**
```bash
AZURE_STORAGE_ENABLED=true
AZURE_AUTH_MODE=cli
AZURE_STORAGE_ACCOUNT=your_storage_account
# AZURE_STORAGE_KEY not needed
```

**Key mode (required for Azurite):**
```bash
AZURE_STORAGE_ENABLED=true
AZURE_AUTH_MODE=key
AZURE_STORAGE_ACCOUNT=devstorageaccount1
AZURE_STORAGE_KEY=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==
```

## Implementation Details

### Files Modified

1. **`backend/src/config/env.ts`**
   - Added `azureAuthMode` config property
   - Made `azureStorageKey` optional when using CLI mode
   - Validates key is only required when `AZURE_AUTH_MODE=key`

2. **`backend/src/storage/azure-blob.ts`**
   - Updated to generate different blobfuse2 configs based on auth mode
   - CLI mode: Uses `mode: msi` without account-key
   - Key mode: Uses `mode: key` with account-key

3. **`backend/src/sandbox/manager.ts`**
   - Added `copyAzureCliCredentials()` method to copy `~/.azure/` to sandbox
   - Added Azure CLI validation checks before mounting
   - Verifies `az` command exists and user is authenticated

4. **`backend/.e2b/Dockerfile`**
   - Added `azure-cli` package installation
   - Created `/root/.azure` directory with proper permissions
   - Added comments about credential copying at runtime

5. **`backend/.env.example`**
   - Updated with detailed comments for both auth modes
   - Clear guidance on when to use each mode

6. **Documentation**
   - Updated `README.md` with Azure CLI setup instructions
   - Updated `TESTING-GUIDE.md` with both authentication workflows
   - Added troubleshooting for CLI authentication issues

### Security Considerations

**What gets copied to sandbox:**
- `azureProfile.json` - Azure subscription information
- `accessTokens.json` - OAuth access tokens
- `msal_token_cache.json` - MSAL token cache

**Security measures:**
- Files copied only when `AZURE_AUTH_MODE=cli`
- Sandbox is isolated and destroyed after session
- Tokens have limited lifetime (refreshed by Azure CLI)
- No sensitive data stored in environment variables

## Usage Guide

### Development with Azure Storage (CLI Auth)

```bash
# 1. Install Azure CLI
brew install azure-cli  # macOS

# 2. Authenticate
az login

# 3. Verify authentication
az account show

# 4. Configure backend
cd backend
cat > .env << EOF
E2B_API_KEY=your_key
AZURE_STORAGE_ENABLED=true
AZURE_AUTH_MODE=cli
AZURE_STORAGE_ACCOUNT=your_storage_account
AZURE_STORAGE_CONTAINER=cloud-dev-workspace
EOF

# 5. Create container
az storage container create \
  --name cloud-dev-workspace \
  --account-name your_storage_account

# 6. Start backend
pnpm dev
```

### Development with Azurite (Key Auth)

```bash
# 1. Start Azurite
npm install -g azurite
azurite --silent --location /tmp/azurite

# 2. Configure backend
cd backend
cat > .env << EOF
E2B_API_KEY=your_key
AZURE_STORAGE_ENABLED=true
AZURE_AUTH_MODE=key
AZURE_STORAGE_ACCOUNT=devstorageaccount1
AZURE_STORAGE_KEY=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==
AZURE_STORAGE_CONTAINER=cloud-dev-workspace
EOF

# 3. Create container
az storage container create \
  --name cloud-dev-workspace \
  --connection-string "DefaultEndpointsProtocol=http;AccountName=devstorageaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstorageaccount1;"

# 4. Start backend
pnpm dev
```

## Troubleshooting

### "Azure CLI is not installed in the sandbox"

**Cause:** E2B Docker image needs to be rebuilt with Azure CLI

**Fix:**
```bash
cd backend
# Rebuild E2B sandbox template
e2b template build
```

### "Azure CLI authentication required"

**Cause:** Not logged in with Azure CLI

**Fix:**
```bash
# Login to Azure
az login

# Verify authentication
az account show

# Check credentials exist
ls -la ~/.azure/
```

### "Failed to copy Azure CLI credentials"

**Cause:** Azure CLI credentials not found on host

**Fix:**
```bash
# Ensure you're logged in
az login

# Check credentials directory exists
ls ~/.azure/

# Should see: azureProfile.json, accessTokens.json, msal_token_cache.json
```

### Azurite with CLI mode doesn't work

**Cause:** Azurite doesn't support Azure CLI/MSI authentication

**Fix:** Use key mode for Azurite:
```bash
AZURE_AUTH_MODE=key
AZURE_STORAGE_KEY=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==
```

## Production Deployment

When deploying to production, the same code automatically uses Managed Identity:

1. Deploy backend to Azure (App Service, Container Instances, etc.)
2. Enable Managed Identity on the Azure resource
3. Grant Managed Identity "Storage Blob Data Contributor" role on storage account
4. Use `AZURE_AUTH_MODE=cli` (blobfuse2's `msi` mode works with both Azure CLI and Managed Identity)
5. No code changes needed - authentication is automatic

## Testing

See `TESTING-GUIDE.md` for complete testing workflows for both authentication modes.

**Key test scenarios:**
1. CLI auth with real Azure Storage account
2. Key auth with Azurite (local development)
3. Key auth with real Azure Storage account (fallback)
4. Verify Azure CLI credentials are copied to sandbox
5. Verify authentication failures are handled gracefully

## Future Enhancements

Possible improvements:
- Support for Service Principal authentication
- Support for SAS token authentication
- Automatic fallback from CLI to key mode if CLI not available
- Integration with Azure Key Vault for key storage
- Support for multiple Azure subscriptions/tenants

## References

- [Azure CLI documentation](https://docs.microsoft.com/cli/azure/)
- [blobfuse2 authentication modes](https://github.com/Azure/azure-storage-fuse)
- [Azure Managed Identity](https://docs.microsoft.com/azure/active-directory/managed-identities-azure-resources/)
- [Azure Storage security best practices](https://docs.microsoft.com/azure/storage/common/storage-security-guide)
