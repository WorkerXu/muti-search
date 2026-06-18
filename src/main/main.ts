import { BrowserWindow, app, shell } from 'electron';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { services, type ServiceDefinition } from '../shared/services.js';

type WebviewPreferences = {
  preload?: string;
  preloadURL?: string;
  nodeIntegration?: boolean;
  contextIsolation?: boolean;
  sandbox?: boolean;
  webSecurity?: boolean;
  [key: string]: unknown;
};

type WebviewParams = {
  src?: string;
  partition?: string;
  [key: string]: string | undefined;
};

type PreventableEvent = {
  preventDefault(): void;
};

export function resolveDistRoot(
  currentModuleUrl: string = import.meta.url,
  cwd: string = process.cwd()
): string {
  const currentDir = dirname(fileURLToPath(currentModuleUrl));

  return currentDir.endsWith(`${sep}dist${sep}main`) ? join(currentDir, '..') : join(cwd, 'dist');
}

export function getPreloadPath(
  currentModuleUrl: string = import.meta.url,
  cwd: string = process.cwd()
): string {
  return join(resolveDistRoot(currentModuleUrl, cwd), 'preload/preload.js');
}

export type RendererTarget =
  | { type: 'url'; value: string }
  | { type: 'file'; value: string };

export function getRendererTarget(env: NodeJS.ProcessEnv = process.env): RendererTarget {
  if (env.VITE_DEV_SERVER_URL) {
    return { type: 'url', value: env.VITE_DEV_SERVER_URL };
  }

  return { type: 'file', value: join(resolveDistRoot(), 'renderer/index.html') };
}

const ALLOWED_EXTERNAL_ORIGINS = new Set(
  services.map((service) => new URL(service.url).origin)
);

export function isAllowedExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }

    return ALLOWED_EXTERNAL_ORIGINS.has(parsed.origin);
  } catch {
    return false;
  }
}

export function isAllowedWebviewConfig(src: string, partition: string): boolean {
  let normalizedSrc: string;
  try {
    normalizedSrc = new URL(src).href;
  } catch {
    return false;
  }

  return services.some((service: ServiceDefinition) => {
    if (service.partition !== partition) {
      return false;
    }

    return new URL(service.url).href === normalizedSrc;
  });
}

export function sanitizeWebviewPreferences<T extends WebviewPreferences>(preferences: T): T {
  delete preferences.preload;
  delete preferences.preloadURL;
  preferences.nodeIntegration = false;
  preferences.contextIsolation = true;
  preferences.sandbox = true;
  preferences.webSecurity = true;
  return preferences;
}

export function handleWebviewAttach(
  event: PreventableEvent,
  preferences: WebviewPreferences,
  params: WebviewParams
): void {
  sanitizeWebviewPreferences(preferences);

  if (!isAllowedWebviewConfig(params.src ?? '', params.partition ?? '')) {
    event.preventDefault();
  }
}

export function registerWebviewHardening(targetApp: Pick<typeof app, 'on'> = app): void {
  targetApp.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event, preferences, params) => {
      handleWebviewAttach(event, preferences as WebviewPreferences, params as WebviewParams);
    });
  });
}

function createWindowWithErrorHandling(): void {
  void createWindow().catch(reportStartupError);
}

export async function createWindow(): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    title: 'muti-search',
    webPreferences: {
      preload: getPreloadPath(),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      webviewTag: true
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) {
      void shell.openExternal(url);
    }

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
  registerWebviewHardening();

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app
    .whenReady()
    .then(async () => {
      createWindowWithErrorHandling();

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createWindowWithErrorHandling();
        }
      });
    })
    .catch(reportStartupError);
}

if (process.env.VITEST !== 'true') {
  startApp();
}
