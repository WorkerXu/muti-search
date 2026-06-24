# Brainstorm Summary

- Change: add-code-qa-history-export
- Date: 2026-06-23

## 已确认事实

- 当前 change 处于 `design` 阶段，目标是为 `代码` Tab 增加三站点问答、同仓库追问追加、本地历史和 Markdown 导出。
- OpenSpec 上游事实源包含三站 DOM 行为：
  - Zread：先点击顶部 `Ask AI`，再用 `textarea[placeholder="提出后续问题..."]` 与 `button[aria-label="Send message"]`。
  - DeepWiki：首问使用 `textarea[data-deepwiki-input="question"]`；首问后页面会跳转到 `/search/...`；追问使用 `textarea[data-deepwiki-input="followup"]`。
  - CodeWiki：使用 `#message-textarea` 与 `button[data-test-id="send-message-button"]`。
- 已归档的 `code-repository-routing` 能力提供代码站点 URL、partition、仓库输入归一化和 WebView 安全白名单。
- 现有搜索导出已经复用主进程固定文件路径和剪贴板复制行为，本 change 应继续复用该 IPC。

## 确认的技术方案

采用方案 A：当前仓库内存会话。

只保留当前仓库的问答历史；用户切换仓库时开启新的当前会话，旧仓库历史不进入导出范围。实现范围小，符合现有 OpenSpec 默认描述，风险最低。

## 关键取舍与风险

- 取舍：切换仓库会清空当前可导出的代码问答历史，避免实现多仓库历史管理和持久化。
- 风险：用户误切换仓库后无法导出旧仓库历史。缓解：仓库变化被视为明确的新代码上下文，当前 change 不做跨仓库历史恢复。
- 风险：第三方 DOM 变化导致单站发送或抽取失败。缓解：每站显式 DOM 配置，历史 entry 记录单站错误，不影响其他站点和导出。
- 风险：DeepWiki 首问后跳转到 `/search/...`。缓解：同仓库追问不回主页，依据本地 round 数和当前页面状态使用 follow-up selector。

## 测试策略

- Renderer 测试覆盖无仓库发送错误、首问三站发送、同仓库追问不导航主页、DeepWiki 首问/追问 selector 切换、仓库变化创建新会话、导出多轮和单站错误。
- 共享测试覆盖代码站点 DOM 配置和 Markdown formatter。
- 手动验证使用 `obra/superpowers`，确认三站首问和追问路径。

## Spec Patch

- 增补“仓库变化时旧仓库历史不进入当前导出范围”的验收场景。
