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
