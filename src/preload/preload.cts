const MARKDOWN_EXPORT_CHANNEL = 'muti-search:save-markdown-export';
const DEBUG_LOG_CHANNEL = 'muti-search:append-debug-log';
const BEGIN_CLIPBOARD_TEXT_PASTE_CHANNEL = 'muti-search:begin-clipboard-text-paste';
const RESTORE_CLIPBOARD_TEXT_PASTE_CHANNEL = 'muti-search:restore-clipboard-text-paste';

type MarkdownExportPayload = {
  markdown: string;
};

type MarkdownExportResult = {
  filePath: string;
};

type DebugLogPayload = {
  message: string;
};

type ClipboardTextPastePayload = {
  text: string;
};

type ClipboardTextPasteResult = {
  token: string;
};

type ClipboardTextPasteRestorePayload = {
  token: string;
};

const { contextBridge, ipcRenderer } = require('electron') as typeof import('electron');

contextBridge.exposeInMainWorld('mutiSearch', {
  saveMarkdownExport: (payload: MarkdownExportPayload): Promise<MarkdownExportResult> =>
    ipcRenderer.invoke(MARKDOWN_EXPORT_CHANNEL, payload) as Promise<MarkdownExportResult>,
  appendDebugLog: (payload: DebugLogPayload): Promise<void> =>
    ipcRenderer.invoke(DEBUG_LOG_CHANNEL, payload) as Promise<void>,
  beginClipboardTextPaste: (
    payload: ClipboardTextPastePayload
  ): Promise<ClipboardTextPasteResult> =>
    ipcRenderer.invoke(
      BEGIN_CLIPBOARD_TEXT_PASTE_CHANNEL,
      payload
    ) as Promise<ClipboardTextPasteResult>,
  restoreClipboardTextPaste: (payload: ClipboardTextPasteRestorePayload): Promise<void> =>
    ipcRenderer.invoke(RESTORE_CLIPBOARD_TEXT_PASTE_CHANNEL, payload) as Promise<void>
});

window.addEventListener('DOMContentLoaded', () => {
  document.documentElement.dataset.mutiSearchPreload = 'ready';
});
