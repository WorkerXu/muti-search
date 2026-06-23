## 1. 测试

- [x] 1.1 增加共享测试，覆盖 `owner/repo`、GitHub URL、`.git` 后缀和无效输入解析。
- [x] 1.2 增加共享测试，确认 `obra/superpowers` 会生成预期的 Zread、DeepWiki 和 CodeWiki URL。
- [x] 1.3 增加主进程测试，覆盖代码站点 WebView 白名单与 partition 匹配。
- [x] 1.4 增加 renderer 测试，覆盖输入仓库并渲染三个代码站点 pane。

## 2. 共享代码站点模型

- [x] 2.1 增加 Zread、DeepWiki 和 CodeWiki 的代码站点定义。
- [x] 2.2 增加仓库输入归一化与校验 helper。
- [x] 2.3 增加三个代码站点的 URL 构造器。
- [x] 2.4 为代码站点增加独立持久化 partition。

## 3. 主进程安全

- [x] 3.1 扩展 WebView config 校验，允许生成后的代码站点 URL。
- [x] 3.2 拒绝任意 origin、无效仓库路径和不匹配的代码站点 partition。

## 4. Renderer 集成

- [x] 4.1 在代码 Tab 中增加仓库输入框和提交动作。
- [x] 4.2 渲染三个代码站点 pane，并展示名称、状态和错误。
- [x] 4.3 仅在仓库输入有效后导航代码站点 WebView。
- [x] 4.4 展示校验错误时不导航现有页面。

## 5. 验证

- [x] 5.1 Run `npm run typecheck`.
- [x] 5.2 Run `npm test`.
- [x] 5.3 Run `npm run build`.
