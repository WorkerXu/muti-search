export interface RendererWebviewElement extends HTMLElement {
  executeJavaScript(code: string, userGesture?: boolean): Promise<unknown>;
  insertText?(text: string): Promise<void>;
  loadURL?(url: string): Promise<void>;
  paste?(): Promise<void> | void;
  replace?(text: string): void;
  reload(): void;
  selectAll?(): void;
  sendInputEvent?(event: RendererWebviewInputEvent): Promise<void> | void;
}

type RendererWebviewInputEvent =
  {
    type: 'mouseDown' | 'mouseUp' | 'mouseMove';
    x: number;
    y: number;
    button?: 'left' | 'middle' | 'right';
    clickCount?: number;
  }
  | {
    type: 'keyDown' | 'keyUp' | 'rawKeyDown' | 'char';
    keyCode: string;
    modifiers?: Array<'shift' | 'control' | 'ctrl' | 'alt' | 'meta' | 'command'>;
  };

declare global {
  interface HTMLElementTagNameMap {
    webview: RendererWebviewElement;
  }
}
