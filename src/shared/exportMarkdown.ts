export const MARKDOWN_EXPORT_CHANNEL = 'muti-search:save-markdown-export';
export const DEBUG_LOG_CHANNEL = 'muti-search:append-debug-log';
export const BEGIN_CLIPBOARD_TEXT_PASTE_CHANNEL = 'muti-search:begin-clipboard-text-paste';
export const RESTORE_CLIPBOARD_TEXT_PASTE_CHANNEL = 'muti-search:restore-clipboard-text-paste';

export type MarkdownExportPayload = {
  markdown: string;
};

export type MarkdownExportResult = {
  filePath: string;
};

export type DebugLogPayload = {
  message: string;
};

export type ClipboardTextPastePayload = {
  text: string;
};

export type ClipboardTextPasteResult = {
  token: string;
};

export type ClipboardTextPasteRestorePayload = {
  token: string;
};
