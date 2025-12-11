import { config } from '../config/env.js';

export interface BlobfuseConfig {
  logging: {
    level: string;
    file_path: string;
  };
  components: string[];
  libfuse: {
    attribute_expiration_sec: number;
    entry_expiration_sec: number;
    allow_other: boolean;
  };
  file_cache: {
    path: string;
    timeout_sec: number;
  };
  attr_cache: {
    timeout_sec: number;
  };
  azstorage: {
    type: string;
    account_name: string;
    account_key?: string;
    mode: string;
    container: string;
  };
}

export class AzureBlobConfigManager {
  private static readonly CONFIG_FILE_PATH = '/tmp/blobfuse2.yaml';
  private static readonly MOUNT_POINT = '/workspace/files';
  private static readonly CACHE_PATH = '/tmp/blobfuse2-cache';
  private static readonly LOG_PATH = '/tmp/blobfuse2.log';

  static generateConfig(): BlobfuseConfig {
    const azstorageConfig: BlobfuseConfig['azstorage'] = {
      type: 'block',
      account_name: config.azureStorageAccount,
      mode: config.azureAuthMode === 'cli' ? 'azcli' : 'key',
      container: config.azureStorageContainer,
    };

    // Only include account_key when using key mode
    if (config.azureAuthMode === 'key') {
      azstorageConfig.account_key = config.azureStorageKey;
    }

    // Add endpoint for Azurite (local development)
    if (process.env.AZURE_STORAGE_ENDPOINT) {
      (azstorageConfig as any).endpoint = process.env.AZURE_STORAGE_ENDPOINT;
    }

    return {
      logging: {
        level: 'log_warning',
        file_path: this.LOG_PATH,
      },
      components: [
        'libfuse',
        'file_cache',
        'attr_cache',
        'azstorage',
      ],
      libfuse: {
        attribute_expiration_sec: 240,
        entry_expiration_sec: 240,
        allow_other: true,
      },
      file_cache: {
        path: this.CACHE_PATH,
        timeout_sec: 120,
      },
      attr_cache: {
        timeout_sec: 240,
      },
      azstorage: azstorageConfig,
    };
  }

  static generateConfigYaml(): string {
    const cfg = this.generateConfig();

    // Build azstorage section based on auth mode
    let azstorageSection = `azstorage:
  type: ${cfg.azstorage.type}
  account-name: ${cfg.azstorage.account_name}
  mode: ${cfg.azstorage.mode}
  container: ${cfg.azstorage.container}`;

    // Only add account-key line when using key mode
    if (cfg.azstorage.account_key) {
      azstorageSection = `azstorage:
  type: ${cfg.azstorage.type}
  account-name: ${cfg.azstorage.account_name}
  account-key: ${cfg.azstorage.account_key}
  mode: ${cfg.azstorage.mode}
  container: ${cfg.azstorage.container}`;
    }

    // Add endpoint for Azurite if configured
    if ((cfg.azstorage as any).endpoint) {
      azstorageSection += `\n  endpoint: ${(cfg.azstorage as any).endpoint}`;
    }

    return `logging:
  level: ${cfg.logging.level}
  file-path: ${cfg.logging.file_path}

components:
${cfg.components.map(c => `  - ${c}`).join('\n')}

libfuse:
  attribute-expiration-sec: ${cfg.libfuse.attribute_expiration_sec}
  entry-expiration-sec: ${cfg.libfuse.entry_expiration_sec}
  allow-other: ${cfg.libfuse.allow_other}

file_cache:
  path: ${cfg.file_cache.path}
  timeout-sec: ${cfg.file_cache.timeout_sec}

attr_cache:
  timeout-sec: ${cfg.attr_cache.timeout_sec}

${azstorageSection}
`;
  }

  static getMountCommand(): string {
    return `blobfuse2 mount ${this.MOUNT_POINT} --config-file=${this.CONFIG_FILE_PATH} --log-level=LOG_WARNING`;
  }

  static getUnmountCommand(): string {
    return `fusermount3 -u ${this.MOUNT_POINT}`;
  }

  static getConfigFilePath(): string {
    return this.CONFIG_FILE_PATH;
  }

  static getMountPoint(): string {
    return this.MOUNT_POINT;
  }

  static getCachePath(): string {
    return this.CACHE_PATH;
  }

  static getLogPath(): string {
    return this.LOG_PATH;
  }
}
