# Comet Design Handoff

- Change: replace-view-modes-with-product-tabs
- Phase: design
- Mode: compact
- Context hash: b2af27a522b1dc88d9f799332208fe2787bde20270e2f072a02d611f3bf20862

Generated-by: comet-handoff.sh

OpenSpec remains the canonical capability spec. This handoff is a deterministic, source-traceable context pack, not an agent-authored summary.

## openspec/changes/replace-view-modes-with-product-tabs/proposal.md

- Source: openspec/changes/replace-view-modes-with-product-tabs/proposal.md
- Lines: 1-28
- SHA256: 3c0ba5bebb33ef6b50bed4cbe400456b8053bae88bb74d3099476ec4f047379e

```md
## 背景与原因

当前应用顶部仍以“分屏 / 单站”作为展示方式切换，但下一阶段产品语义已经变成“搜索 / 代码”两类工作流。继续保留分屏入口会让用户误以为多 WebView 分屏仍是主能力，也会阻碍后续代码阅读功能接入。

## 变更内容

- **BREAKING** 移除“分屏”展示入口，不再提供旧的分屏总览模式。
- 将原“分屏 / 单站”切换替换为“搜索 / 代码”产品 Tab。
- “搜索”Tab 保留现有 AI 搜索功能，包括问题输入、服务开关、状态展示、发送到已选和导出 MD。
- 为后续“代码”Tab 预留独立页面区域，但本 change 不实现代码站点加载和问答。
- 更新 UI 测试和文档，确保旧分屏相关文案与测试断言被替换。

## 能力范围

### 新增能力

- `product-tabs-navigation`: 管理搜索与代码两个产品 Tab 的导航、默认状态和搜索功能承接。

### 修改能力

- 无。

## 影响范围

- 影响 `src/renderer/app.ts` 中的视图模式状态、顶部切换按钮、布局渲染逻辑和相关事件处理。
- 影响 `src/renderer/styles.css` 中分屏、单站、侧边栏和主体区域布局样式。
- 影响 `tests/renderer/app.test.ts` 中旧分屏/单站断言。
- 影响 `README.md`、`docs/design.md` 中关于展示方式的描述。
```

## openspec/changes/replace-view-modes-with-product-tabs/design.md

- Source: openspec/changes/replace-view-modes-with-product-tabs/design.md
- Lines: 1-44
- SHA256: 9b41af5971f233efb59e976e035fdd70192cc41c869615bce01556607bb4a095

```md
## 上下文

当前 renderer 使用 `ViewMode = 'grid' | 'single'` 表示“分屏 / 单站”展示方式。分屏模式显示所有服务 pane，单站模式通过左侧菜单和 CSS 隐藏非当前 pane，但底层 WebView 仍保持创建和加载。

新的产品方向不再把“分屏”作为核心展示方式，而是把应用分成“搜索”和“代码”两个工作流。这个 change 只完成导航语义替换和搜索功能承接，为后续代码 Tab 做承载。

## 目标与非目标

**目标：**

- 把顶部模式切换改为“搜索 / 代码”。
- 移除旧“分屏”入口和分屏总览布局。
- 搜索 Tab 保留现有问题输入、服务开关、服务状态、发送和导出。
- 代码 Tab 提供空状态或占位容器，供后续 change 接入仓库输入与代码站点。

**非目标：**

- 不实现代码站点 WebView。
- 不改变搜索服务的发送 DOM 策略。
- 不在本 change 中优化 WebView 生命周期。

## 设计决策

- 使用 `ProductTab = 'search' | 'code'` 替代 `ViewMode`。这样 UI 状态表达产品工作流，而不是旧布局形态。
- 搜索 Tab 继续复用现有服务 pane、服务 toggle、状态点和导出按钮，降低行为回归风险。
- 代码 Tab 初始只渲染独立容器和占位状态，不创建远程 WebView，避免提前引入额外资源消耗。
- 删除“分屏”按钮和 grid-specific 用户入口；旧的“单站”侧边栏结构可以作为搜索 Tab 内部布局基础保留或简化。

## 风险与取舍

- [风险] 用户可能仍期待同时看到多个搜索服务页面 → 缓解：搜索 Tab 保留服务列表和当前站点大视图，后续如有需要再加轻量列表状态，而不是恢复多 WebView 分屏。
- [风险] 测试中大量断言依赖 `grid` / `single` 文案和 `data-view-mode` → 缓解：先用测试锁定新 `data-product-tab` 与“搜索 / 代码”按钮。
- [风险] 旧文档仍描述 3x3 分屏 → 缓解：本 change 更新 README 与设计文档中的当前行为说明。

## 迁移计划

1. 用测试定义新 Tab 文案、默认搜索 Tab、切换到代码 Tab 的空状态。
2. 替换 renderer 状态与 DOM data attribute。
3. 移除旧分屏入口和分屏布局样式。
4. 更新文档并运行测试、类型检查和构建。

## 未决问题

- 搜索 Tab 是否在后续仍需要“所有服务页面同时可见”的轻量替代方案；本 change 默认不做。
```

## openspec/changes/replace-view-modes-with-product-tabs/tasks.md

- Source: openspec/changes/replace-view-modes-with-product-tabs/tasks.md
- Lines: 1-25
- SHA256: 2619f06bd8dffb7eb75ed0f5a5e249600bf5031d74f43ca1afac63c10ebe4e64

```md
## 1. 测试

- [ ] 1.1 增加 renderer 测试，覆盖默认选中“搜索”Tab 以及可切换到“代码”Tab。
- [ ] 1.2 更新 renderer 测试，移除对“分屏”和旧 view-mode data attribute 的断言。
- [ ] 1.3 增加回归测试，确认“搜索”Tab 下现有搜索控件仍然可用。

## 2. Renderer 实现

- [ ] 2.1 用产品 Tab 状态替换 `ViewMode` 状态。
- [ ] 2.2 将顶部控件替换为“搜索”和“代码”Tab 按钮。
- [ ] 2.3 将现有搜索控件和 pane 移入搜索工作流容器。
- [ ] 2.4 增加本地代码工作流占位区，不加载远程 WebView。
- [ ] 2.5 移除旧分屏/grid 用户可见布局路径。

## 3. 样式与文档

- [ ] 3.1 更新产品 Tab 对应的 CSS selector 和布局。
- [ ] 3.2 移除不再可达的旧分屏样式。
- [ ] 3.3 更新 README 和设计文档，描述“搜索 / 代码”结构。

## 4. 验证

- [ ] 4.1 Run `npm run typecheck`.
- [ ] 4.2 Run `npm test`.
- [ ] 4.3 Run `npm run build`.
```

## openspec/changes/replace-view-modes-with-product-tabs/specs/product-tabs-navigation/spec.md

- Source: openspec/changes/replace-view-modes-with-product-tabs/specs/product-tabs-navigation/spec.md
- Lines: 1-39
- SHA256: 7881caa1282d2d441dedc8f846fbf4998a8aeb1ad35b7e5c01b91cc3b7b038de

```md
## ADDED Requirements

### Requirement: 产品级 Tab 替代展示模式

系统 SHALL 展示名为“搜索”和“代码”的产品级 Tab，而不是旧的“分屏”和“单站”展示方式控件。

#### Scenario: 默认进入搜索 Tab

- **WHEN** 应用启动
- **THEN** “搜索”Tab 被选中
- **AND** 不展示旧的“分屏”和“单站”控件

#### Scenario: 可以选择代码 Tab

- **WHEN** 用户选择“代码”Tab
- **THEN** 应用展示代码工作流容器
- **AND** 搜索工作流控件不再作为当前主内容显示

### Requirement: 搜索工作流保持可用

系统 SHALL 在“搜索”Tab 下保留现有搜索工作流。

#### Scenario: 搜索控件保持可用

- **WHEN** “搜索”Tab 被选中
- **THEN** 问题输入框、服务控件、状态指示、发送按钮、设置按钮和导出行为保持可用

#### Scenario: 搜索 Tab 使用单站布局

- **WHEN** “搜索”Tab 被选中
- **THEN** 系统展示左侧服务菜单
- **AND** 系统在右侧展示当前选中的单个 AI 网站大 WebView
- **AND** 系统不提供“分屏”总览入口

#### Scenario: 代码占位区不加载远程页面

- **WHEN** 仓库路由尚未实现时用户选择“代码”Tab
- **THEN** 系统展示本地占位状态
- **AND** 本 change 不加载新的代码站点 WebView
```

