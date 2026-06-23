## 1. 测试

- [x] 1.1 增加 renderer 测试，覆盖默认选中“搜索”Tab 以及可切换到“代码”Tab。
- [x] 1.2 更新 renderer 测试，移除对“分屏”和旧 view-mode data attribute 的断言。
- [x] 1.3 增加回归测试，确认“搜索”Tab 下现有搜索控件仍然可用。

## 2. Renderer 实现

- [x] 2.1 用产品 Tab 状态替换 `ViewMode` 状态。
- [x] 2.2 将顶部控件替换为“搜索”和“代码”Tab 按钮。
- [x] 2.3 将现有搜索控件和 pane 移入搜索工作流容器。
- [x] 2.4 增加本地代码工作流占位区，不加载远程 WebView。
- [x] 2.5 移除旧分屏/grid 用户可见布局路径。

## 3. 样式与文档

- [x] 3.1 更新产品 Tab 对应的 CSS selector 和布局。
- [x] 3.2 移除不再可达的旧分屏样式。
- [x] 3.3 更新 README 和设计文档，描述“搜索 / 代码”结构。

## 4. 验证

- [x] 4.1 Run `npm run typecheck`.
- [x] 4.2 Run `npm test`.
- [x] 4.3 Run `npm run build`.
