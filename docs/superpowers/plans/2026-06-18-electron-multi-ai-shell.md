# Electron Multi-AI Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first working Electron prototype of muti-search: a 3x3 desktop shell that loads 9 official AI web UIs with isolated persistent sessions and sends one prompt to selected services.

**Architecture:** Use a secure Electron `BrowserWindow` for the local app shell and Electron `<webview>` guest views for the 9 remote AI pages. The renderer owns the top input, service toggles, 3x3 grid, lightweight per-pane status bars, and prompt dispatch; each `<webview>` uses its own `persist:<service>` partition and receives a controlled DOM injection script when the user clicks `发送到已选`.

**Tech Stack:** Electron, TypeScript, Vite, Vitest, jsdom, vanilla DOM renderer, npm scripts.

---

## Implementation Note

`docs/design.md` records the architectural direction as Electron desktop shell with multiple isolated web views. This plan implements that direction with Electron `<webview>` tags instead of `BaseWindow + WebContentsView` because version 1 needs local HTML controls and per-pane status bars around every remote page. `<webview>` still creates isolated guest web contents, supports persistent partitions, and avoids ordinary browser iframe restrictions.

## File Structure

- `package.json` — npm scripts and dependencies.
- `tsconfig.json` — TypeScript settings for renderer, shared code, and tests.
- `tsconfig.node.json` — TypeScript settings for Electron main/preload.
- `vite.config.ts` — renderer build and Vitest config.
- `index.html` — Vite renderer entry.
- `src/shared/services.ts` — 9 service definitions and persistent partitions.
- `src/shared/status.ts` — pane state and user-facing status labels.
- `src/shared/domScript.ts` — injected script builder for filling and submitting remote pages.
- `src/main/main.ts` — secure Electron window with `webviewTag` enabled.
- `src/preload/preload.ts` — minimal preload marker, no privileged API exposed to remote content.
- `src/renderer/webviewTypes.ts` — local type for Electron webview elements.
- `src/renderer/app.ts` — UI, service toggles, 3x3 grid, send flow.
- `src/renderer/main.ts` — renderer bootstrap.
- `src/renderer/styles.css` — desktop shell styling.
- `tests/shared/services.test.ts` — service registry tests.
- `tests/shared/domScript.test.ts` — injection script escaping tests.
- `tests/renderer/app.test.ts` — renderer behavior tests.
- `README.md` — run and verification notes.

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main/main.ts`
- Create: `src/preload/preload.ts`
- Create: `src/renderer/main.ts`
- Create: `src/renderer/styles.css`
- Create: `tests/smoke.test.ts`
- Create: `README.md`

- [ ] **Step 1: Create package metadata**

`package.json`

```json
{
  "name": "muti-search",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/main/main.js",
  "scripts": {
    "dev": "concurrently -k \"tsc -p tsconfig.node.json --watch --preserveWatchOutput\" \"vite --host 127.0.0.1\" \"wait-on dist/main/main.js http://127.0.0.1:5173 && nodemon --watch dist/main --watch dist/preload --ext js --exec \\\"electron .\\\"\"",
    "build": "npm run build:main && vite build",
    "build:main": "tsc -p tsconfig.node.json",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit && tsc -p tsconfig.node.json --noEmit"
  },
  "dependencies": {
    "electron": "^39.2.6"
  },
  "devDependencies": {
    "@types/node": "^24.10.1",
    "concurrently": "^9.2.1",
    "jsdom": "^27.2.0",
    "typescript": "^5.9.3",
    "vite": "^7.3.1",
    "nodemon": "^3.1.10",
    "vitest": "^4.1.6",
    "wait-on": "^9.0.3"
  }
}
```

- [ ] **Step 2: Create TypeScript configs**

`.gitignore`

```gitignore
node_modules/
dist/
.DS_Store
```

`tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "module": "ESNext",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/renderer", "src/shared", "tests", "vite.config.ts"]
}
```

`tsconfig.node.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022", "DOM"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "types": ["node"],
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/main", "src/preload", "src/shared"]
}
```

- [ ] **Step 3: Create Vite and Vitest config**

`vite.config.ts`

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    outDir: 'dist/renderer',
    emptyOutDir: false
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.ts']
  }
});
```

- [ ] **Step 4: Create minimal renderer entry**

`index.html`

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>muti-search</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/renderer/main.ts"></script>
  </body>
</html>
```

`src/renderer/main.ts`

```ts
import './styles.css';

const root = document.querySelector<HTMLDivElement>('#app');

if (!root) {
  throw new Error('Missing #app root element');
}

root.innerHTML = '<main class="app-shell"><h1>muti-search</h1></main>';
```

`src/main/main.ts`

```ts
import { BrowserWindow, app, shell } from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = fileURLToPath(new URL('.', import.meta.url));

async function createWindow(): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    title: 'muti-search',
    webPreferences: {
      preload: join(dirname, '../preload/preload.js'),
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

  if (process.env.VITE_DEV_SERVER_URL) {
    await win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await win.loadFile(join(dirname, '../renderer/index.html'));
  }

  return win;
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.whenReady().then(async () => {
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});
```

`src/preload/preload.ts`

```ts
window.addEventListener('DOMContentLoaded', () => {
  document.documentElement.dataset.mutiSearchPreload = 'ready';
});
```

`src/renderer/styles.css`

```css
:root {
  color-scheme: light;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
  background: #f6f7f9;
  color: #16181d;
}

body {
  margin: 0;
}

.app-shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
}
```

- [ ] **Step 5: Add smoke test**

`tests/smoke.test.ts`

```ts
import { beforeEach, describe, expect, it } from 'vitest';

describe('renderer bootstrap', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('mounts the app shell into #app', async () => {
    await import('../src/renderer/main');

    expect(document.querySelector('.app-shell')).not.toBeNull();
    expect(document.querySelector('h1')?.textContent).toBe('muti-search');
  });
});
```

- [ ] **Step 6: Add README**

`README.md`

```md
# muti-search

Local Electron desktop shell for viewing 9 official AI web UIs in a 3x3 grid and sending one manually entered prompt to selected services.

## Development

```bash
npm install
npm run dev
```

## Verification

```bash
npm run typecheck
npm test
npm run build
```

## Product Boundaries

- Personal use only.
- Human-triggered send only.
- No prompt or answer history in version 1.
- No captcha bypass, background queue, or automated looping.
```

- [ ] **Step 7: Install dependencies and verify scaffold**

Run:

```bash
npm install
npm run typecheck
npm test
npm run build
```

Expected:

- `npm install` exits with code 0 and creates `package-lock.json`.
- `npm run typecheck` exits with code 0.
- `npm test` exits with code 0 and reports the smoke test passing.
- `npm run build` exits with code 0 and writes `dist/renderer`.

- [ ] **Step 8: Commit scaffold**

```bash
git add .gitignore package.json package-lock.json tsconfig.json tsconfig.node.json vite.config.ts index.html src/main/main.ts src/preload/preload.ts src/renderer/main.ts src/renderer/styles.css tests/smoke.test.ts README.md
git commit -m "chore: scaffold electron vite project"
```

Expected: commit succeeds. If the repository has no `.git` directory, run `git init` once, then repeat the `git add` and `git commit` commands.

## Task 2: Service and Status Models

**Files:**
- Create: `src/shared/services.ts`
- Create: `src/shared/status.ts`
- Create: `tests/shared/services.test.ts`

- [ ] **Step 1: Write failing service tests**

`tests/shared/services.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { SERVICE_IDS, getService, services } from '../../src/shared/services';
import { createInitialPaneState, statusLabels } from '../../src/shared/status';

describe('service registry', () => {
  it('contains the 9 selected services in grid order', () => {
    expect(SERVICE_IDS).toEqual([
      'chatgpt',
      'deepseek',
      'grok',
      'doubao',
      'gemini',
      'yuanbao',
      'qwen',
      'zhipu',
      'perplexity'
    ]);
    expect(services).toHaveLength(9);
  });

  it('uses persistent partitions for every service', () => {
    expect(services.map((service) => service.partition)).toEqual([
      'persist:chatgpt',
      'persist:deepseek',
      'persist:grok',
      'persist:doubao',
      'persist:gemini',
      'persist:yuanbao',
      'persist:qwen',
      'persist:zhipu',
      'persist:perplexity'
    ]);
  });

  it('preserves official service URLs', () => {
    expect(getService('doubao')).toMatchObject({
      id: 'doubao',
      name: '豆包',
      url: 'https://www.doubao.com/chat/'
    });
    expect(getService('perplexity').url).toBe('https://www.perplexity.ai');
  });

  it('creates an initial pane state with no stored prompt or answer data', () => {
    expect(createInitialPaneState()).toEqual({
      enabled: true,
      selected: true,
      status: 'loading',
      errorMessage: null
    });
    expect(statusLabels.manual_required).toBe('需人工处理');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/shared/services.test.ts
```

Expected: FAIL with import errors for `src/shared/services` and `src/shared/status`.

- [ ] **Step 3: Implement service registry**

`src/shared/services.ts`

```ts
export const SERVICE_IDS = [
  'chatgpt',
  'deepseek',
  'grok',
  'doubao',
  'gemini',
  'yuanbao',
  'qwen',
  'zhipu',
  'perplexity'
] as const;

export type ServiceId = (typeof SERVICE_IDS)[number];

export type ServiceDefinition = {
  id: ServiceId;
  name: string;
  url: string;
  partition: `persist:${ServiceId}`;
  accent: string;
};

export const services: ServiceDefinition[] = [
  { id: 'chatgpt', name: 'ChatGPT', url: 'https://chatgpt.com', partition: 'persist:chatgpt', accent: '#10a37f' },
  { id: 'deepseek', name: 'DeepSeek', url: 'https://chat.deepseek.com', partition: 'persist:deepseek', accent: '#2563eb' },
  { id: 'grok', name: 'Grok', url: 'https://grok.com', partition: 'persist:grok', accent: '#6d5bd0' },
  { id: 'doubao', name: '豆包', url: 'https://www.doubao.com/chat/', partition: 'persist:doubao', accent: '#8b6b4f' },
  { id: 'gemini', name: 'Gemini', url: 'https://gemini.google.com', partition: 'persist:gemini', accent: '#4285f4' },
  { id: 'yuanbao', name: '元宝', url: 'https://yuanbao.tencent.com', partition: 'persist:yuanbao', accent: '#059669' },
  { id: 'qwen', name: '千问', url: 'https://chat.qwen.ai', partition: 'persist:qwen', accent: '#7c3aed' },
  { id: 'zhipu', name: '智谱', url: 'https://chatglm.cn', partition: 'persist:zhipu', accent: '#2563eb' },
  { id: 'perplexity', name: 'Perplexity', url: 'https://www.perplexity.ai', partition: 'persist:perplexity', accent: '#0e7490' }
];

export function getService(id: string): ServiceDefinition {
  const service = services.find((item) => item.id === id);

  if (!service) {
    throw new Error(`Unknown service id: ${id}`);
  }

  return service;
}
```

- [ ] **Step 4: Implement pane status model**

`src/shared/status.ts`

```ts
export const PANE_STATUSES = [
  'loading',
  'ready',
  'login_required',
  'sending',
  'sent',
  'manual_required',
  'error',
  'disabled'
] as const;

export type PaneStatus = (typeof PANE_STATUSES)[number];

export type PaneState = {
  enabled: boolean;
  selected: boolean;
  status: PaneStatus;
  errorMessage: string | null;
};

export const statusLabels: Record<PaneStatus, string> = {
  loading: '加载中',
  ready: '就绪',
  login_required: '需登录',
  sending: '发送中',
  sent: '已发送',
  manual_required: '需人工处理',
  error: '失败',
  disabled: '已关闭'
};

export function createInitialPaneState(): PaneState {
  return {
    enabled: true,
    selected: true,
    status: 'loading',
    errorMessage: null
  };
}
```

- [ ] **Step 5: Run model tests**

Run:

```bash
npm test -- tests/shared/services.test.ts
```

Expected: PASS for 4 tests.

- [ ] **Step 6: Commit models**

```bash
git add src/shared/services.ts src/shared/status.ts tests/shared/services.test.ts
git commit -m "feat: add service and pane models"
```

## Task 3: Injected DOM Send Script

**Files:**
- Create: `src/shared/domScript.ts`
- Create: `tests/shared/domScript.test.ts`

- [ ] **Step 1: Write failing script tests**

`tests/shared/domScript.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { buildDomSendScript } from '../../src/shared/domScript';

describe('buildDomSendScript', () => {
  it('escapes prompt text safely', () => {
    const script = buildDomSendScript({
      prompt: 'hello `world` ${bad}',
      inputSelectors: ['textarea'],
      submitSelectors: ['button[type="submit"]']
    });

    expect(script).toContain(JSON.stringify('hello `world` ${bad}'));
    expect(script).not.toContain('const prompt = `hello `world` ${bad}`');
  });

  it('contains stable result shapes and Chinese error messages', () => {
    const script = buildDomSendScript({
      prompt: 'hello',
      inputSelectors: ['textarea'],
      submitSelectors: ['button[type="submit"]']
    });

    expect(script).toContain("status: 'sent'");
    expect(script).toContain("status: 'manual_required'");
    expect(script).toContain('未找到输入框');
    expect(script).toContain('未找到发送按钮');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/shared/domScript.test.ts
```

Expected: FAIL with an import error for `src/shared/domScript`.

- [ ] **Step 3: Implement script builder**

`src/shared/domScript.ts`

```ts
export type DomSendScriptInput = {
  prompt: string;
  inputSelectors: string[];
  submitSelectors: string[];
};

export type DomSendScriptResult = {
  status: 'sent' | 'manual_required';
  errorMessage: string | null;
};

export function buildDomSendScript(input: DomSendScriptInput): string {
  const prompt = JSON.stringify(input.prompt);
  const inputSelectors = JSON.stringify(input.inputSelectors);
  const submitSelectors = JSON.stringify(input.submitSelectors);

  return `
(() => {
  const prompt = ${prompt};
  const inputSelectors = ${inputSelectors};
  const submitSelectors = ${submitSelectors};

  const findFirst = (selectors) => {
    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }
    return null;
  };

  const input = findFirst(inputSelectors);
  if (!input) {
    return { status: 'manual_required', errorMessage: '未找到输入框' };
  }

  input.focus();

  if ('value' in input) {
    input.value = prompt;
  } else {
    input.textContent = prompt;
  }

  input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: prompt }));
  input.dispatchEvent(new Event('change', { bubbles: true }));

  const submit = findFirst(submitSelectors);
  if (!submit) {
    return { status: 'manual_required', errorMessage: '未找到发送按钮' };
  }

  submit.click();
  return { status: 'sent', errorMessage: null };
})();
`;
}
```

- [ ] **Step 4: Run script tests**

Run:

```bash
npm test -- tests/shared/domScript.test.ts
```

Expected: PASS for 2 tests.

- [ ] **Step 5: Commit script builder**

```bash
git add src/shared/domScript.ts tests/shared/domScript.test.ts
git commit -m "feat: add dom send script builder"
```

## Task 4: Renderer WebView App

**Files:**
- Create: `src/renderer/webviewTypes.ts`
- Create: `src/renderer/app.ts`
- Modify: `src/renderer/main.ts`
- Modify: `src/renderer/styles.css`
- Create: `tests/renderer/app.test.ts`

- [ ] **Step 1: Write failing renderer tests**

`tests/renderer/app.test.ts`

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../src/renderer/app';
import { SERVICE_IDS } from '../../src/shared/services';

describe('renderer app', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="app"></div>';
  });

  it('renders prompt input, send button, 9 toggles, and 9 webviews', () => {
    createApp(document.querySelector<HTMLDivElement>('#app') as HTMLDivElement);

    expect(document.querySelector('[data-testid="prompt-input"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="send-button"]')?.textContent).toBe('发送到已选');
    expect(document.querySelectorAll('[data-testid="service-toggle"]')).toHaveLength(9);
    expect(document.querySelectorAll('webview')).toHaveLength(9);
  });

  it('sets persistent partition and src on every webview', () => {
    createApp(document.querySelector<HTMLDivElement>('#app') as HTMLDivElement);

    const webviews = Array.from(document.querySelectorAll('webview'));
    expect(webviews.map((node) => node.getAttribute('partition'))).toEqual([
      'persist:chatgpt',
      'persist:deepseek',
      'persist:grok',
      'persist:doubao',
      'persist:gemini',
      'persist:yuanbao',
      'persist:qwen',
      'persist:zhipu',
      'persist:perplexity'
    ]);
    expect(webviews[3].getAttribute('src')).toBe('https://www.doubao.com/chat/');
  });

  it('sends only to selected webviews', async () => {
    createApp(document.querySelector<HTMLDivElement>('#app') as HTMLDivElement);

    for (const id of SERVICE_IDS) {
      const webview = document.querySelector(`[data-webview-service-id="${id}"]`) as unknown as {
        executeJavaScript: ReturnType<typeof vi.fn>;
      };
      webview.executeJavaScript = vi.fn().mockResolvedValue({ status: 'sent', errorMessage: null });
    }

    const input = document.querySelector<HTMLInputElement>('[data-testid="prompt-input"]') as HTMLInputElement;
    input.value = '解释一下 Electron webview';
    input.dispatchEvent(new Event('input', { bubbles: true }));

    const chatgptToggle = document.querySelector<HTMLInputElement>('[data-service-id="chatgpt"]') as HTMLInputElement;
    chatgptToggle.checked = false;
    chatgptToggle.dispatchEvent(new Event('change', { bubbles: true }));

    const button = document.querySelector<HTMLButtonElement>('[data-testid="send-button"]') as HTMLButtonElement;
    button.click();
    await Promise.resolve();
    await Promise.resolve();

    const chatgpt = document.querySelector('[data-webview-service-id="chatgpt"]') as unknown as {
      executeJavaScript: ReturnType<typeof vi.fn>;
    };
    const grok = document.querySelector('[data-webview-service-id="grok"]') as unknown as {
      executeJavaScript: ReturnType<typeof vi.fn>;
    };

    expect(chatgpt.executeJavaScript).not.toHaveBeenCalled();
    expect(grok.executeJavaScript).toHaveBeenCalledTimes(1);
  });

  it('shows an error for empty prompts', async () => {
    createApp(document.querySelector<HTMLDivElement>('#app') as HTMLDivElement);

    const button = document.querySelector<HTMLButtonElement>('[data-testid="send-button"]') as HTMLButtonElement;
    button.click();
    await Promise.resolve();

    expect(document.querySelector('[data-testid="top-error"]')?.textContent).toBe('请输入问题');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/renderer/app.test.ts
```

Expected: FAIL with an import error for `src/renderer/app`.

- [ ] **Step 3: Add webview element type**

`src/renderer/webviewTypes.ts`

```ts
export type ElectronWebViewElement = HTMLElement & {
  executeJavaScript(code: string, userGesture?: boolean): Promise<unknown>;
  reload(): void;
};
```

- [ ] **Step 4: Implement renderer app**

`src/renderer/app.ts`

```ts
import { buildDomSendScript, type DomSendScriptResult } from '../shared/domScript';
import { getService, services, type ServiceId } from '../shared/services';
import { createInitialPaneState, statusLabels, type PaneState } from '../shared/status';
import type { ElectronWebViewElement } from './webviewTypes';

type AppState = {
  prompt: string;
  topError: string | null;
  enlargedServiceId: ServiceId | null;
  panes: Record<ServiceId, PaneState>;
};

const inputSelectors = ['textarea', '[contenteditable="true"]', 'div[role="textbox"]'];
const submitSelectors = [
  'button[type="submit"]',
  'button[aria-label*="Send"]',
  'button[aria-label*="发送"]',
  'button[data-testid*="send"]'
];

export function createApp(root: HTMLDivElement): void {
  const state: AppState = {
    prompt: '',
    topError: null,
    enlargedServiceId: null,
    panes: Object.fromEntries(services.map((service) => [service.id, createInitialPaneState()])) as Record<ServiceId, PaneState>
  };

  root.innerHTML = '';
  root.append(createShell(state));
}

function createShell(state: AppState): HTMLElement {
  const shell = document.createElement('main');
  shell.className = 'app-shell';

  const topBar = createTopBar(state);
  const grid = document.createElement('section');
  grid.className = 'pane-grid';
  grid.dataset.testid = 'pane-grid';

  for (const service of services) {
    grid.append(createPane(service.id, state, grid));
  }

  shell.append(topBar, grid);
  return shell;
}

function createTopBar(state: AppState): HTMLElement {
  const topBar = document.createElement('section');
  topBar.className = 'top-bar';

  const input = document.createElement('input');
  input.className = 'prompt-input';
  input.dataset.testid = 'prompt-input';
  input.placeholder = '输入问题，一键发送到已选服务';
  input.value = state.prompt;
  input.addEventListener('input', () => {
    state.prompt = input.value;
    state.topError = null;
    updateTopError(state);
  });

  const toggles = document.createElement('div');
  toggles.className = 'service-toggles';
  for (const service of services) {
    const label = document.createElement('label');
    label.className = 'service-toggle';
    label.style.setProperty('--accent', service.accent);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = state.panes[service.id].selected;
    checkbox.dataset.testid = 'service-toggle';
    checkbox.dataset.serviceId = service.id;
    checkbox.addEventListener('change', () => {
      state.panes[service.id] = {
        ...state.panes[service.id],
        selected: checkbox.checked,
        status: checkbox.checked ? 'ready' : 'disabled',
        errorMessage: null
      };
      updatePaneHeader(service.id, state);
    });

    const dot = document.createElement('span');
    dot.className = 'toggle-dot';

    const name = document.createElement('span');
    name.textContent = service.name;

    label.append(checkbox, dot, name);
    toggles.append(label);
  }

  const sendButton = document.createElement('button');
  sendButton.type = 'button';
  sendButton.className = 'send-button';
  sendButton.dataset.testid = 'send-button';
  sendButton.textContent = '发送到已选';
  sendButton.addEventListener('click', () => {
    void sendToSelected(state);
  });

  const error = document.createElement('p');
  error.className = 'top-error';
  error.dataset.testid = 'top-error';
  error.textContent = state.topError ?? '';

  topBar.append(input, toggles, sendButton, error);
  return topBar;
}

function createPane(serviceId: ServiceId, state: AppState, grid: HTMLElement): HTMLElement {
  const service = getService(serviceId);

  const pane = document.createElement('article');
  pane.className = 'pane-card';
  pane.dataset.serviceId = serviceId;

  const paneState = state.panes[serviceId];
  const header = document.createElement('header');
  header.className = 'pane-header';
  header.addEventListener('dblclick', () => {
    state.enlargedServiceId = state.enlargedServiceId === serviceId ? null : serviceId;
    updateGridExpansion(grid, state);
  });

  const name = document.createElement('strong');
  name.textContent = service.name;

  const status = document.createElement('span');
  status.className = `status-dot status-${paneState.status}`;
  status.title = statusLabels[paneState.status];
  status.dataset.statusFor = serviceId;

  const enabled = document.createElement('span');
  enabled.className = 'pane-enabled';
  enabled.textContent = paneState.selected ? '开' : '关';
  enabled.dataset.enabledFor = serviceId;

  const error = document.createElement('span');
  error.className = 'pane-error';
  error.textContent = paneState.errorMessage ?? '';
  error.dataset.errorFor = serviceId;

  header.append(name, status, enabled, error);

  const webview = document.createElement('webview');
  webview.className = 'service-webview';
  webview.setAttribute('src', service.url);
  webview.setAttribute('partition', service.partition);
  webview.dataset.webviewServiceId = service.id;

  webview.addEventListener('dom-ready', () => {
    if (state.panes[serviceId].status === 'loading') {
      state.panes[serviceId] = {
        ...state.panes[serviceId],
        status: 'ready',
        errorMessage: null
      };
      updatePaneHeader(serviceId, state);
    }
  });

  webview.addEventListener('did-fail-load', () => {
    state.panes[serviceId] = {
      ...state.panes[serviceId],
      status: 'error',
      errorMessage: '页面加载失败'
    };
    updatePaneHeader(serviceId, state);
  });

  pane.append(header, webview);
  return pane;
}

function updateTopError(state: AppState): void {
  const error = document.querySelector('[data-testid="top-error"]');
  if (error) {
    error.textContent = state.topError ?? '';
  }
}

function updatePaneHeader(serviceId: ServiceId, state: AppState): void {
  const paneState = state.panes[serviceId];
  const status = document.querySelector<HTMLElement>(`[data-status-for="${serviceId}"]`);
  const enabled = document.querySelector<HTMLElement>(`[data-enabled-for="${serviceId}"]`);
  const error = document.querySelector<HTMLElement>(`[data-error-for="${serviceId}"]`);

  if (status) {
    status.className = `status-dot status-${paneState.status}`;
    status.title = statusLabels[paneState.status];
  }
  if (enabled) {
    enabled.textContent = paneState.selected ? '开' : '关';
  }
  if (error) {
    error.textContent = paneState.errorMessage ?? '';
  }
}

function updateGridExpansion(grid: HTMLElement, state: AppState): void {
  grid.classList.toggle('pane-grid-enlarged', state.enlargedServiceId !== null);
  for (const service of services) {
    const pane = grid.querySelector<HTMLElement>(`[data-service-id="${service.id}"]`);
    if (pane) {
      pane.hidden = Boolean(state.enlargedServiceId && state.enlargedServiceId !== service.id);
    }
  }
}

async function sendToSelected(state: AppState): Promise<void> {
  const prompt = state.prompt.trim();
  if (!prompt) {
    state.topError = '请输入问题';
    updateTopError(state);
    return;
  }

  state.topError = null;
  updateTopError(state);
  const selectedIds = services.map((service) => service.id).filter((id) => state.panes[id].selected);

  for (const serviceId of selectedIds) {
    state.panes[serviceId] = {
      ...state.panes[serviceId],
      status: 'sending',
      errorMessage: null
    };
    updatePaneHeader(serviceId, state);
  }

  await Promise.all(selectedIds.map(async (serviceId) => {
    const webview = document.querySelector(`[data-webview-service-id="${serviceId}"]`) as ElectronWebViewElement | null;
    if (!webview || typeof webview.executeJavaScript !== 'function') {
      state.panes[serviceId] = {
        ...state.panes[serviceId],
        status: 'manual_required',
        errorMessage: '服务视图未就绪'
      };
      updatePaneHeader(serviceId, state);
      return;
    }

    try {
      const script = buildDomSendScript({ prompt, inputSelectors, submitSelectors });
      const result = await webview.executeJavaScript(script, true) as DomSendScriptResult | null;
      state.panes[serviceId] = {
        ...state.panes[serviceId],
        status: result?.status ?? 'manual_required',
        errorMessage: result?.errorMessage ?? null
      };
      updatePaneHeader(serviceId, state);
    } catch (error) {
      state.panes[serviceId] = {
        ...state.panes[serviceId],
        status: 'error',
        errorMessage: error instanceof Error ? error.message : '发送失败'
      };
      updatePaneHeader(serviceId, state);
    }
  }));
}
```

- [ ] **Step 5: Wire renderer bootstrap**

`src/renderer/main.ts`

```ts
import './styles.css';
import { createApp } from './app';

const root = document.querySelector<HTMLDivElement>('#app');

if (!root) {
  throw new Error('Missing #app root element');
}

createApp(root);
```

- [ ] **Step 6: Replace styles**

`src/renderer/styles.css`

```css
:root {
  color-scheme: light;
  font-family:
    Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI",
    sans-serif;
  background: #f6f7f9;
  color: #15171c;
}

body {
  margin: 0;
  min-width: 1180px;
  min-height: 760px;
  overflow: hidden;
}

button,
input {
  font: inherit;
}

.app-shell {
  height: 100vh;
  display: grid;
  grid-template-rows: 88px minmax(0, 1fr);
}

.top-bar {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) auto auto;
  gap: 12px;
  align-items: center;
  padding: 12px 16px;
  box-sizing: border-box;
  background: #f6f7f9;
  border-bottom: 1px solid #d8dde6;
}

.prompt-input {
  height: 40px;
  border: 1px solid #cfd6e1;
  border-radius: 8px;
  padding: 0 12px;
  background: #ffffff;
}

.service-toggles {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  max-width: 560px;
}

.service-toggle {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 28px;
  padding: 0 8px;
  border: 1px solid #d7dde7;
  border-radius: 999px;
  background: #ffffff;
  color: #252936;
  font-size: 12px;
}

.service-toggle input {
  width: 14px;
  height: 14px;
}

.toggle-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent);
}

.send-button {
  height: 40px;
  border: 0;
  border-radius: 8px;
  padding: 0 16px;
  background: #1f6feb;
  color: #ffffff;
  cursor: pointer;
}

.top-error {
  grid-column: 1 / -1;
  margin: -6px 0 0;
  min-height: 16px;
  font-size: 12px;
  color: #b42318;
}

.pane-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  grid-template-rows: repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding: 8px;
  min-height: 0;
  box-sizing: border-box;
}

.pane-grid-enlarged {
  grid-template-columns: 1fr;
  grid-template-rows: 1fr;
}

.pane-card {
  display: grid;
  grid-template-rows: 32px minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  border: 1px solid rgba(15, 23, 42, 0.16);
  border-radius: 8px;
  background: #ffffff;
  overflow: hidden;
}

.pane-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.12);
  font-size: 12px;
  user-select: none;
}

.service-webview {
  width: 100%;
  height: 100%;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-loading,
.status-sending {
  background: #f59e0b;
}

.status-ready,
.status-sent {
  background: #16a34a;
}

.status-login_required,
.status-manual_required {
  background: #7c3aed;
}

.status-error {
  background: #dc2626;
}

.status-disabled {
  background: #9ca3af;
}

.pane-enabled,
.pane-error {
  color: #64748b;
}

.pane-error {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
```

- [ ] **Step 7: Run renderer tests**

Run:

```bash
npm test -- tests/renderer/app.test.ts
```

Expected: PASS for 4 tests.

- [ ] **Step 8: Run all tests and typecheck**

Run:

```bash
npm run typecheck
npm test
```

Expected: both commands exit with code 0.

- [ ] **Step 9: Commit renderer app**

```bash
git add src/renderer/webviewTypes.ts src/renderer/app.ts src/renderer/main.ts src/renderer/styles.css tests/renderer/app.test.ts
git commit -m "feat: add webview grid renderer"
```

## Task 5: Electron Main Process

**Files:**
- Create: `src/main/main.ts`
- Create: `src/preload/preload.ts`

- [ ] **Step 1: Create minimal preload**

`src/preload/preload.ts`

```ts
window.addEventListener('DOMContentLoaded', () => {
  document.documentElement.dataset.mutiSearchPreload = 'ready';
});
```

- [ ] **Step 2: Create secure Electron main process**

`src/main/main.ts`

```ts
import { BrowserWindow, app, shell } from 'electron';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = fileURLToPath(new URL('.', import.meta.url));

async function createWindow(): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1180,
    minHeight: 760,
    title: 'muti-search',
    webPreferences: {
      preload: join(dirname, '../preload/preload.js'),
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

  if (process.env.VITE_DEV_SERVER_URL) {
    await win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    await win.loadFile(join(dirname, '../renderer/index.html'));
  }

  return win;
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.whenReady().then(async () => {
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});
```

- [ ] **Step 3: Typecheck and build**

Run:

```bash
npm run typecheck
npm run build
```

Expected: both commands exit with code 0 and create `dist/main/main.js`, `dist/preload/preload.js`, and `dist/renderer`.

- [ ] **Step 4: Commit Electron main**

```bash
git add src/main/main.ts src/preload/preload.ts
git commit -m "feat: add electron main process"
```

## Task 6: Manual Verification

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Start the app**

Run:

```bash
npm run dev
```

Expected:

- Electron opens a desktop window.
- The top control bar is visible.
- 9 `<webview>` panes appear in a 3x3 grid.
- Each service begins loading in its own pane.

- [ ] **Step 2: Verify service sessions**

Manual checks:

- Log in to one service.
- Quit the app.
- Run `npm run dev` again.
- The service remains logged in because its `persist:<service>` partition is reused.

- [ ] **Step 3: Verify selected send behavior**

Manual checks:

- Type `请用一句话介绍你自己` in the top input.
- Disable at least one service toggle.
- Click `发送到已选`.
- Enabled services attempt to receive and submit the prompt.
- Disabled services do not receive the prompt.
- If a service cannot be automated, its pane status shows a short error message.

- [ ] **Step 4: Verify no version 1 exclusions were accidentally added**

Manual checks:

- No prompt history appears after reload.
- No answer extraction panel exists.
- No per-service session clearing UI exists.
- No keyboard shortcut help or global hotkey behavior exists.

- [ ] **Step 5: Document manual verification**

Append to `README.md`:

```md
## Manual Verification Checklist

1. Run `npm run dev`.
2. Confirm the 3x3 grid loads all selected official AI pages.
3. Confirm each service keeps its own login state across app restarts.
4. Confirm `发送到已选` only targets enabled services.
5. Confirm one failed service does not block the remaining services.
6. Confirm there is no prompt history, answer extraction panel, session-clearing UI, or keyboard shortcut layer in version 1.
```

- [ ] **Step 6: Run final verification**

Run:

```bash
npm run typecheck
npm test
npm run build
```

Expected: all commands exit with code 0.

- [ ] **Step 7: Commit verification docs**

```bash
git add README.md
git commit -m "docs: add manual verification checklist"
```

## Self-Review

### Spec Coverage

- 9 official web UIs: Task 2 service registry and Task 4 `<webview>` grid.
- 3x3 panoramic grid: Task 4 CSS grid.
- Independent persistent sessions: Task 2 `partition` values and Task 4 webview attributes.
- Main input, 9 toggles, send selected: Task 4 renderer UI.
- DOM automatic injection: Task 3 script builder and Task 4 `executeJavaScript`.
- Lightweight pane status: Task 2 state model and Task 4 pane header.
- No prompt/answer history: Task 4 keeps prompt in memory only; no storage API is used.
- No response extraction: no task reads answer content from service pages.
- No session cleanup UI: no task creates clearing controls.
- No keyboard shortcuts: no task registers keyboard handlers.
- Security baseline: Task 5 disables Node integration, enables context isolation and sandboxing, keeps web security enabled, and denies new window creation in the shell.

### Placeholder Scan

The plan contains concrete files, commands, and code snippets for every implementation step. Service-page fragility is represented with `manual_required` and `error` states instead of unspecified recovery work.

### Type Consistency

- `ServiceId` is defined in `src/shared/services.ts` and reused in status records and renderer webview selection.
- `PaneStatus` and `PaneState` are defined in `src/shared/status.ts` and used by renderer state.
- `DomSendScriptResult` is defined in `src/shared/domScript.ts` and used by renderer send handling.
