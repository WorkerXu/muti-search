---
change: replace-view-modes-with-product-tabs
design-doc: docs/superpowers/specs/2026-06-23-product-tabs-navigation-design.md
base-ref: 7e39eb2341c496959c7b7291a966956e42293b7f
---

# 搜索/代码产品 Tab 导航 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将顶部“分屏 / 单站”展示方式替换为“搜索 / 代码”产品级 Tab，默认进入“搜索”Tab，并让搜索工作流固定使用现有单站大页面布局，代码工作流仅显示本地占位区。

**Architecture:** `src/renderer/app.ts` 继续保留单一 `createApp()` 入口，但把原本面向布局的 `ViewMode` 状态替换为面向产品语义的 `ProductTab` 状态。渲染层新增 `search-workflow` 与 `code-workflow` 两个主容器，其中搜索工作流复用现有 pane/sidebar/webview 运行时，代码工作流只渲染本地占位 DOM，不新增任何远程 WebView 或服务配置。

**Tech Stack:** TypeScript、Electron renderer、原生 DOM API、CSS、Vitest、npm scripts（`typecheck` / `test` / `build` / `dev`）

## Global Constraints

- 顶部展示产品级 Tab：“搜索 / 代码”。
- 默认进入“搜索”Tab。
- “搜索”Tab 内部使用左侧服务菜单 + 右侧单个大 WebView。
- 顶部继续保留问题输入、发送到已选、导出 MD、设置和运行标识。
- “代码”Tab 在本 change 中只显示本地占位区，不加载远程代码站点。
- 移除旧“分屏 / 单站”按钮和用户可见分屏总览入口。
- 顶层用 `data-product-tab="search|code"` 表达当前产品 Tab，替代旧 `data-view-mode="grid|single"`。
- 服务选择 toggle 仍决定“发送到已选”的目标。
- 服务开启/关闭状态继续影响 WebView 可见性与发送行为。
- 左侧服务菜单用于切换右侧大 WebView。
- 发送成功后继续显示导出按钮。
- 导出仍使用现有 Markdown 导出链路。
- 设置弹层继续展示运行数据路径，只读模式不变。
- 不创建 Zread、DeepWiki、CodeWiki WebView。

---

## 文件结构

- `src/renderer/app.ts`
  - 负责产品 Tab 状态、顶部按钮、搜索/代码工作流容器、pane 运行时与事件绑定。
  - 本次只在现有文件内调整状态模型和 DOM 结构，不拆新模块。
- `src/renderer/styles.css`
  - 负责顶部 Tab 样式、搜索工作流双栏布局、代码占位区样式、旧 `data-view-mode` 相关 selector 清理。
- `tests/renderer/app.test.ts`
  - 负责 renderer DOM 行为回归：默认 Tab、Tab 切换、旧按钮移除、搜索控件可用、WebView 数量不变。
- `README.md`
  - 负责产品说明、开发验证步骤与人工验收文案更新，避免继续描述“3x3 grid / 分屏模式”。
- `docs/superpowers/specs/2026-06-23-product-tabs-navigation-design.md`
  - 作为实现约束来源，本次实现以该设计文档为准，不在本 change 中另起方案。

## 任务拆分

### Task 1: 建立产品 Tab 外壳并替换旧展示方式开关

**Files:**
- Modify: `tests/renderer/app.test.ts`
- Modify: `src/renderer/app.ts`

**Interfaces:**
- Consumes: `createApp(root: HTMLDivElement): void`
- Produces: `type ProductTab = 'search' | 'code'`、`[data-testid="product-tab-search"]`、`[data-testid="product-tab-code"]`、`[data-testid="search-workflow"]`、`[data-testid="code-workflow"]`

- [x] **Step 1: 新增默认进入搜索 Tab 的失败测试**

```ts
it('defaults to the search product tab and hides the legacy view mode switch', () => {
  const root = document.querySelector('#app') as HTMLDivElement;

  createApp(root);

  const appBody = root.querySelector('[data-testid="app-body"]') as HTMLElement;
  const searchTab = root.querySelector('[data-testid="product-tab-search"]') as HTMLButtonElement;
  const codeTab = root.querySelector('[data-testid="product-tab-code"]') as HTMLButtonElement;

  expect(appBody.getAttribute('data-product-tab')).toBe('search');
  expect(searchTab.getAttribute('aria-pressed')).toBe('true');
  expect(codeTab.getAttribute('aria-pressed')).toBe('false');
  expect(root.querySelector('[data-testid="view-mode-grid"]')).toBeNull();
  expect(root.querySelector('[data-testid="view-mode-single"]')).toBeNull();
  expect(root.querySelector('[data-testid="search-workflow"]')).not.toBeNull();
  expect(root.querySelector('[data-testid="code-workflow"]')).not.toBeNull();
});
```

Run: 不执行，先继续补齐同一行为切片的第二个测试。  
Expected: 当前文件还未改动，下一步统一运行时会因为缺少 `product-tab-*` selector 和 `data-product-tab` 失败。

- [x] **Step 2: 新增搜索/代码 Tab 切换且不新增 WebView 的失败测试**

```ts
it('switches between search and code tabs without creating extra webviews', () => {
  const root = document.querySelector('#app') as HTMLDivElement;

  createApp(root);

  const originalWebviews = Array.from(root.querySelectorAll('webview'));
  const appBody = root.querySelector('[data-testid="app-body"]') as HTMLElement;
  const searchTab = root.querySelector('[data-testid="product-tab-search"]') as HTMLButtonElement;
  const codeTab = root.querySelector('[data-testid="product-tab-code"]') as HTMLButtonElement;
  const codeWorkflow = root.querySelector('[data-testid="code-workflow"]') as HTMLElement;

  codeTab.click();

  expect(appBody.getAttribute('data-product-tab')).toBe('code');
  expect(searchTab.getAttribute('aria-pressed')).toBe('false');
  expect(codeTab.getAttribute('aria-pressed')).toBe('true');
  expect(codeWorkflow.textContent).toContain('代码工作流');
  expect(Array.from(root.querySelectorAll('webview'))).toEqual(originalWebviews);

  searchTab.click();

  expect(appBody.getAttribute('data-product-tab')).toBe('search');
  expect(searchTab.getAttribute('aria-pressed')).toBe('true');
});
```

Run: `npm test -- tests/renderer/app.test.ts -t "product tab"`  
Expected: `FAIL tests/renderer/app.test.ts`，报错集中在 `product-tab-search` / `product-tab-code` / `data-product-tab` 尚不存在。

- [x] **Step 3: 在 renderer 状态中用 `ProductTab` 替换 `ViewMode`**

```ts
type ProductTab = 'search' | 'code';

export function createApp(root: HTMLDivElement): void {
  root.innerHTML = '';

  let productTab: ProductTab = 'search';
  let activePaneId: ServiceId = services[0].id;
  let expandedPaneId: ServiceId | null = null;
  let lastPrompt: string | null = null;
  let lastTargetIds = new Set<ServiceId>();
  const panes = new Map<ServiceId, PaneRuntime>();
```

Run: 不执行，继续完成同一任务内的 DOM 替换。  
Expected: `app.ts` 中不再声明 `type ViewMode = 'grid' | 'single'`，默认状态从 `grid` 改为 `search`。

- [x] **Step 4: 将顶部旧“分屏 / 单站”按钮替换为产品 Tab 按钮**

```ts
const productTabSwitch = document.createElement('div');
productTabSwitch.className = 'product-tab-switch';
productTabSwitch.setAttribute('aria-label', '产品工作流');
topBar.append(productTabSwitch);

const searchTabButton = document.createElement('button');
searchTabButton.className = 'product-tab-button';
searchTabButton.dataset.testid = 'product-tab-search';
searchTabButton.textContent = '搜索';
productTabSwitch.append(searchTabButton);

const codeTabButton = document.createElement('button');
codeTabButton.className = 'product-tab-button';
codeTabButton.dataset.testid = 'product-tab-code';
codeTabButton.textContent = '代码';
productTabSwitch.append(codeTabButton);
```

Run: 不执行，继续把主体工作流容器补齐。  
Expected: 顶部不再创建 `view-mode-switch`、`view-mode-grid`、`view-mode-single` 相关 DOM。

- [x] **Step 5: 新增搜索/代码工作流容器并在 `renderApp()` 中切换**

```ts
const appBody = document.createElement('section');
appBody.className = 'app-body';
appBody.dataset.testid = 'app-body';
shell.append(appBody);

const searchWorkflow = document.createElement('section');
searchWorkflow.className = 'search-workflow';
searchWorkflow.dataset.testid = 'search-workflow';
appBody.append(searchWorkflow);

const sidebar = document.createElement('aside');
sidebar.className = 'service-sidebar';
sidebar.dataset.testid = 'service-sidebar';
searchWorkflow.append(sidebar);

const grid = document.createElement('section');
grid.className = 'pane-grid';
searchWorkflow.append(grid);

const codeWorkflow = document.createElement('section');
codeWorkflow.className = 'code-workflow';
codeWorkflow.dataset.testid = 'code-workflow';
appBody.append(codeWorkflow);

const codePlaceholder = document.createElement('div');
codePlaceholder.className = 'code-workflow-placeholder';
codePlaceholder.innerHTML = `
  <h2>代码工作流</h2>
  <p>本版本仅提供本地占位区，暂不加载远程代码站点。</p>
`;
codeWorkflow.append(codePlaceholder);

const renderApp = () => {
  shell.dataset.productTab = productTab;
  appBody.dataset.productTab = productTab;
  searchWorkflow.hidden = productTab !== 'search';
  codeWorkflow.hidden = productTab !== 'code';
  searchTabButton.setAttribute('aria-pressed', String(productTab === 'search'));
  codeTabButton.setAttribute('aria-pressed', String(productTab === 'code'));
  for (const pane of panes.values()) {
    renderPane(pane, expandedPaneId, activePaneId);
  }
};

searchTabButton.addEventListener('click', () => {
  productTab = 'search';
  renderApp();
});

codeTabButton.addEventListener('click', () => {
  productTab = 'code';
  expandedPaneId = null;
  renderApp();
});
```

Run: `npm test -- tests/renderer/app.test.ts -t "product tab"`  
Expected: 两个新测试通过，且断言确认代码工作流只渲染本地占位文本，没有新增 `webview`。

- [x] **Step 6: 提交这一条垂直切片**

```bash
git add tests/renderer/app.test.ts src/renderer/app.ts
git commit -m "feat: replace view mode switch with product tabs"
```

Run: `git status --short`  
Expected: 提交后工作区不再包含本任务改动；若后续任务继续修改同文件，则只剩下一组新的未提交变更。

### Task 2: 固定搜索工作流为单站布局并保留现有交互

**Files:**
- Modify: `tests/renderer/app.test.ts`
- Modify: `src/renderer/app.ts`

**Interfaces:**
- Consumes: `ProductTab`、`renderPane(pane, expandedPaneId, activePaneId)`、`[data-testid="service-sidebar"]`
- Produces: `data-layout="single-active|single-hidden|expanded|collapsed"`、搜索 Tab 下持续可用的 `send/export/settings/sidebar` 行为

- [x] **Step 1: 把旧 grid/single 测试替换成搜索工作流回归测试**

```ts
it('keeps the search workflow in single-pane mode and reuses existing webviews', () => {
  const root = document.querySelector('#app') as HTMLDivElement;

  createApp(root);

  const originalWebviews = Array.from(root.querySelectorAll('webview'));
  const chatgptPane = root.querySelector('[data-pane-id="chatgpt"]') as HTMLElement;
  const deepseekPane = root.querySelector('[data-pane-id="deepseek"]') as HTMLElement;

  expect(root.querySelector('[data-testid="service-sidebar"]')).not.toBeNull();
  expect(chatgptPane.getAttribute('data-layout')).toBe('single-active');
  expect(deepseekPane.getAttribute('data-layout')).toBe('single-hidden');
  expect(root.querySelector('[data-testid="view-mode-grid"]')).toBeNull();
  expect(root.querySelector('[data-testid="view-mode-single"]')).toBeNull();
  expect(Array.from(root.querySelectorAll('webview'))).toEqual(originalWebviews);
});
```

Run: 不执行，先把依赖旧单站按钮的测试一并改掉。  
Expected: 现有测试文件里不再依赖点击 `view-mode-single` 才进入侧边栏布局。

- [x] **Step 2: 更新侧边栏切站测试，直接在默认搜索 Tab 上断言**

```ts
it('selects the active large site from the sidebar and keeps sidebar state in sync', () => {
  const root = document.querySelector('#app') as HTMLDivElement;

  createApp(root);

  const geminiRow = root.querySelector('[data-sidebar-service="gemini"]') as HTMLButtonElement;
  geminiRow.click();

  expect(geminiRow.getAttribute('aria-current')).toBe('true');
  expect(root.querySelector('[data-pane-id="gemini"]')?.getAttribute('data-layout')).toBe(
    'single-active'
  );
  expect(root.querySelector('[data-pane-id="chatgpt"]')?.getAttribute('data-layout')).toBe(
    'single-hidden'
  );
});
```

Run: `npm test -- tests/renderer/app.test.ts -t "single-pane mode|active large site"`  
Expected: `FAIL tests/renderer/app.test.ts`，至少一处仍会因为 `renderPane()` 还保留 `viewMode` 分支、默认布局仍是 `grid` 而失败。

- [x] **Step 3: 简化 `renderPane()`，删除 grid 路径并固定为搜索单站布局**

```ts
function renderPane(
  pane: PaneRuntime,
  expandedPaneId: ServiceId | null,
  activePaneId: ServiceId
): void {
  const layout =
    expandedPaneId === null
      ? activePaneId === pane.service.id
        ? 'single-active'
        : 'single-hidden'
      : expandedPaneId === pane.service.id
        ? 'expanded'
        : 'collapsed';

  pane.article.dataset.layout = layout;
  pane.article.dataset.enabled = String(pane.state.enabled);
  pane.article.dataset.status = pane.state.status;
  pane.enabledToggle.checked = pane.state.enabled;
  pane.sidebarEnabledToggle.checked = pane.state.enabled;
  pane.selectedToggle.checked = pane.state.selected;
  pane.sidebarButton.setAttribute('aria-current', String(activePaneId === pane.service.id));
}
```

Run: 不执行，继续把所有回调签名收口到新的 `renderPane()`。  
Expected: `renderPane()` 不再接收 `viewMode`，也不会再返回 `data-layout="grid"`。

- [x] **Step 4: 更新发送、回主页和初始化回调，全部切到新的 `renderPane()` 签名**

```ts
navigatePaneHome(pane, () => renderPane(pane, expandedPaneId, activePaneId));

sendButton.addEventListener('click', () => {
  void sendPrompt({
    prompt: promptInput.value,
    panes,
    setTopError: (message) => setTopError(topError, message),
    renderPane: (pane) => renderPane(pane, expandedPaneId, activePaneId)
  }).then((targetIds) => {
    if (targetIds.length === 0) {
      return;
    }

    lastPrompt = promptInput.value.trim();
    lastTargetIds = new Set(targetIds);
    exportButton.hidden = false;
  });
});

renderPane(pane, expandedPaneId, activePaneId);
```

Run: `npm test -- tests/renderer/app.test.ts`  
Expected: renderer 单测全绿，尤其是发送、导出、侧边栏启停、回主页、物理输入回退等既有行为继续通过。

- [x] **Step 5: 提交搜索工作流承接改动**

```bash
git add tests/renderer/app.test.ts src/renderer/app.ts
git commit -m "refactor: make search workflow the default pane layout"
```

Run: `git status --short`  
Expected: 第二个任务提交完成；下一任务开始前只会出现样式和文档相关的新改动。

### Task 3: 更新样式与 README，使 UI 和文案都切换到产品 Tab 语义

**Files:**
- Modify: `src/renderer/styles.css`
- Modify: `README.md`

**Interfaces:**
- Consumes: `.product-tab-switch`、`.product-tab-button`、`[data-product-tab]`、`.search-workflow`、`.code-workflow`
- Produces: 产品 Tab 样式、默认搜索双栏布局、代码占位卡片样式、README 新产品说明与人工验收步骤

- [ ] **Step 1: 用产品 Tab selector 替换旧 `view-mode` 样式入口**

```css
.top-bar {
  display: grid;
  grid-template-columns: minmax(280px, 1.2fr) minmax(0, 2fr) auto auto auto auto auto;
  gap: 12px;
  align-items: center;
}

.product-tab-switch {
  height: 42px;
  display: inline-grid;
  grid-template-columns: repeat(2, minmax(58px, 1fr));
  align-items: center;
  padding: 3px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
}

.product-tab-button {
  height: 34px;
  padding: 0 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #374151;
  cursor: pointer;
}

.product-tab-button[aria-pressed='true'] {
  background: #eff6ff;
  color: #1d4ed8;
  font-weight: 600;
}
```

Run: 不执行，继续补齐主体布局 selector。  
Expected: `styles.css` 中不再保留 `.view-mode-switch`、`.view-mode-button`、`.app-shell[data-view-mode=...]` 这组入口样式。

- [ ] **Step 2: 固定搜索工作流为侧边栏 + 单 WebView，并增加代码占位区样式**

```css
.app-body {
  min-height: 0;
  display: grid;
}

.search-workflow {
  min-height: 0;
  display: grid;
  grid-template-columns: 268px minmax(0, 1fr);
  gap: 12px;
}

.service-sidebar {
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 10px;
  padding: 12px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
}

.pane-grid {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
}

.code-workflow {
  min-height: 0;
  display: grid;
}

.code-workflow-placeholder {
  min-height: calc(100vh - 172px);
  display: grid;
  align-content: center;
  gap: 10px;
  padding: 32px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  background: #fff;
}

.code-workflow-placeholder h2,
.code-workflow-placeholder p {
  margin: 0;
}
```

Run: 不执行，继续删除不再可达的旧分屏 selector。  
Expected: 搜索布局不再依赖 `.app-body[data-view-mode='single']` 才显示侧边栏，`pane-grid` 也不再声明 3 列分屏。

- [ ] **Step 3: 清理响应式分屏遗留样式并保留移动端可用性**

```css
@media (max-width: 1400px) {
  .top-bar {
    grid-template-columns: minmax(280px, 1fr);
  }
}

@media (max-width: 1024px) {
  .search-workflow {
    grid-template-columns: 1fr;
  }

  .service-sidebar {
    order: 2;
  }

  .pane-grid {
    order: 1;
  }
}
```

Run: `npm test -- tests/renderer/app.test.ts`  
Expected: 单测继续通过，说明 CSS selector 清理没有反向破坏 DOM 结构依赖。

- [ ] **Step 4: 更新 README 产品描述与人工验收步骤**

```md
# muti-search

Local Electron desktop shell for switching between a search workflow and a code workflow while sending one manually entered prompt to selected official AI services.

## Manual Verification Checklist

1. Run `npm run dev`.
2. Confirm the app defaults to the `搜索` tab and shows the service sidebar plus one large active site.
3. Confirm switching to the `代码` tab shows only the local placeholder area and does not create extra remote webviews.
4. Confirm `发送到已选` only targets enabled and selected services.
5. Confirm one failed service does not block the remaining services.
6. Confirm double-clicking a pane/header can enlarge and collapse the active site.
7. Confirm there is no grid/split toggle, prompt history, answer extraction panel, session-clearing UI, or keyboard shortcut layer in version 1.
```

Run: `npm run build`  
Expected: `vite build` 和 `tsc -p tsconfig.node.json` 成功，README 改动不影响构建；后续人工验证文案与新 UI 语义一致。

- [ ] **Step 5: 提交样式与文档调整**

```bash
git add src/renderer/styles.css README.md
git commit -m "docs: update product tab navigation guidance"
```

Run: `git status --short`  
Expected: 样式与文档变更独立成一笔提交，方便回滚和 review。

### Task 4: 做全量验证并记录预期通过结果

**Files:**
- Modify: 无
- Verify: `src/renderer/app.ts`
- Verify: `src/renderer/styles.css`
- Verify: `tests/renderer/app.test.ts`
- Verify: `README.md`

**Interfaces:**
- Consumes: 前三项任务产出的 renderer DOM contract、CSS selector、README 验收步骤
- Produces: 可交付的验证证据：类型检查、单测、构建、人工验证 checklist

- [ ] **Step 1: 跑类型检查**

```bash
npm run typecheck
```

Expected: 命令退出码为 `0`，`src/renderer/app.ts` 中不再出现 `ViewMode` 相关类型错误或回调签名不匹配。

- [ ] **Step 2: 跑完整测试套件**

```bash
npm test
```

Expected: `vitest run` 全绿，新增产品 Tab 测试通过，现有发送/导出/错误/物理输入回退测试无回归。

- [ ] **Step 3: 跑生产构建**

```bash
npm run build
```

Expected: `build:main` 与 `vite build` 都成功，renderer DOM 与样式改动可以进入打包产物。

- [ ] **Step 4: 依据 README 做一次人工冒烟**

```bash
npm run dev
```

Expected: Vite 启动在 `http://127.0.0.1:5173`，Electron 窗口打开后默认显示“搜索”Tab；切到“代码”Tab 仅出现本地占位区；返回“搜索”Tab 后侧边栏、单 WebView、发送、导出、设置全部可见。

- [ ] **Step 5: 提交验证结论**

```bash
git status --short
```

Expected: 若前述步骤没有产生额外文件，工作区应为空；如有构建缓存或临时文件，清理后再进入合并/评审流程。
