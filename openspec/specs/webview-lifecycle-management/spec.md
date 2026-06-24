# webview-lifecycle-management Specification

## Purpose
定义 muti-search 中搜索与代码工作流 WebView 的按需加载、发送前加载、非活跃释放和本地状态保留要求，降低启动与后台资源占用，同时保留持久化会话。

## Requirements
### Requirement: WebView 按需加载

系统 SHALL 避免在应用启动时加载所有搜索和代码 WebView。

#### Scenario: 启动时不急切导航所有 WebView

- **WHEN** 应用启动
- **THEN** 暂不需要的远程 WebView 保持未加载
- **AND** 它们不会仅因为应用初始化就收到 `src` 导航

### Requirement: 必需 WebView 使用前加载

系统 SHALL 在发送问题或展示选中的远程页面前加载对应 WebView。

#### Scenario: 搜索发送加载已选服务

- **WHEN** 用户向已选服务发送搜索问题
- **THEN** 每个已选服务 WebView 在发送脚本运行前完成加载
- **AND** 未选服务不会仅因为此次发送而加载

#### Scenario: 代码仓库加载代码站点

- **WHEN** 用户在代码工作流中打开有效仓库
- **THEN** 该仓库需要的代码站点 WebView 根据生命周期策略被加载或预热

### Requirement: 非活跃 WebView 可以释放

系统 SHALL 在非活跃 WebView 不属于预热策略范围时释放它们。

#### Scenario: 切走后释放非活跃工作流

- **WHEN** 用户从一个没有待处理发送的工作流切走
- **THEN** 不在预热集合中的 WebView 被释放或标记为未加载
- **AND** 持久化 partition 保持完整，以便未来重新加载

#### Scenario: 待处理发送不会被打断

- **WHEN** 某个 WebView 正在执行发送操作
- **THEN** 生命周期管理器在该操作完成、失败或取消前不释放该 WebView

### Requirement: 本地状态在 WebView 释放后保留

系统 SHALL 在 WebView 被释放后仍保留导出所需的本地用户可见状态。

#### Scenario: 代码历史仍可导出

- **WHEN** 已完成代码问题后代码站点 WebView 被释放
- **THEN** 本地代码问答历史仍可用于 Markdown 导出
