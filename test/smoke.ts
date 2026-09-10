import { app, BrowserWindow } from 'electron';
import * as path from 'path';

if (process.platform === 'darwin' && app.dock) {
  app.dock.hide();
}

app.whenReady().then(async () => {
  console.log('Testing Electron Launch...');
  const preloadPath = path.resolve(__dirname, '../../preload/index.js');
  const htmlPath = path.resolve(__dirname, '../../renderer/index.html');

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.webContents.on('did-fail-load', (_e, code, desc) => {
    console.error('Failed to load:', code, desc);
    app.exit(1);
  });

  win.webContents.on('did-finish-load', () => {
    console.log('✓ HTML & React bundle loaded successfully into BrowserWindow');
    setTimeout(() => {
      console.log('✓ Smoke test complete. Exiting.');
      app.exit(0);
    }, 500);
  });

  console.log('Loading file:', htmlPath);
  await win.loadFile(htmlPath);
});
