---
comet_change: replace-view-modes-with-product-tabs
role: technical-design
canonical_spec: openspec
archived-with: 2026-06-23-replace-view-modes-with-product-tabs
status: final
---

# 搜索 / 代码产品 Tab 设计

## 背景

当前应用顶部使用“分屏 / 单站”作为展示方式切换。这个模型已经不符合下一阶段产品语义：应用将分成“搜索”和“代码”两个工作流，而不是在同一个搜索工作流中继续强调多 WebView 分屏。

现有“单站”模式已经具备这个 change 需要的主体结构：左侧服务菜单，右侧当前选中的 AI 网站大 WebView，并保留每个服务的状态点、开关、回主页、放大和错误提示。因此第一个 change 的最佳路径是把它提升为“搜索”Tab 的默认布局，而不是继续维护旧分屏模式。

## 确认方案

采用方案 1：搜索 Tab 复用现有单站布局。

- 顶部展示产品级 Tab：“搜索 / 代码”。
- 默认进入“搜索”Tab。
- “搜索”Tab 内部使用左侧服务菜单 + 右侧单个大 WebView。
- 顶部继续保留问题输入、发送到已选、导出 MD、设置和运行标识。
- “代码”Tab 在本 change 中只显示本地占位区，不加载远程代码站点。
- 移除旧“分屏 / 单站”按钮和用户可见分屏总览入口。

## 架构调整

### 状态模型

用产品语义替换展示语义：

```ts
type ProductTab = 'search' | 'code';
```

旧的 `ViewMode = 'grid' | 'single'` 不再作为用户入口状态存在。搜索工作流内部默认按照原单站布局渲染，因此无需保留 `grid` 作为可选状态。

### DOM 结构

页面主体拆成两个工作流容器：

- `search-workflow`
  - 复用现有服务 sidebar。
  - 复用现有 pane grid 容器，但布局语义改为搜索单站布局。
  - 只显示当前 active service pane，其余 pane 隐藏。
- `code-workflow`
  - 本 change 仅展示本地占位状态。
  - 不创建 Zread、DeepWiki、CodeWiki WebView。

顶层用 `data-product-tab="search|code"` 表达当前产品 Tab，替代旧 `data-view-mode="grid|single"`。

### 搜索功能承接

搜索 Tab 保留现有行为：

- 服务选择 toggle 仍决定“发送到已选”的目标。
- 服务开启/关闭状态继续影响 WebView 可见性与发送行为。
- 左侧服务菜单用于切换右侧大 WebView。
- 发送成功后继续显示导出按钮。
- 导出仍使用现有 Markdown 导出链路。
- 设置弹层继续展示运行数据路径，只读模式不变。

## 取舍

### 为什么不保留分屏子模式

保留分屏会让产品语义变得含糊：用户看到“搜索 / 代码”后，搜索里又出现“分屏 / 单站”，会把旧模式带进新架构。同时分屏会继续鼓励多个 WebView 同时可见和常驻，和后续降低内存占用的目标冲突。

### 为什么不做纯列表搜索页

纯列表会丢掉用户已经明确需要的“打开某一个查看完整网页”的体验。当前单站模式正好满足这个需求，而且迁移风险最低。

## 测试策略

- 默认选中“搜索”Tab。
- 页面不再出现“分屏 / 单站”按钮。
- 搜索 Tab 下可以看到服务菜单、当前站点大 WebView、问题输入、发送按钮、导出按钮、设置按钮。
- 切换到“代码”Tab 时显示本地占位区，不加载远程代码站点 WebView。
- 现有搜索发送、服务开关、回主页、导出测试继续通过。

## Spec Patch

已确认需要回写 OpenSpec delta spec：补充“搜索 Tab 使用单站大页面布局，不提供分屏总览入口”的验收场景。
