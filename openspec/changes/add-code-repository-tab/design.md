## 上下文

产品将新增“代码”工作流，用于打开面向 GitHub 仓库的 AI 代码文档页面。使用 Chrome 对 `obra/superpowers` 实测后，确认以下 URL 可直接解析：

- `https://zread.ai/obra/superpowers`
- `https://deepwiki.com/obra/superpowers`
- `https://codewiki.google/github.com/obra/superpowers`

现有应用已经在 `<webview>` attach 阶段校验 URL 与 partition。代码站点路由必须沿用这个安全模型，不能因为新增代码页而允许任意远程页面。

## 目标与非目标

**目标：**

- Accept GitHub repository input as `owner/repo` or GitHub URL.
- Normalize valid input to `owner/repo`.
- Generate and load the three code-site URLs for Zread, DeepWiki, and CodeWiki.
- Use `obra/superpowers` as the fixture and manual verification example.
- Show per-site name, status, and error state in the code Tab.

**非目标：**

- Do not automate questions in this change.
- Do not implement history export in this change.
- Do not solve private repository authentication.

## 设计决策

- Add a separate code-site definition list instead of mixing code sites into the existing search `services`. Search services and code sites have different URL templates, send behavior, and export semantics.
- Use dedicated persistent partitions such as `persist:code-zread`, `persist:code-deepwiki`, and `persist:code-codewiki` so code-site cookies do not mix with search service sessions.
- Permit only generated URLs whose origin matches the three known code sites and whose path matches a normalized GitHub repository route.
- Keep repository parsing local and deterministic: strip `https://github.com/`, optional trailing slash, `.git`, `tree/...`, `blob/...`, and query/hash fragments; reject missing owner or repo.
- Do not load code-site WebViews until the user enters a valid repository in the code Tab.

## 风险与取舍

- [风险] CodeWiki 和 DeepWiki 的 URL 规则可能变化 → 缓解：集中维护 URL 构造器，并用 `obra/superpowers` 覆盖测试。
- [风险] 用户输入非 GitHub URL → 缓解：展示校验错误，不导航任何页面。
- [风险] WebView attach 白名单过宽 → 缓解：同时校验 origin、生成后的仓库路径和 partition，不只校验 origin。

## 迁移计划

1. Add code-site definitions and repository parsing helpers.
2. Extend main-process WebView validation for code-site partitions and generated URLs.
3. Add code Tab repository input and three code-site panes.
4. Add renderer and main-process tests for `obra/superpowers` routing.

## 未决问题

- Whether code-site partitions should be shown in the settings path list; this change can include static paths if the UI already lists runtime partitions.
