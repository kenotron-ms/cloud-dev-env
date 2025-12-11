import dotenv from 'dotenv';

dotenv.config();

type AzureAuthMode = 'cli' | 'key' | 'sas';

interface Config {
  e2bApiKey: string;
  e2bSandboxId?: string;
  anthropicApiKey: string;
  port: number;
  frontendUrl: string;
  sandboxTimeout: number;
  cloudStorageEnabled: boolean;
  cloudStorageType: 'r2' | 'azure';
  r2AccessKeyId?: string;
  r2SecretAccessKey?: string;
  r2Endpoint?: string;
  r2Bucket?: string;
  azureStorageEnabled: boolean;
  azureAuthMode: AzureAuthMode;
  azureStorageAccount: string;
  azureStorageKey: string;
  azureStorageSas?: string;
  azureStorageContainer: string;
}

function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getOptionalEnv(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

function getConditionalEnv(key: string, condition: boolean): string {
  if (condition) {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Missing required environment variable: ${key} (required when Azure Storage is enabled)`);
    }
    return value;
  }
  return '';
}

const cloudStorageEnabled = getOptionalEnv('CLOUD_STORAGE_ENABLED', 'false').toLowerCase() === 'true';
const cloudStorageType = getOptionalEnv('CLOUD_STORAGE_TYPE', 'r2') as 'r2' | 'azure';

const azureStorageEnabled = getOptionalEnv('AZURE_STORAGE_ENABLED', 'false').toLowerCase() === 'true';
const azureAuthModeRaw = getOptionalEnv('AZURE_AUTH_MODE', 'cli').toLowerCase();
const azureAuthMode = (azureAuthModeRaw === 'key' ? 'key' : azureAuthModeRaw === 'sas' ? 'sas' : 'cli') as AzureAuthMode;

// When using CLI auth mode, storage key is optional
// When using key auth mode, storage key is required
const requiresStorageKey = azureStorageEnabled && azureAuthMode === 'key';

export const config: Config = {
  e2bApiKey: getRequiredEnv('E2B_API_KEY'),
  e2bSandboxId: process.env.E2B_SANDBOX_ID,
  anthropicApiKey: getRequiredEnv('ANTHROPIC_API_KEY'),
  port: parseInt(getOptionalEnv('PORT', '3000'), 10),
  frontendUrl: getOptionalEnv('FRONTEND_URL', 'http://localhost:5174'),
  sandboxTimeout: parseInt(getOptionalEnv('SANDBOX_TIMEOUT', '3600'), 10),
  cloudStorageEnabled,
  cloudStorageType,
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID,
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  r2Endpoint: process.env.R2_ENDPOINT,
  r2Bucket: process.env.R2_BUCKET,
  azureStorageEnabled,
  azureAuthMode,
  azureStorageAccount: getConditionalEnv('AZURE_STORAGE_ACCOUNT', azureStorageEnabled),
  azureStorageKey: getConditionalEnv('AZURE_STORAGE_KEY', requiresStorageKey),
  azureStorageSas: process.env.AZURE_STORAGE_SAS,
  azureStorageContainer: azureStorageEnabled ? getOptionalEnv('AZURE_STORAGE_CONTAINER', 'cloud-dev-workspace') : '',
};

console.log('Configuration loaded:', {
  port: config.port,
  frontendUrl: config.frontendUrl,
  sandboxTimeout: config.sandboxTimeout,
  e2bApiKey: config.e2bApiKey ? '***' : 'NOT SET',
  e2bSandboxId: config.e2bSandboxId || 'NOT SET (will create new)',
  anthropicApiKey: config.anthropicApiKey ? '***' : 'NOT SET',
  cloudStorageEnabled: config.cloudStorageEnabled,
  cloudStorageType: config.cloudStorageType,
  r2Configured: config.r2AccessKeyId && config.r2Bucket ? 'YES' : 'NO',
  azureStorageEnabled: config.azureStorageEnabled,
  azureAuthMode: config.azureAuthMode,
  azureStorageAccount: config.azureStorageAccount ? '***' : 'NOT SET',
  azureStorageContainer: config.azureStorageContainer || 'NOT SET',
});
