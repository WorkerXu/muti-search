export interface RendererWebviewElement extends HTMLElement {
  executeJavaScript(code: string, userGesture?: boolean): Promise<unknown>;
  reload(): void;
}

declare global {
  interface HTMLElementTagNameMap {
    webview: RendererWebviewElement;
  }
}
