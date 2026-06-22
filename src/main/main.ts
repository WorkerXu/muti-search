import { BrowserWindow, app, clipboard, ipcMain, shell } from 'electron';
import { appendFile, writeFile } from 'node:fs/promises';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BEGIN_CLIPBOARD_TEXT_PASTE_CHANNEL,
  type ClipboardTextPastePayload,
  type ClipboardTextPasteRestorePayload,
  type ClipboardTextPasteResult,
  DEBUG_LOG_CHANNEL,
  type DebugLogPayload,
  MARKDOWN_EXPORT_CHANNEL,
  type MarkdownExportPayload,
  type MarkdownExportResult,
  RESTORE_CLIPBOARD_TEXT_PASTE_CHANNEL
} from '../shared/exportMarkdown.js';
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
  return join(resolveDistRoot(currentModuleUrl, cwd), 'preload/preload.cjs');
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
const pendingClipboardRestores = new Map<string, string>();

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

function formatExportTimestamp(date: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');

  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join('-') + `-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export async function saveMarkdownExport(
  payload: MarkdownExportPayload,
  downloadsDir: string = app.getPath('downloads'),
  now: Date = new Date()
): Promise<MarkdownExportResult> {
  const markdown = typeof payload.markdown === 'string' ? payload.markdown : '';
  if (!markdown.trim()) {
    throw new Error('导出内容为空');
  }

  const filePath = join(downloadsDir, `muti-search-${formatExportTimestamp(now)}.md`);
  await writeFile(filePath, markdown, 'utf8');

  return { filePath };
}

export function registerMarkdownExportIpc(): void {
  ipcMain.handle(MARKDOWN_EXPORT_CHANNEL, (_event, payload: MarkdownExportPayload) =>
    saveMarkdownExport(payload)
  );
}

export function getDebugLogPath(userDataDir: string = app.getPath('userData')): string {
  return join(userDataDir, 'muti-search-debug.log');
}

export async function appendDebugLog(
  payload: DebugLogPayload,
  userDataDir?: string,
  now: Date = new Date()
): Promise<void> {
  const message = typeof payload.message === 'string' ? payload.message : '';
  if (!message.trim()) {
    return;
  }

  await appendFile(getDebugLogPath(userDataDir), `${now.toISOString()} ${message}\n`, 'utf8');
}

export function registerDebugLogIpc(): void {
  ipcMain.handle(DEBUG_LOG_CHANNEL, (_event, payload: DebugLogPayload) =>
    appendDebugLog(payload)
  );
}

export function beginClipboardTextPaste(
  payload: ClipboardTextPastePayload,
  now: Date = new Date()
): ClipboardTextPasteResult {
  const text = typeof payload.text === 'string' ? payload.text : '';
  const token = `${now.getTime()}-${Math.random().toString(36).slice(2)}`;
  pendingClipboardRestores.set(token, clipboard.readText());
  clipboard.writeText(text);
  return { token };
}

export function restoreClipboardTextPaste(payload: ClipboardTextPasteRestorePayload): void {
  const token = typeof payload.token === 'string' ? payload.token : '';
  if (!pendingClipboardRestores.has(token)) {
    return;
  }

  const previousText = pendingClipboardRestores.get(token) ?? '';
  pendingClipboardRestores.delete(token);
  clipboard.writeText(previousText);
}

export function registerClipboardPasteIpc(): void {
  ipcMain.handle(
    BEGIN_CLIPBOARD_TEXT_PASTE_CHANNEL,
    (_event, payload: ClipboardTextPastePayload) => beginClipboardTextPaste(payload)
  );
  ipcMain.handle(
    RESTORE_CLIPBOARD_TEXT_PASTE_CHANNEL,
    (_event, payload: ClipboardTextPasteRestorePayload) => restoreClipboardTextPaste(payload)
  );
}

export function focusExistingWindow(): void {
  const existingWindow = BrowserWindow.getAllWindows()[0];
  if (!existingWindow) {
    createWindowWithErrorHandling();
    return;
  }

  if (existingWindow.isMinimized()) {
    existingWindow.restore();
  }
  existingWindow.focus();
}

export function requestSingleInstanceOrQuit(
  targetApp: Pick<typeof app, 'quit' | 'requestSingleInstanceLock' | 'on'> = app
): boolean {
  if (!targetApp.requestSingleInstanceLock()) {
    targetApp.quit();
    return false;
  }

  targetApp.on('second-instance', focusExistingWindow);
  return true;
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

  win.webContents.on('console-message', (_event, _level, message) => {
    if (message.includes('[muti-search]')) {
      console.log(message);
    }
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
  if (!requestSingleInstanceOrQuit()) {
    return;
  }

  registerWebviewHardening();
  registerMarkdownExportIpc();
  registerDebugLogIpc();
  registerClipboardPasteIpc();

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
