# replace-view-modes-with-product-tabs 验证报告

## 摘要

| 维度 | 结果 |
| --- | --- |
| 完整性 | 14/14 OpenSpec tasks 已完成；1 个 delta capability 已覆盖 |
| 正确性 | 产品 Tab、默认搜索 Tab、代码占位区、搜索单站布局、旧入口移除均有实现和测试证据 |
| 一致性 | 实现符合 OpenSpec proposal/design、技术设计文档和 README 当前描述 |
| 结论 | PASS，未发现 CRITICAL 或 IMPORTANT 剩余问题 |

## 验证命令

- `npx openspec validate replace-view-modes-with-product-tabs --strict`：通过。
- `"$COMET_BASH" "$COMET_GUARD" replace-view-modes-with-product-tabs build --apply`：通过，并推进到 verify。
- `"$COMET_BASH" "$COMET_STATE" scale replace-view-modes-with-product-tabs`：判定 `verify_mode=full`。
- `npx openspec status --change replace-view-modes-with-product-tabs --json`：repo-local，artifacts 完整。
- `npx openspec instructions apply --change replace-view-modes-with-product-tabs --json`：14/14 tasks complete。
- `npm run typecheck`：通过。
- `npm test`：5 个测试文件、66 个测试全部通过。
- `npm run build`：通过。
- `npm run dev` 人工冒烟：Vite 在 `http://127.0.0.1:5173` 启动；Electron 窗口启动；Playwright 快照确认默认显示“搜索”Tab、服务侧栏和单个大站点；切换“代码”Tab 后仅显示本地占位区。

## OpenSpec 覆盖

### Requirement: 产品级 Tab 替代展示模式

- 实现证据：`src/renderer/app.ts` 使用 `ProductTab = 'search' | 'code'`，顶部渲染 `搜索` 和 `代码` 按钮，并写入 `data-product-tab`。
- 测试证据：`tests/renderer/app.test.ts` 覆盖默认搜索 Tab、旧 `view-mode-grid` / `view-mode-single` 不存在、切换代码 Tab 后隐藏搜索 workflow。

### Requirement: 搜索工作流保持可用

- 实现证据：搜索 workflow 复用原服务 pane、WebView、服务开关、发送、导出、设置、回主页和放大还原逻辑。
- 测试证据：renderer 测试覆盖服务开关同步、发送到已选、导出 MD、错误状态、回主页、放大还原和物理输入回退。

### Scenario: 搜索 Tab 使用单站布局

- 实现证据：`renderPane()` 默认输出 `single-active` / `single-hidden`，CSS 使用左侧服务菜单 + 右侧单列 pane。
- 测试证据：`keeps the search workflow in single-pane mode and reuses existing webviews` 验证默认单站布局且 WebView 不重建。

### Scenario: 代码占位区不加载远程页面

- 实现证据：代码 Tab 只创建本地 `code-workflow-placeholder`，没有新增代码站点 service 或额外 WebView 创建路径。
- 测试证据：Tab 切换测试验证 WebView 集合未增加，代码 workflow 显示本地占位文案。

## Code Review 处理

standard review 发现 1 个 IMPORTANT：缺少 workflow hidden 状态自动化断言。已修复：

- 增加 `searchWorkflow.hidden`、`codeWorkflow.hidden`、顶层 `.app-shell[data-product-tab]` 和代码 Tab 下 active pane 处于 hidden ancestor 内的断言。
- 修复后重新运行 `npm test -- tests/renderer/app.test.ts -t "switches between search and code tabs"`、`npm test`、`npm run typecheck`、`npm run build`，均通过。

## 安全检查

运行关键字扫描：

```bash
rg -n "api[_-]?key|secret|token|password|PRIVATE KEY|BEGIN RSA|BEGIN OPENSSH|sk-[A-Za-z0-9]" src tests README.md package.json openspec/changes/replace-view-modes-with-product-tabs docs/superpowers
```

命中项均为既有内部剪贴板恢复 token 类型/变量名或测试文本，不是硬编码密钥。

## 剩余风险

- 真实远程 AI 站点 WebView 加载期间可能输出第三方网络/SSL 日志；本 change 未改动这些站点加载策略。
- 代码 Tab 只是占位，仓库输入和代码站点问答将在后续 changes 中实现。
