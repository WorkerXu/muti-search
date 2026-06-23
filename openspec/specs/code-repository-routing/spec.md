# code-repository-routing Specification

## Purpose
定义代码仓库工作流如何解析 GitHub 仓库输入，并将仓库路由到 Zread、DeepWiki 和 CodeWiki 三个代码阅读站点，同时保持 WebView 安全约束。

## Requirements
### Requirement: GitHub 仓库输入会被归一化

系统 SHALL 接受 `owner/repo` 或 GitHub URL 形式的仓库输入，并将其归一化为 `owner/repo`。

#### Scenario: owner/repo 简写

- **WHEN** 用户输入 `obra/superpowers`
- **THEN** 系统将仓库归一化为 `obra/superpowers`

#### Scenario: 完整 GitHub URL

- **WHEN** 用户输入 `https://github.com/obra/superpowers`
- **THEN** 系统将仓库归一化为 `obra/superpowers`

#### Scenario: 无效仓库输入

- **WHEN** 用户输入无法解析为 GitHub owner 和 repo 的文本
- **THEN** 系统展示校验错误
- **AND** 不导航任何代码站点 WebView

### Requirement: 代码站点会按仓库加载

系统 SHALL 基于归一化仓库生成 Zread、DeepWiki 和 CodeWiki URL，并在代码工作流中加载这些页面。

#### Scenario: 有效仓库输入前不导航远程代码站点

- **WHEN** 用户尚未提交有效仓库输入
- **THEN** 系统不导航任何代码站点 WebView 到远程页面

#### Scenario: 加载 obra/superpowers 页面

- **WHEN** 归一化仓库为 `obra/superpowers`
- **THEN** Zread 页面加载 `https://zread.ai/obra/superpowers`
- **AND** DeepWiki 页面加载 `https://deepwiki.com/obra/superpowers`
- **AND** CodeWiki 页面加载 `https://codewiki.google/github.com/obra/superpowers`

### Requirement: 代码站点 WebView 受到安全约束

系统 SHALL 仅允许已知代码站点 origin、生成后的仓库路径和匹配持久化 partition 对应的代码站点 WebView。

#### Scenario: 有效代码站点配置

- **WHEN** 代码站点 WebView 使用生成后的代码站点 URL 和配置的 partition attach
- **THEN** attach 被允许

#### Scenario: 无效代码站点配置

- **WHEN** 代码站点 WebView 使用任意 origin、任意路径或不匹配的 partition attach
- **THEN** attach 被阻止
