## ADDED Requirements

### Requirement: 代码问题会发送到所有代码站点

系统 SHALL 将代码问题发送到当前仓库对应的 Zread、DeepWiki 和 CodeWiki。

#### Scenario: 发送首个问题

- **WHEN** 当前仓库是 `obra/superpowers`
- **AND** 用户在代码问题输入框中输入 `这个项目的核心架构是什么？`
- **THEN** 系统将问题发送到 Zread、DeepWiki 和 CodeWiki
- **AND** 每个站点 entry 记录已发送、生成中、已完成或错误状态

#### Scenario: 缺少仓库

- **WHEN** 用户在选择有效仓库前尝试发送代码问题
- **THEN** 系统展示错误
- **AND** 不执行任何代码站点发送动作

### Requirement: 同仓库问题会追加

系统 SHALL 在仓库未变化时，将追问追加到现有代码站点会话。

#### Scenario: 追问保留现有页面

- **WHEN** 当前仓库仍为 `obra/superpowers`
- **AND** 用户发送第二个代码问题
- **THEN** 系统发送前不会把代码站点导航回仓库首页
- **AND** 本地历史包含两个问题轮次

#### Scenario: DeepWiki 追问使用搜索会话

- **WHEN** DeepWiki 在首问后已经从 `/obra/superpowers` 导航到 `/search/...` 页面
- **AND** 用户对同一仓库发送追问
- **THEN** 系统使用 `textarea[data-deepwiki-input="followup"]`
- **AND** 不将 DeepWiki 重置为 `https://deepwiki.com/obra/superpowers`

### Requirement: 仓库变化会开启新的代码会话

系统 SHALL 将仓库变化视为新的代码上下文。

#### Scenario: 新仓库导航代码站点

- **WHEN** 用户将仓库从 `obra/superpowers` 改为另一个有效仓库
- **THEN** 系统将 Zread、DeepWiki 和 CodeWiki 导航到新仓库 URL
- **AND** 新问题轮次记录在新仓库上下文下

#### Scenario: 旧仓库历史不进入当前导出范围

- **WHEN** 用户已在 `obra/superpowers` 记录代码问题轮次
- **AND** 用户将仓库切换为另一个有效仓库
- **THEN** 当前仓库的代码问答历史从空状态开始
- **AND** 导出 Markdown 不包含 `obra/superpowers` 的旧问题轮次

### Requirement: 代码问答导出包含全部轮次

系统 SHALL 将当前仓库已记录的全部问题轮次导出为 Markdown。

#### Scenario: 导出多个轮次

- **WHEN** 当前仓库有两个已记录代码问题轮次
- **AND** 用户点击导出
- **THEN** Markdown 包含仓库名
- **AND** 按顺序包含两个问题
- **AND** 每个轮次按 Zread、DeepWiki 和 CodeWiki 分组展示回答或错误

#### Scenario: 导出包含站点错误

- **WHEN** 某个代码站点发送或抽取回答失败
- **THEN** Markdown 在对应轮次中包含该站点的错误或状态
