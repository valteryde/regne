import { Menu, MenuItemConstructorOptions, BrowserWindow, app, shell } from 'electron';

export function createApplicationMenu(mainWindow: BrowserWindow, checkForUpdates?: () => void): Menu {
  const sendCommand = (cmd: string) => {
    mainWindow.webContents.send('menu:command', cmd);
  };

  const isMac = process.platform === 'darwin';

  const template: MenuItemConstructorOptions[] = [
    ...(isMac ? [{
      label: 'Regne',
      submenu: [
        {
          label: 'About Regne',
          role: 'about',
        },
        {
          label: 'Check for Updates…',
          click: () => checkForUpdates?.(),
        },
        { type: 'separator' },
        {
          label: 'Preferences & Settings...',
          accelerator: 'CmdOrCtrl+,',
          click: () => sendCommand('open-settings'),
        },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        {
          label: 'Hide Regne',
          role: 'hide',
        },
        {
          label: 'Hide Others',
          role: 'hideOthers',
        },
        {
          label: 'Show All',
          role: 'unhide',
        },
        { type: 'separator' },
        {
          label: 'Quit Regne',
          role: 'quit',
        }
      ] as MenuItemConstructorOptions[]
    }] : []),
    {
      label: '&File',
      submenu: [
        {
          label: 'New Document',
          accelerator: 'CmdOrCtrl+N',
          click: () => sendCommand('new-file'),
        },
        {
          label: 'Open Document...',
          accelerator: 'CmdOrCtrl+O',
          click: () => sendCommand('open-file'),
        },
        ...(!isMac ? [
          { type: 'separator' as const },
          {
            label: 'Preferences & Settings...',
            accelerator: 'CmdOrCtrl+,',
            click: () => sendCommand('open-settings'),
          },
        ] : []),
        { type: 'separator' },
        {
          label: 'Save Document',
          accelerator: 'CmdOrCtrl+S',
          click: () => sendCommand('save-file'),
        },
        {
          label: 'Save Document As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => sendCommand('save-file-as'),
        },
        { type: 'separator' },
        {
          label: 'Export to LaTeX...',
          click: () => sendCommand('export-latex'),
        },
        {
          label: 'Export to HTML...',
          click: () => sendCommand('export-html'),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: '&Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => sendCommand('undo'),
        },
        {
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Shift+Z',
          click: () => sendCommand('redo'),
        },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: '&Insert',
      submenu: [
        {
          label: 'Math Line',
          accelerator: 'CmdOrCtrl+M',
          click: () => sendCommand('insert-math'),
        },
        {
          label: 'Text Paragraph',
          accelerator: 'CmdOrCtrl+T',
          click: () => sendCommand('insert-text'),
        },
      ]
    },
    {
      label: '&Evaluate',
      submenu: [
        {
          label: 'Evaluate Math',
          click: () => sendCommand('evaluate-math'),
        },
        {
          label: 'Evaluate Entire Document',
          accelerator: 'CmdOrCtrl+Shift+Return',
          click: () => sendCommand('evaluate-all'),
        },
        { type: 'separator' },
        {
          label: 'Restart CAS Engine (restart;)',
          click: () => sendCommand('restart-engine'),
        }
      ]
    },
    {
      label: '&View',
      submenu: [
        {
          label: 'Toggle Left Bar',
          accelerator: 'CmdOrCtrl+B',
          click: () => sendCommand('toggle-sidebar'),
        },
        { type: 'separator' },
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+=',
          click: () => sendCommand('zoom-in'),
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => sendCommand('zoom-out'),
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => sendCommand('zoom-reset'),
        },
        { type: 'separator' },
        {
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow.webContents.reload(),
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: isMac ? 'Alt+Command+I' : 'Ctrl+Shift+I',
          click: () => mainWindow.webContents.toggleDevTools(),
        },
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'About Regne',
          click: () => {
            app.showAboutPanel();
          },
        },
        { type: 'separator' },
        {
          label: 'Check for Updates…',
          click: () => checkForUpdates?.(),
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}
