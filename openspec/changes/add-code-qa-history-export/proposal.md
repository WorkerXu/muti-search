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
