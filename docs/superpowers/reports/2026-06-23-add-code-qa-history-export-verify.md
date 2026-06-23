# add-code-qa-history-export 验证报告

日期：2026-06-23

## 结论

验证通过。`add-code-qa-history-export` 的 21/21 个 OpenSpec 任务已完成，核心实现符合 proposal、design、delta spec 和实施计划。代码问答历史、同仓库追问、仓库切换重置、Markdown 导出、CodeWiki 真实 DOM 发送/抽取、单站错误记录和超时保护均有实现与测试覆盖。

## 检查结果

| 维度 | 状态 | 证据 |
| --- | --- | --- |
| 完整性 | 通过 | OpenSpec apply 进度为 21/21；`tasks.md` 全部勾选 |
| 正确性 | 通过 | 三站发送、同仓库追问、仓库切换、导出错误/生成中状态均有测试覆盖 |
| 一致性 | 通过 | DOM 规则集中在 `src/shared/codeQa.ts`，renderer 只消费共享 builder |
| 安全 | 通过 | 未新增密钥、凭据、外部写文件路径或危险 shell 调用 |

## 命令验证

- `npm run typecheck`：通过
- `npm test`：通过，7 个测试文件、95 个测试
- `npm run build`：通过
- Comet build guard：通过，进入 verify 阶段

## 真实应用验证

使用 `./node_modules/.bin/electron --remote-debugging-port=9333 .` 启动 packaged/file 模式，并通过 CDP 验证 `obra/superpowers` 首问流程：

- DeepWiki：完成回答，并进入 `/search/...` 会话页。
- CodeWiki：先激活 `button[aria-label="Toggle chat"]`，再通过 `#message-textarea` 与 `button[data-test-id="send-message-button"]` 发送；从 `[data-test-id="agent-message"]` 抽取到完整回答。
- Zread：当前跳转到 `chat.z.ai/auth?sso_redirect=...` 登录页；单站脚本在 20 秒超时后记录为错误，不阻塞 DeepWiki、CodeWiki 或导出按钮。
- 导出按钮：在问题轮次创建后可用，即使单站仍在发送或超时中，也可导出当前仓库历史。

## Code Review 处理

Reviewer 发现 2 个 Important 问题，均已修复：

1. 导出按钮被最慢站点阻塞，且旧仓库 in-flight 请求可能在切库后重新显示导出按钮。
   - 修复：在创建 round 后立即显示导出按钮，移除异步完成后的无条件显示。
   - 回归测试：`does not let an old in-flight code question reveal export after repository changes`。

2. `empty + isBusy` 持续到轮询结束时被误标为 `error`。
   - 修复：轮询耗尽后若最后结果仍为 `empty + isBusy`，保留为 `generating`。
   - 回归测试：`keeps a code site generating when answer extraction stays busy but empty`。

## 风险与备注

- 三方网页 DOM 仍可能变化；实现已将选择器集中在 `src/shared/codeQa.ts`，方便后续维护。
- Zread 当前需要登录或外部跳转，不作为本地自动化失败处理；应用会记录单站错误并保留其他站点结果。
- 当前历史仍是当前仓库会话内存态，符合本 change 的非目标：不做跨仓库恢复或磁盘持久化。

## 归档准备

无 Critical 或 Important 遗留问题。分支处理完成后，可运行 Comet verify guard 推进到 archive 阶段。
