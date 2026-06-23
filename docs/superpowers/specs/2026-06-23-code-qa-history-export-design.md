---
comet_change: add-code-qa-history-export
role: technical-design
canonical_spec: openspec
---

# 代码问答历史与导出设计

## 背景

`代码` Tab 已能输入 GitHub 仓库并同时加载 Zread、DeepWiki、CodeWiki。这个 change 在此基础上增加代码站点问答编排：用户对当前仓库输入一个代码问题，应用把问题发送到三个代码站点，并把当前仓库下的多轮问答记录导出为 Markdown。

本 change 只处理当前仓库的内存历史，不做跨仓库历史恢复或磁盘持久化。用户切换仓库时，应用开启新的当前仓库会话，旧仓库历史不进入当前导出范围。

## 目标

- 在 `代码` Tab 中增加代码问题输入框和发送动作。
- 将同一个问题发送到当前仓库对应的 Zread、DeepWiki、CodeWiki。
- 当前仓库不变时，把后续问题追加到现有代码站点页面会话，不刷新仓库主页。
- 记录当前仓库的有序问答轮次，每轮包含三个站点的状态、回答和错误。
- 导出当前仓库全部已记录轮次，复用现有固定 Markdown 文件路径和剪贴板复制 IPC。

## 非目标

- 不实现跨仓库历史恢复。
- 不把代码问答历史持久化到磁盘。
- 不保证私有仓库可用。
- 不实现三个站点之外的通用网页问答引擎。
- 不要求回答抽取完美；抽取失败时保留问题、站点状态和错误。

## 架构

### 共享代码站点问答配置

新增 `src/shared/codeQa.ts`，作为代码站点问答自动化的唯一规则源。它与现有 `src/shared/codeSites.ts` 分工如下：

- `codeSites.ts` 负责仓库路由、URL、partition 和 WebView allowlist。
- `codeQa.ts` 负责三站点 DOM 自动化配置、发送脚本、回答抽取脚本和 Markdown formatter。

`codeQa.ts` 导出：

- `CodeQaStatus = 'pending' | 'sending' | 'generating' | 'completed' | 'manual_required' | 'error'`
- `CodeQaSiteConfig`
- `codeQaSiteConfigs`
- `buildCodeQaSendScript(options)`
- `buildCodeQaExtractScript(options)`
- `formatCodeQaMarkdownExport(repository, rounds, exportedAt)`

每个站点配置包含：

- `siteId`
- `firstQuestionInputSelectors`
- `followUpInputSelectors`
- `submitSelectors`
- `answerSelectors`
- `busySelectors`
- 可选 `activationSelectors`
- 可选 `requiresFollowUpAfterFirstRound`

站点规则固定为：

- Zread：首问和追问发送前都可先尝试激活 `Ask AI`；输入使用 `textarea[placeholder="提出后续问题..."]`，发送使用 `button[aria-label="Send message"]`。
- DeepWiki：首问使用 `textarea[data-deepwiki-input="question"]`；同仓库第二轮及以后使用 `textarea[data-deepwiki-input="followup"]`；不在追问前重置 URL。
- CodeWiki：输入使用 `#message-textarea`，发送使用 `button[data-test-id="send-message-button"]`。

### Renderer 当前仓库会话

`src/renderer/app.ts` 持有当前仓库的内存状态：

```ts
type CodeRound = {
  id: string;
  repository: NormalizedRepository;
  question: string;
  createdAt: string;
  entries: Record<CodeSiteId, CodeRoundEntry>;
};

type CodeRoundEntry = {
  siteId: CodeSiteId;
  siteName: string;
  status: CodeQaStatus;
  answerText: string;
  errorMessage: string | null;
  updatedAt: string;
};
```

状态边界：

- `activeRepository === null` 时，发送代码问题会展示错误，不执行任何 WebView 脚本。
- 打开有效仓库时，如果仓库与 `activeRepository` 不同，则清空 `codeRounds` 并导航三个代码站点到新仓库 URL。
- 打开同一仓库时，不清空历史，也不刷新已有页面。
- 发送问题时，先创建一条 round，三个 entry 初始为 `pending`，随后并发发送到三个 code pane。
- 单站失败只更新该站 entry，不影响其他站点和整轮导出。

### 发送流程

发送代码问题时：

1. 校验存在 `activeRepository`。
2. 校验问题非空。
3. 创建 round 并渲染历史。
4. 对每个 code pane 并发执行：
   - entry 置为 `sending`。
   - 如果 WebView 或 `executeJavaScript` 不可用，entry 置为 `manual_required`。
   - 调用 `buildCodeQaSendScript()`，传入站点配置、问题和 `isFollowUp`。
   - DOM 脚本完成后，entry 置为 `generating` 或 `manual_required/error`。
   - 延迟短时间后调用 `buildCodeQaExtractScript()` 抽取回答和 busy 状态。
   - 如果仍 busy，保留 `generating` 和已抽取的部分文本；否则置为 `completed`。

脚本返回结构保持显式：

```ts
type CodeQaSendResult =
  | { status: 'sent'; errorMessage: null }
  | { status: 'manual_required' | 'error'; errorMessage: string };

type CodeQaExtractResult = {
  status: 'ok' | 'error';
  answerText: string;
  isBusy: boolean;
  errorMessage: string | null;
};
```

### 同仓库追问

同仓库追问不调用代码站点主页导航。发送脚本用本地 `codeRounds.length > 0` 判断是否 follow-up：

- Zread 和 CodeWiki 使用相同输入/发送规则。
- DeepWiki 首轮使用 question selector，第二轮及以后使用 follow-up selector。

这保留 DeepWiki 首问后自然跳转到 `/search/...` 的页面会话。

### 仓库变化

仓库变化是新的代码上下文：

- `activeRepository` 更新为新仓库。
- `codeRounds` 重置为空数组。
- 三个 code pane 导航到新仓库 URL。
- 后续导出只包含新仓库的轮次。

这是用户已确认的范围，不保存旧仓库历史。

## UI

代码 Tab 中新增一个代码问答工具栏，放在仓库输入区下方：

- 输入框 placeholder：`询问当前仓库`
- 按钮：`发送问题`
- 状态/错误提示：复用顶部错误区域或代码 Tab 内局部错误提示。

新增历史区域：

- 显示当前仓库的轮次列表。
- 每轮显示问题文本。
- 每个站点显示站点名、状态、错误或回答摘要。
- 导出按钮继续使用现有 `导出 MD`，但在 `代码` Tab 下导出代码问答历史，在 `搜索` Tab 下保持现有搜索导出行为。

## Markdown 导出

代码导出 formatter 输出：

```md
# muti-search 代码问答导出

- 仓库：owner/repo
- 导出时间：...

## 第 1 轮

### 问题

...

### Zread

...

### DeepWiki

状态：生成中

### CodeWiki

错误：...
```

导出规则：

- 按 `codeRounds` 顺序输出。
- 每轮固定按 Zread、DeepWiki、CodeWiki 输出。
- `completed` 输出回答文本。
- `generating` 输出状态和已有部分文本。
- `manual_required` / `error` 输出状态或错误。
- 没有 round 时提示 `没有可导出的代码问答记录`，不调用导出 IPC。

## 测试策略

### 共享测试

新增或扩展共享测试：

- 三站点 DOM 配置包含预期 selector。
- Zread send script 包含 Ask AI activation 和消息发送逻辑。
- DeepWiki 首问和追问使用不同 input selector。
- CodeWiki 使用 `#message-textarea` 与 `button[data-test-id="send-message-button"]`。
- Markdown formatter 输出仓库名、多轮问题、站点回答、生成中状态和错误。

### Renderer 测试

扩展 `tests/renderer/app.test.ts`：

- 缺少仓库时发送代码问题展示错误，且三个 code webview 不执行脚本。
- 首问会向三个代码站点执行发送脚本，并创建一条 round。
- 同仓库追问不调用 `loadURL()` 或重设 code webview `src`，并创建第二条 round。
- DeepWiki 首问脚本使用 question selector，追问脚本使用 follow-up selector。
- 仓库变化后 `codeRounds` 清空，新问题记录在新仓库上下文下。
- 代码 Tab 下导出 Markdown 包含全部当前仓库轮次和单站错误。

### 手动验证

在 dev app 或 packaged app 中使用 `obra/superpowers`：

1. 打开仓库。
2. 发送首问。
3. 等三个站点开始回答或进入可见错误状态。
4. 发送追问，确认三站不回主页，DeepWiki 留在 `/search/...`。
5. 导出 Markdown，确认包含当前仓库所有已记录轮次。

## Spec Patch

在 `code-qa-history-export` delta spec 中补充场景：仓库变化后旧仓库历史不进入当前仓库导出范围。
