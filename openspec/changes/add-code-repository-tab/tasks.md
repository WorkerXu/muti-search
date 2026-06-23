## 1. 测试

- [ ] 1.1 增加共享测试，覆盖 `owner/repo`、GitHub URL、`.git` 后缀和无效输入解析。
- [ ] 1.2 增加共享测试，确认 `obra/superpowers` 会生成预期的 Zread、DeepWiki 和 CodeWiki URL。
- [ ] 1.3 增加主进程测试，覆盖代码站点 WebView 白名单与 partition 匹配。
- [ ] 1.4 增加 renderer 测试，覆盖输入仓库并渲染三个代码站点 pane。

## 2. 共享代码站点模型

- [ ] 2.1 增加 Zread、DeepWiki 和 CodeWiki 的代码站点定义。
- [ ] 2.2 增加仓库输入归一化与校验 helper。
- [ ] 2.3 增加三个代码站点的 URL 构造器。
- [ ] 2.4 为代码站点增加独立持久化 partition。

## 3. 主进程安全

- [ ] 3.1 扩展 WebView config 校验，允许生成后的代码站点 URL。
- [ ] 3.2 拒绝任意 origin、无效仓库路径和不匹配的代码站点 partition。

## 4. Renderer 集成

- [ ] 4.1 在代码 Tab 中增加仓库输入框和提交动作。
- [ ] 4.2 渲染三个代码站点 pane，并展示名称、状态和错误。
- [ ] 4.3 仅在仓库输入有效后导航代码站点 WebView。
- [ ] 4.4 展示校验错误时不导航现有页面。

## 5. 验证

- [ ] 5.1 Run `npm run typecheck`.
- [ ] 5.2 Run `npm test`.
- [ ] 5.3 Run `npm run build`.
