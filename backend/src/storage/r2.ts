import { config } from '../config/env.js';

export class R2StorageManager {
  private static readonly MOUNT_POINT = '/workspace/files';
  private static readonly CREDENTIALS_FILE = '/home/user/.passwd-s3fs';

  static getCredentialsContent(accessKeyId: string, secretAccessKey: string): string {
    return `${accessKeyId}:${secretAccessKey}`;
  }

  static getCredentialsFile(): string {
    return this.CREDENTIALS_FILE;
  }

  static getMountCommands(bucketName: string, endpoint: string): string[] {
    return [
      // Create mount point
      `mkdir -p ${this.MOUNT_POINT}`,
      // Set permissions on credentials file (after it's written)
      `chmod 600 ${this.CREDENTIALS_FILE}`,
      // Mount R2 bucket (use sudo for FUSE access)
      `sudo s3fs ${bucketName} ${this.MOUNT_POINT} -o passwd_file=${this.CREDENTIALS_FILE} -o url=${endpoint} -o use_path_request_style -o allow_other`
    ];
  }

  static getUnmountCommand(): string {
    return `fusermount -u ${this.MOUNT_POINT}`;
  }

  static getMountPoint(): string {
    return this.MOUNT_POINT;
  }
}
