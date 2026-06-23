## 上下文

使用 Chrome 对 `obra/superpowers` 实测后，确认三个代码站点都支持页面内 AI 问答：

- Zread: click top `Ask AI`, then use `textarea[placeholder="提出后续问题..."]` and `button[aria-label="Send message"]`.
- DeepWiki: first question uses `textarea[data-deepwiki-input="question"]`; after submission the page navigates to `/search/...`; follow-up questions use `textarea[data-deepwiki-input="followup"]`.
- CodeWiki: use `#message-textarea` and `button[data-test-id="send-message-button"]`.

三站在测试后都保留了首问和追问文本。DeepWiki 是特殊情况：首次提问后会跳转到搜索会话 URL，因此追问不能再导航回仓库首页。

## 目标与非目标

**目标：**

- Send one code question to Zread, DeepWiki, and CodeWiki.
- Preserve an append-only local history for the current repository.
- Avoid refreshing code-site pages when the repository has not changed.
- Extract each site's answer after sending and store it with the question round.
- Export all recorded question rounds for the current repository to Markdown.

**非目标：**

- Do not guarantee private repository support.
- Do not implement a generic AI-site DOM engine beyond the three verified code sites.
- Do not require answer extraction to be perfect before preserving the user's question and status.

## 设计决策

- Use a local repository session model:
  - `currentRepository`: normalized `owner/repo`
  - `codeRounds`: ordered question rounds
  - each round contains one entry per code site with status, answer text, error, and timestamp
- Treat repository changes as a session boundary. When `currentRepository` changes, navigate the three sites to their repository URLs and start a new in-memory history for that repository.
- Treat same-repository questions as follow-ups. Do not call the "home" navigation path before sending if the repository is unchanged.
- Use site-specific DOM configs rather than generic selectors:
  - Zread requires an `Ask AI` activation step before input is visible.
  - DeepWiki has separate first-question and follow-up selectors.
  - CodeWiki has stable `#message-textarea` and `data-test-id` send button.
- Record history from local orchestration first, then enrich it with DOM extraction. If a site fails, export the question, site status, and error instead of dropping the round.
- Reuse the existing fixed Markdown export file behavior from the main process.

## 风险与取舍

- [风险] 第三方 DOM 变化会导致某个代码站点失效 → 缓解：显式维护每站配置，并在历史与导出中呈现单站错误。
- [风险] DeepWiki 首问前无法预知搜索会话 URL → 缓解：允许 WebView 自然跳转，并针对当前页面发送追问。
- [风险] 用户点击导出时某站仍在生成 → 缓解：在记录中标记仍在生成或部分捕获。
- [风险] DOM 抽取可能拿到旧回答 → 缓解：抽取时关联问题文本，并优先选择匹配用户问题之后出现的回答容器。

## 迁移计划

1. Add code-site DOM config and send/extract helpers.
2. Add code question input and send button in the code Tab.
3. Add local history state keyed by normalized repository.
4. Implement Markdown formatting for code Q&A history.
5. Add tests for first question, follow-up, DeepWiki URL transition, per-site errors, and export.

## 未决问题

- Whether histories for previously visited repositories should persist after switching repos; this change defaults to current-session memory only unless implementation scope allows low-risk persistence.
