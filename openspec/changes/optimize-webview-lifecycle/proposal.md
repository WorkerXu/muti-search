## 背景与原因

历史性能分析显示，应用主要资源压力来自多个 Electron `<webview>` 同时创建、加载并常驻。新增代码 Tab 后，如果搜索服务和三个代码站点全部热加载，内存占用和页面后台活动会进一步恶化。

## 变更内容

- 将 WebView 生命周期从“启动即创建并加载所有页面”调整为“按需加载 + 有限热缓存”。
- 搜索 Tab 与代码 Tab 之间切换时，非活跃工作流的 WebView 应尽量释放、挂起或保持有限数量热缓存。
- 对代码 Tab，仓库未变化时保留必要会话以支持追问；仓库变化或长时间非活跃时允许销毁并按当前仓库重建。
- 保留 `persist:` 分区提供的登录态与站点持久 session，但不把隐藏 WebView 视为资源释放。
- 设计可观测状态，用于区分未加载、加载中、就绪、热缓存、已卸载和错误。
- 不在本 change 中替换 Electron 技术栈，也不强制从 `<webview>` 迁移到 `WebContentsView`。

## 能力范围

### 新增能力

- `webview-lifecycle-management`: 管理搜索与代码 WebView 的按需创建、导航、热缓存和释放策略。

### 修改能力

- 无。

## 影响范围

- 影响 `src/renderer/app.ts` 中 WebView 创建时机、pane/runtime 数据结构、Tab 切换和发送前加载逻辑。
- 影响 `src/main/main.ts` 的 WebView 安全校验，确保延迟导航仍受白名单保护。
- 影响 `src/renderer/styles.css`，需要为未加载/已卸载状态提供清晰 UI。
- 影响所有依赖 `querySelectorAll('webview')` 数量的测试，需要改为按可加载状态断言。
- 需要结合 Electron 文档约束：`persist:` 分区在首次导航前设置；仅隐藏 WebView 不释放 guest 内容；真正释放需要销毁对应 guest WebContents 或移除 WebView。
