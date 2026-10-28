import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

async function packageApp() {
  const rootDir = process.cwd();
  const zipPath = path.resolve(rootDir, 'tripmates-source.zip');
  const tempDir = path.resolve(rootDir, 'temp-package-stage');

  console.log('Preparing clean downloadable ZIP...');

  // Clean previous stage or zip
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  if (fs.existsSync(zipPath)) {
    fs.rmSync(zipPath, { force: true });
  }

  fs.mkdirSync(tempDir, { recursive: true });

  const includeItems = [
    'README.md',
    'package.json',
    'package-lock.json',
    'vite.config.ts',
    '.env.example',
    '.gitignore',
    'database',
    'docs',
    'backend',
    'frontend',
  ];

  function copyRecursive(src: string, dest: string) {
    const stat = fs.statSync(src);
    if (stat.isDirectory()) {
      fs.mkdirSync(dest, { recursive: true });
      for (const child of fs.readdirSync(src)) {
        // Exclude unwanted directories and files
        if (
          child === 'node_modules' ||
          child === '.git' ||
          child === 'dist' ||
          child === 'data' ||
          child.endsWith('.db') ||
          child.endsWith('.db-wal') ||
          child.endsWith('.db-shm') ||
          child.endsWith('.log')
        ) {
          continue;
        }
        copyRecursive(path.join(src, child), path.join(dest, child));
      }
    } else {
      fs.copyFileSync(src, dest);
    }
  }

  for (const item of includeItems) {
    const srcPath = path.join(rootDir, item);
    if (fs.existsSync(srcPath)) {
      copyRecursive(srcPath, path.join(tempDir, item));
    }
  }

  // Compress using PowerShell Compress-Archive
  try {
    const cmd = `powershell -Command "Compress-Archive -Path '${tempDir}\\*' -DestinationPath '${zipPath}' -Force"`;
    execSync(cmd, { stdio: 'inherit' });
    console.log(`\nSuccessfully created clean downloadable package:\n${zipPath}`);
    const sizeBytes = fs.statSync(zipPath).size;
    console.log(`Package size: ${(sizeBytes / 1024).toFixed(1)} KB`);
  } finally {
    // Cleanup staging directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }
}

packageApp().catch(err => {
  console.error('Packaging failed:', err);
  process.exit(1);
});
