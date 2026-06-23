# Brainstorm Summary

- Change: replace-view-modes-with-product-tabs
- Date: 2026-06-23

## 已确认事实

- 本 change 只处理“分屏 / 单站”到“搜索 / 代码”的产品入口重构。
- 本 change 不实现代码站点 WebView、代码问答、导出历史或 WebView 生命周期优化。
- 当前代码中 `ViewMode = 'grid' | 'single'`，默认 `grid`，顶部按钮文案为“分屏 / 单站”。
- 当前单站模式已有左侧服务菜单与右侧大 WebView，切换不重建 WebView。
- 当前分屏模式是旧入口，需要从用户可见路径中移除。
- 用户已确认：移除“分屏”后，`搜索` Tab 直接采用现有“单站”布局作为默认搜索界面。

## 确认的技术方案

- 已确认采用：搜索 Tab 内部直接复用现有“单站”布局，左侧服务菜单，右侧当前选中的 AI 网站大 WebView。
- 备选但不采用：保留多站小屏总览作为搜索 Tab 内部子模式。原因是会继续鼓励多 WebView 同屏常驻，和性能目标冲突。
- 用户已在设计确认点选择方案 1。

## 关键取舍与风险

- 移除分屏符合性能目标，因为不再鼓励用户同时查看所有远程页面。
- 若搜索 Tab 仍保留多站可见布局，会削弱本 change 的目标并和后续生命周期优化冲突。
- 保留现有单站结构能减少迁移风险，但需要清理命名，避免代码里继续用 `grid/single` 表达产品状态。

## 测试策略

- 用 renderer 测试确认默认选中“搜索”Tab。
- 用 renderer 测试确认“分屏 / 单站”文案和旧 `data-view-mode` 不再出现在用户入口。
- 用 renderer 测试确认搜索 Tab 显示左侧服务菜单和右侧单个 active pane。
- 用 renderer 测试确认切换到“代码”Tab 时展示本地占位区且不创建新的远程代码 WebView。
- 用现有发送/导出测试确认搜索 Tab 下功能不回归。

## Spec Patch 候选

- 需要回写：在 `product-tabs-navigation` spec 中补充“搜索 Tab 使用单站大页面布局，不提供分屏总览入口”的验收场景。
