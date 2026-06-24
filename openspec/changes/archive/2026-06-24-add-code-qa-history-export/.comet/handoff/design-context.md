# Comet Design Handoff

- Change: add-code-qa-history-export
- Phase: design
- Mode: compact
- Context hash: d2d65a001f66ede93f8040c599a71387432aa45faa8729cde3170ad1b3a18242

Generated-by: comet-handoff.sh

OpenSpec remains the canonical capability spec. This handoff is a deterministic, source-traceable context pack, not an agent-authored summary.

## openspec/changes/add-code-qa-history-export/proposal.md

- Source: openspec/changes/add-code-qa-history-export/proposal.md
- Lines: 1-33
- SHA256: fa4a1ca19fd580e6635ca546910c37c36a48f2d91d08d744bb03c6d529a03e69

```md
## 背景与原因

代码站点页面本身支持 AI 问答，但用户需要在本地应用里一次向三个站点提问，并把同一仓库下的多轮问答作为连续记录导出。仅靠页面当前 DOM 抽取最后回答无法满足“同 repo 追加”和完整导出。

## 变更内容

- 在“代码”Tab 中新增问题输入框，用于向 Zread、DeepWiki、CodeWiki 三个页面发送同一个问题。
- 同一 GitHub 仓库未变化时，后续问题追加到当前三个页面的会话中，不刷新仓库主页。
- 仓库变化时，建立新的仓库上下文并导航三个代码站点到新仓库页面。
- 维护本地代码问答历史，按仓库、轮次和站点记录问题、回答、状态和错误。
- 导出 MD 时包含当前仓库的全部代码问答记录，而不是只包含最后一次页面抽取。
- 写入基于 Chrome 实测的 DOM 行为：
  - Zread：先点顶部 `Ask AI`，再使用 `textarea[placeholder="提出后续问题..."]` 和 `button[aria-label="Send message"]`。
  - DeepWiki：首问使用 `textarea[data-deepwiki-input="question"]`；发送后进入 `/search/...`；追问使用 `textarea[data-deepwiki-input="followup"]`。
  - CodeWiki：使用 `#message-textarea` 和 `button[data-test-id="send-message-button"]`。

## 能力范围

### 新增能力

- `code-qa-history-export`: 管理代码站点多轮问答、回答抽取、历史记录和 Markdown 导出。

### 修改能力

- 无。

## 影响范围

- 影响 `src/renderer/app.ts` 的代码 Tab 问题输入、三站发送流程、回答完成判断和历史状态。
- 影响 `src/shared/domScript.ts` 或新增代码站点专用 DOM 脚本构建器。
- 影响 `src/shared/exportMarkdown.ts` 和 `src/main/main.ts` 的导出调用语义，但应复用当前固定文件路径与剪贴板复制行为。
- 影响 `tests/renderer/app.test.ts`，需要覆盖首问、追问、repo 变化和导出。
- 可能需要新增 `tests/shared/codeSites.test.ts` 覆盖 DOM 选择器与 URL 规则。
```

## openspec/changes/add-code-qa-history-export/design.md

- Source: openspec/changes/add-code-qa-history-export/design.md
- Lines: 1-59
- SHA256: 16abc24838d20f860ac0e6307bf402feeb0762bdbb80b2962e02265f408e2b17

```md
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
```

## openspec/changes/add-code-qa-history-export/tasks.md

- Source: openspec/changes/add-code-qa-history-export/tasks.md
- Lines: 1-35
- SHA256: 380ff77cb296a67c5e0071dee00123bd655c679ddfc1023a0e3a542134e5850b

```md
## 1. 测试

- [ ] 1.1 增加测试，覆盖首个代码问题发送到三个代码站点。
- [ ] 1.2 增加测试，覆盖同仓库追问时不回主页导航。
- [ ] 1.3 增加测试，覆盖 DeepWiki 首问和追问 selector 切换。
- [ ] 1.4 增加测试，覆盖仓库变化后创建新的代码会话。
- [ ] 1.5 增加测试，覆盖 Markdown 导出包含所有轮次和单站错误。

## 2. 代码站点 DOM 自动化

- [ ] 2.1 为 Zread、DeepWiki 和 CodeWiki 增加显式 DOM 配置。
- [ ] 2.2 实现 Zread 发送前的 Ask AI 激活步骤。
- [ ] 2.3 实现 DeepWiki 首问与追问的差异化发送行为。
- [ ] 2.4 使用 `#message-textarea` 和 `data-test-id` 实现 CodeWiki 发送行为。
- [ ] 2.5 为三个站点增加回答抽取和生成中状态判断。

## 3. 本地历史模型

- [ ] 3.1 增加当前仓库会话状态。
- [ ] 3.2 增加有序代码问题轮次，并记录每站 entry。
- [ ] 3.3 记录已发送、生成中、完成、需要手动处理和错误状态。
- [ ] 3.4 在 WebView 被释放或隐藏后保留历史记录。

## 4. 导出

- [ ] 4.1 增加代码问答 Markdown formatter。
- [ ] 4.2 复用现有固定导出路径和剪贴板复制 IPC。
- [ ] 4.3 导出仓库名、轮次顺序、站点回答、生成中说明和错误。

## 5. 验证

- [ ] 5.1 Run `npm run typecheck`.
- [ ] 5.2 Run `npm test`.
- [ ] 5.3 Run `npm run build`.
- [ ] 5.4 在 packaged 或 dev app 中手动验证 Chrome 已观察到的 `obra/superpowers` 流程。
```

## openspec/changes/add-code-qa-history-export/specs/code-qa-history-export/spec.md

- Source: openspec/changes/add-code-qa-history-export/specs/code-qa-history-export/spec.md
- Lines: 1-70
- SHA256: 8b8726ae42e41b7c9bd68af0d556ff31df4692024dccfca5075dc2e3a7d3d0f1

```md
## ADDED Requirements

### Requirement: 代码问题会发送到所有代码站点

系统 SHALL 将代码问题发送到当前仓库对应的 Zread、DeepWiki 和 CodeWiki。

#### Scenario: 发送首个问题

- **WHEN** 当前仓库是 `obra/superpowers`
- **AND** 用户在代码问题输入框中输入 `这个项目的核心架构是什么？`
- **THEN** 系统将问题发送到 Zread、DeepWiki 和 CodeWiki
- **AND** 每个站点 entry 记录已发送、生成中、已完成或错误状态

#### Scenario: 缺少仓库

- **WHEN** 用户在选择有效仓库前尝试发送代码问题
- **THEN** 系统展示错误
- **AND** 不执行任何代码站点发送动作

### Requirement: 同仓库问题会追加

系统 SHALL 在仓库未变化时，将追问追加到现有代码站点会话。

#### Scenario: 追问保留现有页面

- **WHEN** 当前仓库仍为 `obra/superpowers`
- **AND** 用户发送第二个代码问题
- **THEN** 系统发送前不会把代码站点导航回仓库首页
- **AND** 本地历史包含两个问题轮次

#### Scenario: DeepWiki 追问使用搜索会话

- **WHEN** DeepWiki 在首问后已经从 `/obra/superpowers` 导航到 `/search/...` 页面
- **AND** 用户对同一仓库发送追问
- **THEN** 系统使用 `textarea[data-deepwiki-input="followup"]`
- **AND** 不将 DeepWiki 重置为 `https://deepwiki.com/obra/superpowers`

### Requirement: 仓库变化会开启新的代码会话

系统 SHALL 将仓库变化视为新的代码上下文。

#### Scenario: 新仓库导航代码站点

- **WHEN** 用户将仓库从 `obra/superpowers` 改为另一个有效仓库
- **THEN** 系统将 Zread、DeepWiki 和 CodeWiki 导航到新仓库 URL
- **AND** 新问题轮次记录在新仓库上下文下

#### Scenario: 旧仓库历史不进入当前导出范围

- **WHEN** 用户已在 `obra/superpowers` 记录代码问题轮次
- **AND** 用户将仓库切换为另一个有效仓库
- **THEN** 当前仓库的代码问答历史从空状态开始
- **AND** 导出 Markdown 不包含 `obra/superpowers` 的旧问题轮次

### Requirement: 代码问答导出包含全部轮次

系统 SHALL 将当前仓库已记录的全部问题轮次导出为 Markdown。

#### Scenario: 导出多个轮次

- **WHEN** 当前仓库有两个已记录代码问题轮次
- **AND** 用户点击导出
- **THEN** Markdown 包含仓库名
- **AND** 按顺序包含两个问题
- **AND** 每个轮次按 Zread、DeepWiki 和 CodeWiki 分组展示回答或错误

#### Scenario: 导出包含站点错误

- **WHEN** 某个代码站点发送或抽取回答失败
- **THEN** Markdown 在对应轮次中包含该站点的错误或状态
```

