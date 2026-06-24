# optimize-webview-lifecycle 验证报告

## 结论

验证通过。`optimize-webview-lifecycle` 的 19 个任务全部完成，OpenSpec delta spec、OpenSpec 设计、Superpowers 设计文档与实现保持一致。未发现 CRITICAL 或 IMPORTANT 问题。

## 检查摘要

| 维度 | 状态 | 证据 |
| --- | --- | --- |
| 完整性 | 通过 | `openspec instructions apply --change optimize-webview-lifecycle --json` 显示 19/19 tasks complete |
| 正确性 | 通过 | 生命周期状态、按需加载、释放保护、代码历史导出均有实现和测试覆盖 |
| 一致性 | 通过 | `openspec/changes/optimize-webview-lifecycle/design.md` 与 `docs/superpowers/specs/2026-06-24-webview-lifecycle-design.md` 的设计决策已落到 renderer/shared/styles/tests |
| 构建 | 通过 | `npm run typecheck` exit 0；`npm run build` exit 0 |
| 测试 | 通过 | `npm test`：7 个测试文件、95 条测试全部通过 |
| 安全 | 通过 | 硬编码密钥扫描未发现新增凭据；`token` 命中均为既有剪贴板恢复流程或测试文本 |

## 需求覆盖

### WebView 按需加载

- 实现证据：
  - `src/shared/status.ts` 新增 `unloaded` 初始状态。
  - `src/renderer/app.ts` 启动时不再对每个搜索 WebView 设置 `src`。
  - `startSearchPaneNavigation()` 只在查看、放大或搜索 Tab 当前页需要时加载。
- 测试证据：
  - `tests/renderer/app.test.ts` 中 `sets persistent partition but only navigates the visible search webview at startup` 覆盖启动懒导航。

### 必需 WebView 使用前加载

- 实现证据：
  - 搜索发送路径 `navigatePaneHomeForSend()` 在执行发送脚本前设置 `partition` 和 `src`，并等待 ready。
  - 代码工作流 `ensureCodePanesLoaded()` 在打开仓库、切回代码 Tab、发送代码问题前恢复站点页面。
- 测试证据：
  - 现有搜索发送测试验证已选服务调用 `loadURL()`，未选或禁用服务不加载。
  - 代码仓库和代码问答测试验证有效仓库后加载三个代码站点。

### 非活跃 WebView 可以释放

- 实现证据：
  - `releaseSearchPanes()` 在切到代码 Tab 时释放非发送中的搜索 WebView。
  - `releaseCodePanes()` 在切回搜索 Tab 时释放非问答中的代码 WebView。
  - `releaseWebview()` 清理 `src` 并尝试导航 `about:blank`，不修改 persistent partition。
- 测试证据：
  - `switches between search and code tabs while releasing the inactive workflow` 覆盖搜索工作流释放和恢复。

### 待处理发送不会被打断

- 实现证据：
  - 搜索 pane 使用 `isSendPending` 和既有 `sendGeneration` 保护发送过程。
  - 代码 pane 使用 `inFlightCount` 跳过正在发送或抽取回答的 WebView。
- 测试证据：
  - 既有“旧发送晚返回不覆盖新发送状态”测试继续通过。
  - 代码问答超时、生成中和多轮追问测试继续通过。

### 本地状态在 WebView 释放后保留

- 实现证据：
  - 代码问答导出继续基于 renderer 本地 `codeRounds`，不依赖已释放 WebView。
- 测试证据：
  - 代码导出测试在释放三个代码 WebView 后重新进入代码 Tab，仍能导出当前仓库历史。

## 执行命令

```bash
npm run typecheck
npm test
npm run build
rg -n "api[_-]?key|secret|token|password|PRIVATE|BEGIN RSA|BEGIN OPENSSH|sk-[A-Za-z0-9]" src tests docs openspec
```

结果：

- `npm run typecheck`：通过。
- `npm test`：通过，7 个测试文件、95 条测试。
- `npm run build`：通过。
- 安全扫描：无新增硬编码凭据。

## 问题记录

### CRITICAL

无。

### WARNING

无。

### SUGGESTION

无。

## 备注

- `.codex/` 仍是未跟踪目录，和本 change 无关，未纳入提交。
- 本 change 没有替换 Electron `<webview>` 技术栈，也没有清理用户 session 数据。
