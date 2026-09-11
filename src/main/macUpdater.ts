import { app, net } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { execFile, spawn } from 'child_process';

export interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

class MacUpdater {
  private stagedAppPath: string | null = null;
  private stagedVersion: string | null = null;

  public isUpdateReady(): boolean {
    return !!this.stagedAppPath && fs.existsSync(this.stagedAppPath);
  }

  public getStagedVersion(): string | null {
    return this.stagedVersion;
  }

  /**
   * Downloads the appropriate .zip release asset from GitHub,
   * reports progress via onProgress, extracts the .app bundle with ditto,
   * and stages it for installation.
   */
  public async downloadAndExtract(
    info: any,
    onProgress: (progress: UpdateProgress) => void
  ): Promise<{ appPath: string; version: string }> {
    if (!info || !info.version) {
      throw new Error('Invalid update information provided');
    }

    const version: string = info.version;
    const isArm64 = process.arch === 'arm64';
    const repo = 'valteryde/regne';

    // 1. Identify target zip asset name
    let targetFileName = '';
    let targetFileUrl = '';

    if (Array.isArray(info.files) && info.files.length > 0) {
      // Prioritize matching CPU architecture (.zip)
      const matchedZip =
        info.files.find((f: any) => {
          const u = (f.url || '').toLowerCase();
          if (!u.endsWith('.zip')) return false;
          return isArm64
            ? u.includes('arm64') || u.includes('aarch64')
            : !u.includes('arm64') && !u.includes('aarch64');
        }) || info.files.find((f: any) => (f.url || '').toLowerCase().endsWith('.zip'));

      if (matchedZip) {
        targetFileName = matchedZip.url;
        targetFileUrl = matchedZip.url;
      }
    }

    if (!targetFileName && typeof info.path === 'string' && info.path.toLowerCase().endsWith('.zip')) {
      targetFileName = info.path;
      targetFileUrl = info.path;
    }

    if (!targetFileName) {
      targetFileName = isArm64 ? `Regne-${version}-arm64.zip` : `Regne-${version}-x64.zip`;
      targetFileUrl = targetFileName;
    }

    // Resolve absolute download URL
    let downloadUrl = targetFileUrl;
    if (!downloadUrl.startsWith('http://') && !downloadUrl.startsWith('https://')) {
      downloadUrl = `https://github.com/${repo}/releases/download/v${version}/${path.basename(targetFileName)}`;
    }

    console.log('[MacUpdater] Downloading update from:', downloadUrl);

    // Prepare staging directories
    const stagingDir = path.join(app.getPath('userData'), 'pending-update');
    await fs.promises.mkdir(stagingDir, { recursive: true });

    const zipPath = path.join(stagingDir, 'update.zip');
    // Remove any leftover old zip
    await fs.promises.unlink(zipPath).catch(() => {});

    // 2. Fetch update zip with fallback for release tag format
    let response = await net.fetch(downloadUrl);
    if (response.status === 404 && downloadUrl.includes(`/download/v${version}/`)) {
      const fallbackUrl = downloadUrl.replace(`/download/v${version}/`, `/download/${version}/`);
      console.log('[MacUpdater] 404 on v-tag, trying fallback URL:', fallbackUrl);
      const fallbackRes = await net.fetch(fallbackUrl);
      if (fallbackRes.ok) {
        response = fallbackRes;
        downloadUrl = fallbackUrl;
      }
    }

    if (!response.ok) {
      throw new Error(`Failed to download update: HTTP ${response.status} ${response.statusText}`);
    }

    const totalBytes = Number(response.headers.get('content-length') || 0);
    const fileStream = fs.createWriteStream(zipPath);

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Could not read response stream from update server');
    }

    let transferred = 0;
    let lastTime = Date.now();
    let lastTransferred = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        const canContinue = fileStream.write(Buffer.from(value));
        transferred += value.length;

        if (!canContinue) {
          await new Promise<void>((resolve) => fileStream.once('drain', () => resolve()));
        }

        const now = Date.now();
        const elapsed = (now - lastTime) / 1000;
        if (elapsed >= 0.25) {
          const bytesPerSecond = Math.round((transferred - lastTransferred) / elapsed);
          lastTime = now;
          lastTransferred = transferred;
          const percent = totalBytes > 0 ? (transferred / totalBytes) * 100 : 0;
          onProgress({
            percent: Math.round(percent * 10) / 10,
            bytesPerSecond,
            transferred,
            total: totalBytes || transferred,
          });
        }
      }
    }

    await new Promise<void>((resolve, reject) => {
      fileStream.end((err?: Error | null) => {
        if (err) reject(err);
        else resolve();
      });
    });

    onProgress({
      percent: 100,
      bytesPerSecond: 0,
      transferred,
      total: totalBytes || transferred,
    });

    console.log('[MacUpdater] Download complete. Extracting update archive with ditto...');

    // 3. Extract using macOS ditto (preserves symlinks, resource forks & permissions)
    const extractDir = path.join(stagingDir, 'extracted');
    await fs.promises.rm(extractDir, { recursive: true, force: true }).catch(() => {});
    await fs.promises.mkdir(extractDir, { recursive: true });

    await new Promise<void>((resolve, reject) => {
      execFile('/usr/bin/ditto', ['-xk', zipPath, extractDir], (err, _stdout, stderr) => {
        if (err) {
          reject(new Error(`Failed to extract update package: ${stderr || err.message}`));
        } else {
          resolve();
        }
      });
    });

    // Locate the extracted .app bundle
    let appBundlePath = path.join(extractDir, 'Regne.app');
    if (!fs.existsSync(appBundlePath)) {
      const items = await fs.promises.readdir(extractDir);
      const appItem = items.find((item) => item.endsWith('.app'));
      if (appItem) {
        appBundlePath = path.join(extractDir, appItem);
      } else {
        throw new Error('Downloaded update archive did not contain a valid .app bundle');
      }
    }

    // Clean up zip archive to free disk space
    await fs.promises.unlink(zipPath).catch(() => {});

    this.stagedAppPath = appBundlePath;
    this.stagedVersion = version;

    console.log('[MacUpdater] Staged update ready at:', appBundlePath);
    return { appPath: appBundlePath, version };
  }

  /**
   * Applies the staged update by launching a detached background script
   * that waits for this process to terminate, replaces the application bundle,
   * removes the quarantine flag, and relaunches the app.
   */
  public applyAndRestart(): void {
    if (!this.stagedAppPath || !fs.existsSync(this.stagedAppPath)) {
      throw new Error('No downloaded update is ready to install');
    }

    // Target application bundle to overwrite
    let targetAppPath = '/Applications/Regne.app';
    if (app.isPackaged) {
      targetAppPath = path.resolve(process.execPath, '../../..');
    }

    const pid = process.pid;
    const scriptDir = path.join(app.getPath('userData'), 'updater');
    fs.mkdirSync(scriptDir, { recursive: true });
    const scriptPath = path.join(scriptDir, 'install-update.sh');
    const stagingDir = path.dirname(this.stagedAppPath);

    console.log('[MacUpdater] Preparing detached swap script:');
    console.log('  Target App:', targetAppPath);
    console.log('  Staged App:', this.stagedAppPath);

    const shellScript = `#!/bin/bash
# Wait for the running application (PID ${pid}) to exit
while kill -0 ${pid} 2>/dev/null; do
  sleep 0.1
done

# Buffer to ensure file handles are fully released
sleep 0.5

# Replace application bundle in-place
rm -rf "${targetAppPath}"
cp -Rp "${this.stagedAppPath}" "${targetAppPath}"

# Strip quarantine attribute recursively so Gatekeeper does not block the app
xattr -cr "${targetAppPath}" 2>/dev/null || true

# Relaunch the new version
open "${targetAppPath}"

# Clean up staging directory and script
rm -rf "${stagingDir}" 2>/dev/null || true
rm -f "${scriptPath}" 2>/dev/null || true
`;

    fs.writeFileSync(scriptPath, shellScript, { mode: 0o755 });

    const child = spawn('/bin/bash', [scriptPath], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    console.log('[MacUpdater] Detached swap process spawned. Quitting application...');
    app.quit();
  }
}

export const macUpdater = new MacUpdater();
