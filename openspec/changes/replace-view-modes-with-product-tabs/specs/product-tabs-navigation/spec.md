## ADDED Requirements

### Requirement: 产品级 Tab 替代展示模式

系统 SHALL 展示名为“搜索”和“代码”的产品级 Tab，而不是旧的“分屏”和“单站”展示方式控件。

#### Scenario: 默认进入搜索 Tab

- **WHEN** 应用启动
- **THEN** “搜索”Tab 被选中
- **AND** 不展示旧的“分屏”和“单站”控件

#### Scenario: 可以选择代码 Tab

- **WHEN** 用户选择“代码”Tab
- **THEN** 应用展示代码工作流容器
- **AND** 搜索工作流控件不再作为当前主内容显示

### Requirement: 搜索工作流保持可用

系统 SHALL 在“搜索”Tab 下保留现有搜索工作流。

#### Scenario: 搜索控件保持可用

- **WHEN** “搜索”Tab 被选中
- **THEN** 问题输入框、服务控件、状态指示、发送按钮、设置按钮和导出行为保持可用

#### Scenario: 搜索 Tab 使用单站布局

- **WHEN** “搜索”Tab 被选中
- **THEN** 系统展示左侧服务菜单
- **AND** 系统在右侧展示当前选中的单个 AI 网站大 WebView
- **AND** 系统不提供“分屏”总览入口

#### Scenario: 代码占位区不加载远程页面

- **WHEN** 仓库路由尚未实现时用户选择“代码”Tab
- **THEN** 系统展示本地占位状态
- **AND** 本 change 不加载新的代码站点 WebView
