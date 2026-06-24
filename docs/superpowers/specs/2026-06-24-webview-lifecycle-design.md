---
comet_change: optimize-webview-lifecycle
role: technical-design
canonical_spec: openspec
archived-with: 2026-06-24-optimize-webview-lifecycle
status: final
---

# WebView 生命周期优化设计

## 背景

应用同时集成搜索工作流和代码工作流。旧实现会在启动时创建多个 Electron `<webview>` 并立即设置搜索服务 `src`，代码 Tab 也可能在仓库提交后一次性让所有代码站点常驻。隐藏 WebView 仍会保留 guest renderer、JavaScript、缓存和会话资源，这会放大启动成本和后台内存占用。

本 change 的目标是在不替换 Electron `<webview>` 技术栈、不清除用户登录态的前提下，把远程页面改为按需加载、可释放和可恢复。

## 目标

- 应用启动时避免急切导航所有搜索和代码 WebView。
- 用户查看某个搜索站点或向已选搜索服务发送问题时，再加载对应 WebView。
- 未选搜索服务不会因为一次发送而加载。
- 搜索与代码 Tab 切换时，释放非活跃工作流中不再需要的 WebView。
- 代码工作流在当前仓库未变化时保留本地问答历史，释放 WebView 后仍可导出。
- 发送过程中的 WebView 不会被生命周期释放逻辑打断。
- 持久化 partition 在首次导航前设置，保留站点登录态。

## 非目标

- 不迁移到 `WebContentsView`。
- 不清理 `persist:` partition、cookie、缓存或用户数据目录。
- 不优化第三方网页内部 JavaScript。
- 不为每个站点实现可配置的热缓存容量；本 change 采用保守释放策略。

## 状态模型

共享 pane 状态扩展为：

- `unloaded`：WebView shell 存在，但尚未导航远程页面。
- `loading`：正在导航或等待页面 ready。
- `ready`：页面已加载完成。
- `warm`：页面已按当前上下文恢复，可用于后续操作。
- `released`：此前加载过的远程页面已释放，需要时可重新加载。
- `error`：加载或发送失败。

搜索 pane 继续保留已有发送状态：`sending`、`sent`、`manual_required`、`login_required`、`disabled`。

## 搜索工作流设计

搜索工作流保留现有 DOM shell 和左侧菜单，但启动时不再对每个搜索 `<webview>` 设置 `src`。每个搜索 WebView 仍在创建时设置 `partition`，确保首次真实导航前分区已确定。

加载触发点：

- 首屏当前站点：渲染搜索 Tab 时只加载当前可见站点。
- 左侧菜单选择站点：加载被查看的站点。
- 放大当前站点：加载被放大的站点。
- 点击“发送到已选”：仅加载已勾选且已开启的服务，并在发送脚本执行前等待主页 ready。
- 点击“回主页”：重新加载该服务配置的主页。

释放策略：

- 切换到代码 Tab 时，释放没有发送中的搜索 WebView。
- 释放通过清除 `src` 并尝试导航 `about:blank` 完成；状态置为 `released`。
- 释放不修改 `partition`，因此登录态仍由 Electron 持久 session 保留。

发送保护：

- 每个搜索 pane 增加 `isSendPending`。
- 发送前递增 `sendGeneration`，发送完成或失败后清理 pending 标记。
- 生命周期释放逻辑跳过 `isSendPending === true` 的 pane。
- 老发送结果仍通过 generation guard 避免覆盖新发送状态。

## 代码工作流设计

代码站点初始状态为 `unloaded`。用户提交有效仓库时，如果当前处于代码 Tab，则加载三个代码站点；如果不在代码 Tab，则只保存当前仓库状态，等回到代码 Tab 时恢复。

加载触发点：

- 打开有效仓库且代码 Tab 活跃。
- 切回代码 Tab 且存在 `activeRepository`。
- 发送代码问题前确保三个代码站点按当前仓库 URL 加载。

释放策略：

- 切回搜索 Tab 时释放没有问答发送中的代码 WebView。
- 每个代码 pane 维护 `inFlightCount`，释放逻辑跳过正在发送或抽取回答的 pane。
- 释放只影响远程页面资源，不影响内存中的 `codeRounds`。

导出边界：

- 代码问答历史保存在 renderer 本地状态中。
- WebView 释放后，导出仍使用 `codeRounds` 中的站点状态、回答和错误。
- 切换仓库仍按既有规则清空当前仓库历史。

## UI

未加载和已释放状态使用轻量占位：

- `未加载，查看或发送时加载`
- `已释放，需要时会重新加载`

状态点复用现有视觉语言：

- 未加载/已释放：灰色。
- 加载中：灰色。
- 就绪/预热/已发送：绿色。
- 发送中：蓝色。
- 需人工处理：橙色。
- 失败：红色。

占位 UI 不新增操作按钮，保持现有“服务名、开关、状态点、错误提示”的简洁边界。

## 测试策略

- Renderer 启动测试确认只有当前可见搜索 WebView 被导航，其余搜索服务无 `src`。
- 搜索发送测试确认已选服务在发送前调用加载，未选或禁用服务不会加载。
- Tab 切换测试确认离开搜索工作流会释放搜索 WebView，回到搜索后可恢复当前站点。
- 代码导出测试确认代码 WebView 被释放后，已有问答历史仍能导出。
- Shared 状态测试确认初始 pane 状态为 `unloaded`，并存在新增生命周期标签。
- 全量验证运行 `npm run typecheck`、`npm test`、`npm run build`。

## 风险与缓解

- 首次查看某个站点会比常驻加载慢。缓解方式是明确显示未加载/加载中状态，并只预热当前可见页。
- 释放 WebView 会丢失第三方网页内未保存状态。缓解方式是保留 `persist:` session，并把代码问答导出依赖的用户可见状态存到本地 `codeRounds`。
- 发送过程中释放 WebView 会导致丢请求。缓解方式是搜索 `isSendPending` 与代码 `inFlightCount` 双保护。
- Electron 测试环境的 mock `loadURL` 可能不返回 Promise。实现中使用 `Promise.resolve(...)` 兼容。
