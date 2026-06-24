## 上下文

历史实现会在启动时创建每个搜索服务 WebView，并立即设置 `src`。性能分析确认这是主要资源压力：隐藏的 WebView 仍会保留 guest 内容、session、JavaScript、缓存和 renderer 资源。Electron 文档确认：

- `persist:` partitions share persistent sessions across pages with the same partition.
- The partition must be set before first navigation.
- Assigning `src` can trigger navigation.
- Hiding a WebView does not destroy guest content; real release requires removing/destroying the guest WebContents or the owning WebView.

如果不调整生命周期管理，新增三个代码站点页面会进一步放大启动和后台内存压力。

## 目标与非目标

**目标：**

- Avoid loading all search and code WebViews at startup.
- Load WebViews when a workflow or site is needed.
- Keep enough warm state to support same-repository code follow-ups.
- Release inactive WebViews when they are no longer useful.
- Preserve login/session data through persistent partitions.

**非目标：**

- Do not replace Electron `<webview>` with `WebContentsView` in this change.
- Do not clear user cookies or runtime session directories.
- Do not optimize third-party site JavaScript internals.

## 设计决策

- Introduce a WebView runtime state machine: `unloaded`, `loading`, `ready`, `warm`, `released`, `error`.
- Defer `src` assignment until the WebView is needed. Create DOM shells cheaply, then attach/navigate WebViews on demand.
- Keep a small warm set:
  - active search site or selected search services currently being sent to
  - active code sites for the current repository while code Tab is in use
  - optional most-recent site if implementation complexity remains low
- On Tab switch, release non-active workflow WebViews unless they are needed for pending sends or active code follow-up history.
- Preserve session continuity through `persist:` partitions. Recreated WebViews use the same partition and target URL, but in-page unsaved state may be lost if released.
- Make code QA history local so export survives WebView release.

## 风险与取舍

- [风险] 释放 WebView 会丢失页面内对话上下文 → 缓解：用户正在连续追问当前仓库时不释放活跃代码页，并用本地历史保障导出。
- [风险] 懒加载增加首次使用延迟 → 缓解：展示明确加载状态，并可选择预热第一个活跃站点。
- [风险] 现有测试默认所有 WebView 都立即存在 → 缓解：更新测试为断言生命周期状态和按需创建。
- [风险] 发送过程中销毁 WebView 会破坏状态 → 缓解：使用 generation token，并阻止释放正在发送的 WebView。

## 迁移计划

1. Add lifecycle states and helpers around WebView creation/navigation/release.
2. Replace startup eager `src` assignment with lazy loading.
3. Update search send path to ensure required WebViews are loaded before sending.
4. Update code Tab to keep current-repository code pages warm while needed.
5. Add tests for startup WebView count, Tab switching release, send-triggered loading, and preserved local export history.

## 未决问题

- The exact warm cache size should be tuned after measurement; initial design should prefer conservative memory use over maximum instant switching speed.
