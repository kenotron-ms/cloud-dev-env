import { Sandbox, CommandHandle } from 'e2b';
import { config } from '../config/env.js';
import { AzureBlobConfigManager } from '../storage/azure-blob.js';
import { R2StorageManager } from '../storage/r2.js';
import { readFile } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';

export interface SandboxProcess {
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => Promise<void>;
}

export class SandboxManager {
  private sandbox: Sandbox | null = null;
  private ptyHandle: CommandHandle | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private isMounted: boolean = false;

  async create(
    onOutput: (data: string) => void,
    onExit: (code: number) => void
  ): Promise<SandboxProcess> {
    try {
      if (config.e2bSandboxId) {
        console.log(`[SandboxManager] Connecting to existing sandbox: ${config.e2bSandboxId}`);
        this.sandbox = await Sandbox.connect(config.e2bSandboxId, {
          apiKey: config.e2bApiKey,
          timeoutMs: config.sandboxTimeout * 1000,
        });
        console.log(`[SandboxManager] Connected to sandbox: ${this.sandbox.sandboxId}`);
      } else {
        console.log('[SandboxManager] Creating new e2b sandbox...');
        // Use custom template with s3fs when cloud storage is enabled
        const templateId = config.cloudStorageEnabled ? 'hgmbd8en87y8om2hshd2' : 'base';
        this.sandbox = await Sandbox.create(templateId, {
          apiKey: config.e2bApiKey,
          timeoutMs: config.sandboxTimeout * 1000,
        });
        console.log(`[SandboxManager] Sandbox created: ${this.sandbox.sandboxId} (template: ${templateId}, 4 vCPU, 4GB RAM)`);
        console.log(`[SandboxManager] To reuse this sandbox, set E2B_SANDBOX_ID=${this.sandbox.sandboxId}`);
      }

      if (config.cloudStorageEnabled) {
        if (config.cloudStorageType === 'r2') {
          await this.mountR2();
        } else if (config.azureStorageEnabled) {
          // Copy Azure CLI credentials if using CLI auth mode
          if (config.azureAuthMode === 'cli') {
            await this.copyAzureCliCredentials();
          }
          await this.mountAzureBlob();
        }
      }

      const mountPoint = config.cloudStorageEnabled && config.cloudStorageType === 'r2'
        ? R2StorageManager.getMountPoint()
        : config.azureStorageEnabled
        ? AzureBlobConfigManager.getMountPoint()
        : '/home/user';

      const storageMessage = config.cloudStorageEnabled && config.cloudStorageType === 'r2'
        ? `echo "Cloudflare R2 storage mounted at ${R2StorageManager.getMountPoint()}"\n`
        : config.azureStorageEnabled
        ? `echo "Azure Blob Storage mounted at ${AzureBlobConfigManager.getMountPoint()}"\n`
        : 'echo "Note: Cloud storage disabled - files will not persist"\n';

      await this.sandbox.files.write(
        '/home/user/.bashrc',
        'export ANTHROPIC_API_KEY=' + config.anthropicApiKey + '\n' +
        'export PS1="\\[\\033[01;32m\\]\\u@sandbox\\[\\033[00m\\]:\\[\\033[01;34m\\]\\w\\[\\033[00m\\]\\$ "\n' +
        'cd ' + mountPoint + '\n' +
        'clear\n' +
        'echo "Welcome to Cloud Dev Environment powered by e2b"\n' +
        'echo "Claude Code is available - try: claude --help"\n' +
        storageMessage +
        'echo ""\n'
      );

      this.ptyHandle = await this.sandbox.pty.create({
        cols: 80,
        rows: 24,
        timeoutMs: 0, // Disable timeout for long-running shell sessions
        onData: (data: Uint8Array) => {
          const text = new TextDecoder().decode(data);
          onOutput(text);
        },
        envs: {
          TERM: 'xterm-256color',
          ANTHROPIC_API_KEY: config.anthropicApiKey,
        },
        cwd: config.azureStorageEnabled ? AzureBlobConfigManager.getMountPoint() : '/home/user',
      });

      console.log('[SandboxManager] PTY started');

      this.startCleanupTimer();

      this.ptyHandle.wait().then(() => {
        console.log('[SandboxManager] PTY exited');
        onExit(this.ptyHandle?.exitCode ?? 0);
        this.cleanup();
      }).catch((error) => {
        console.error('[SandboxManager] PTY error:', error);
        onExit(1);
        this.cleanup();
      });

      const ptyPid = this.ptyHandle.pid;
      const sandboxRef = this.sandbox;

      return {
        write: (data: string) => {
          if (sandboxRef && ptyPid) {
            const encoder = new TextEncoder();
            sandboxRef.pty.sendInput(ptyPid, encoder.encode(data));
            this.resetCleanupTimer();
          }
        },
        resize: (cols: number, rows: number) => {
          if (sandboxRef && ptyPid) {
            console.log(`[SandboxManager] Terminal resize: ${cols}x${rows}`);
            sandboxRef.pty.resize(ptyPid, { cols, rows });
          }
        },
        kill: async () => {
          await this.cleanup();
        },
      };
    } catch (error) {
      console.error('[SandboxManager] Error creating sandbox:', error);
      await this.cleanup();
      throw error;
    }
  }

  private async copyAzureCliCredentials(): Promise<void> {
    if (!this.sandbox) {
      throw new Error('Sandbox not initialized');
    }

    try {
      console.log('[SandboxManager] Copying Azure CLI credentials to sandbox...');

      const azureConfigDir = join(homedir(), '.azure');

      // Copy key Azure CLI files
      const filesToCopy = [
        'azureProfile.json',
        'accessTokens.json',
        'msal_token_cache.json',
        'msal_http_cache.bin',
        'clouds.config',
        'config'
      ];

      for (const filename of filesToCopy) {
        try {
          const filepath = join(azureConfigDir, filename);
          const content = await readFile(filepath, 'utf-8');
          await this.sandbox.files.write(`/root/.azure/${filename}`, content);
          console.log(`[SandboxManager] Copied ${filename} to sandbox`);
        } catch (error) {
          // Some files might not exist, that's okay
          console.log(`[SandboxManager] Skipping ${filename} (not found or inaccessible)`);
        }
      }

      console.log('[SandboxManager] Azure CLI credentials copied successfully');
    } catch (error) {
      console.error('[SandboxManager] Error copying Azure CLI credentials:', error);
      throw new Error(
        'Failed to copy Azure CLI credentials. Please ensure you have run "az login" on your host machine.\n' +
        `Error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async mountR2(): Promise<void> {
    if (!this.sandbox) {
      throw new Error('Sandbox not initialized');
    }

    if (!config.r2AccessKeyId || !config.r2SecretAccessKey || !config.r2Endpoint || !config.r2Bucket) {
      throw new Error('R2 configuration incomplete. Need: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET');
    }

    try {
      console.log('[SandboxManager] Mounting Cloudflare R2 storage...');

      // Write credentials using E2B file API
      const credentialsContent = R2StorageManager.getCredentialsContent(
        config.r2AccessKeyId,
        config.r2SecretAccessKey
      );
      await this.sandbox.files.write(R2StorageManager.getCredentialsFile(), credentialsContent);

      // Run mount commands
      const commands = R2StorageManager.getMountCommands(config.r2Bucket, config.r2Endpoint);

      for (const cmd of commands) {
        const result = await this.sandbox.commands.run(cmd);
        if (result.exitCode !== 0) {
          throw new Error(`Command failed: ${cmd}\nstderr: ${result.stderr}`);
        }
      }

      console.log('[SandboxManager] R2 storage mounted successfully at:', R2StorageManager.getMountPoint());
      this.isMounted = true;
    } catch (error) {
      console.error('[SandboxManager] Error mounting R2 storage:', error);
      throw new Error(`R2 storage mount failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setTimeout(() => {
      console.log('[SandboxManager] Sandbox timeout - cleaning up');
      this.cleanup();
    }, config.sandboxTimeout * 1000);
  }

  private resetCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.startCleanupTimer();
    }
  }

  private async mountAzureBlob(): Promise<void> {
    if (!this.sandbox) {
      throw new Error('Sandbox not initialized');
    }

    try {
      console.log('[SandboxManager] Mounting Azure Blob Storage...');

      // Validate Azure CLI authentication if using CLI mode
      if (config.azureAuthMode === 'cli') {
        console.log('[SandboxManager] Validating Azure CLI authentication...');

        // Check if az command is available
        const azCheckResult = await this.sandbox.commands.run('which az');
        if (azCheckResult.exitCode !== 0) {
          throw new Error('Azure CLI is not installed in the sandbox. Please update the E2B Dockerfile to install Azure CLI.');
        }

        // Verify user is logged in
        const azLoginCheck = await this.sandbox.commands.run('az account show');
        if (azLoginCheck.exitCode !== 0) {
          throw new Error(
            'Azure CLI authentication required. Please run "az login" on your host machine before starting the sandbox.\n' +
            'Error: ' + azLoginCheck.stderr
          );
        }

        console.log('[SandboxManager] Azure CLI authentication validated successfully');
      }

      const configYaml = AzureBlobConfigManager.generateConfigYaml();
      await this.sandbox.files.write(
        AzureBlobConfigManager.getConfigFilePath(),
        configYaml
      );

      console.log('[SandboxManager] Blobfuse2 config written to:', AzureBlobConfigManager.getConfigFilePath());

      const mountCommand = AzureBlobConfigManager.getMountCommand();
      console.log('[SandboxManager] Executing mount command:', mountCommand);

      const result = await this.sandbox.commands.run(mountCommand);

      if (result.exitCode !== 0) {
        const logs = await this.sandbox.files.read(AzureBlobConfigManager.getLogPath()).catch(() => 'No logs available');
        throw new Error(`Failed to mount Azure Blob Storage. Exit code: ${result.exitCode}. Logs: ${logs}`);
      }

      console.log('[SandboxManager] Verifying mount...');
      const verifyResult = await this.sandbox.commands.run(
        `mountpoint -q ${AzureBlobConfigManager.getMountPoint()} && echo "MOUNTED" || echo "NOT_MOUNTED"`
      );

      if (verifyResult.exitCode !== 0 || !verifyResult.stdout.includes('MOUNTED')) {
        throw new Error('Mount verification failed');
      }

      this.isMounted = true;
      console.log('[SandboxManager] Azure Blob Storage mounted successfully at:', AzureBlobConfigManager.getMountPoint());
    } catch (error) {
      console.error('[SandboxManager] Error mounting Azure Blob Storage:', error);
      throw new Error(`Azure Blob Storage mount failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async unmountAzureBlob(): Promise<void> {
    if (!this.sandbox || !this.isMounted) {
      return;
    }

    try {
      console.log('[SandboxManager] Unmounting Azure Blob Storage...');

      const unmountCommand = AzureBlobConfigManager.getUnmountCommand();
      await this.sandbox.commands.run(unmountCommand);

      this.isMounted = false;
      console.log('[SandboxManager] Azure Blob Storage unmounted successfully');
    } catch (error) {
      console.error('[SandboxManager] Error unmounting Azure Blob Storage:', error);
    }
  }

  private async cleanup(): Promise<void> {
    if (this.cleanupTimer) {
      clearTimeout(this.cleanupTimer);
      this.cleanupTimer = null;
    }

    if (this.ptyHandle && this.sandbox) {
      try {
        await this.sandbox.pty.kill(this.ptyHandle.pid);
      } catch (error) {
        console.error('[SandboxManager] Error killing PTY:', error);
      }
      this.ptyHandle = null;
    }

    if (config.azureStorageEnabled) {
      await this.unmountAzureBlob();
    }

    if (this.sandbox) {
      try {
        console.log(`[SandboxManager] Killing sandbox: ${this.sandbox.sandboxId}`);
        await this.sandbox.kill();
      } catch (error) {
        console.error('[SandboxManager] Error killing sandbox:', error);
      }
      this.sandbox = null;
    }
  }
}
