import { BrowserWindow, app, shell } from 'electron';
import { join } from 'node:path';

const distRoot = join(process.cwd(), 'dist');
const preloadPath = join(distRoot, 'preload/preload.js');

export type RendererTarget =
  | { type: 'url'; value: string }
  | { type: 'file'; value: string };

export function getRendererTarget(env: NodeJS.ProcessEnv = process.env): RendererTarget {
  if (env.VITE_DEV_SERVER_URL) {
    return { type: 'url', value: env.VITE_DEV_SERVER_URL };
  }

  return { type: 'file', value: join(distRoot, 'renderer/index.html') };
}

export async function createWindow(): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    title: 'muti-search',
    webPreferences: {
      preload: preloadPath,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      webviewTag: true
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  const target = getRendererTarget();
  if (target.type === 'url') {
    await win.loadURL(target.value);
  } else {
    await win.loadFile(target.value);
  }

  return win;
}

function reportStartupError(error: unknown): void {
  console.error('Failed to start muti-search:', error);
  app.exit(1);
}

function startApp(): void {
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app
    .whenReady()
    .then(async () => {
      await createWindow();

      app.on('activate', async () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          await createWindow();
        }
      });
    })
    .catch(reportStartupError);
}

if (process.env.VITEST !== 'true') {
  startApp();
}
