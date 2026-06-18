export interface RendererWebviewElement extends HTMLElement {
  executeJavaScript(code: string, userGesture?: boolean): Promise<unknown>;
  loadURL?(url: string): Promise<void>;
  reload(): void;
}

declare global {
  interface HTMLElementTagNameMap {
    webview: RendererWebviewElement;
  }
}
