# Brainstorm Summary

- Change: add-code-repository-tab
- Date: 2026-06-23

## 确认的技术方案

采用方案 A：共享模型 + 代码 Tab 三站并列加载。

新增 `src/shared/codeSites.ts` 作为代码仓库路由的唯一规则源，集中维护 GitHub 仓库输入归一化、代码站点定义、URL 构造、独立 partition 和 WebView config 校验。Renderer 在 `代码` Tab 内提供仓库输入和提交动作，输入有效仓库后加载 Zread、DeepWiki、CodeWiki 三个代码站点 pane。Main 进程复用共享 helper 校验 `<webview>` attach，确保只允许已知站点、合法仓库路径和匹配 partition。

## 已确认事实

- 当前 `代码` Tab 只显示本地占位区。
- 本 change 只实现 GitHub 仓库输入、归一化、三个代码站点 URL 生成、代码站点 WebView 展示和主进程 attach 安全校验。
- 本 change 不实现自动问答、问答历史、Markdown 导出，也不处理私有仓库认证。
- 示例仓库使用 `obra/superpowers`。
- 三个目标站点为 Zread、DeepWiki、CodeWiki：
  - `https://zread.ai/{owner}/{repo}`
  - `https://deepwiki.com/{owner}/{repo}`
  - `https://codewiki.google/github.com/{owner}/{repo}`
- 代码站点需要独立持久 session partition，不混用搜索服务 partition。

## 候选方案记录

### 方案 A：共享模型 + 代码 Tab 三站并列加载

新增 `src/shared/codeSites.ts`，集中维护仓库解析、代码站点定义、URL 构造和 WebView config 校验。Renderer 在代码 Tab 内输入仓库后一次性创建/导航三个代码站点 pane。Main 进程复用共享 helper 判断代码站点 URL 与 partition 是否匹配。

### 方案 B：最小内联实现

直接在 `app.ts` 和 `main.ts` 内写解析和白名单逻辑，不新增共享模块。实现更快，但规则会分散，测试和后续 Ask AI change 容易重复。

### 方案 C：先做懒加载单站模式

输入仓库后只加载当前选中的一个代码站点，切站时再加载其他站点。性能更好，但偏离当前 delta spec 的“三个代码站点页面加载”语义，也会把生命周期优化提前塞进这个 change。

## 推荐方案结论

用户已确认方案 A。它最符合当前 OpenSpec 范围：集中规则、测试清晰、主进程安全和 renderer URL 生成共用同一事实源，同时不提前实现后续问答和生命周期优化。

## 关键取舍与风险

- 取舍：本 change 不优化 WebView 生命周期，只保证有效仓库输入后生成并加载三个代码站点；性能优化留给 `optimize-webview-lifecycle`。
- 风险：代码站点 URL 规则变化。缓解：将 URL 构造集中在 `codeSites.ts`，用 `obra/superpowers` 做单元测试和主进程安全测试。
- 风险：白名单过宽。缓解：同时校验 origin、normalized repo path 和 partition。
- 风险：无效输入误导航。缓解：仓库解析失败时展示错误并保持三个代码站点不导航。

## 测试策略

- 共享单元测试覆盖 `owner/repo`、GitHub URL、`.git`、tree/blob 路径、query/hash、无效输入。
- 共享单元测试覆盖 `obra/superpowers` 三站 URL。
- 主进程测试覆盖有效代码站点 config、任意 origin、任意路径、不匹配 partition。
- Renderer 测试覆盖代码 Tab 输入 `obra/superpowers` 后渲染三个代码站点 pane，且无效输入不导航。

## Spec Patch

将回写 delta spec：补充一个场景，明确“代码站点 WebView 在仓库输入有效前不导航远程页面”。这与 design.md 中“Do not load code-site WebViews until the user enters a valid repository”一致，也能防止性能和隐私回归。
