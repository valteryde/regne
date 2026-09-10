const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function brandElectron() {
  if (process.platform !== 'darwin') {
    return;
  }

  const electronAppPath = path.join(__dirname, '../node_modules/electron/dist/Electron.app');
  if (!fs.existsSync(electronAppPath)) {
    return;
  }

  const infoPlistPath = path.join(electronAppPath, 'Contents/Info.plist');
  const icnsSourcePath = path.join(__dirname, '../resources/icon.icns');
  const icnsDestPath = path.join(electronAppPath, 'Contents/Resources/electron.icns');

  try {
    if (fs.existsSync(infoPlistPath)) {
      execSync(`plutil -replace CFBundleName -string "Regne" "${infoPlistPath}"`, { stdio: 'ignore' });
      execSync(`plutil -replace CFBundleDisplayName -string "Regne" "${infoPlistPath}"`, { stdio: 'ignore' });
      console.log('[brand-electron] Info.plist updated with app name "Regne"');
    }

    if (fs.existsSync(icnsSourcePath)) {
      fs.copyFileSync(icnsSourcePath, icnsDestPath);
      console.log('[brand-electron] Replaced electron.icns with Regne icon');
    }
  } catch (err) {
    console.warn('[brand-electron] Note: Could not update Electron.app bundle:', err.message);
  }
}

brandElectron();
