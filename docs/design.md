# muti-search 设计文档

日期：2026-06-18

## 1. 背景

muti-search 是一个本地桌面工具，用于在一个窗口中同时查看多个 AI 官方网页，并把同一个问题一次发送到选中的服务。

最初设想是用本地网页和 iframe 加载 ChatGPT、DeepSeek、Grok 等页面。但多个服务存在 `X-Frame-Options` 或 CSP `frame-ancestors` 限制，普通本地网页 iframe 不可靠。因此第一版改为 Electron 桌面壳，使用多个独立网页视图承载官方网页。

## 2. 设计素材

布局方案对比图：

![布局方案对比](/Users/coderxu/Downloads/已生成图像 1 (1).png)

最终选择：方案 1，`3x3 全景网格`。

## 3. 目标

- 在一个桌面窗口中同时显示 9 个 AI 官方网页。
- 输入一个问题后，一键发送到已选服务。
- 每个服务使用独立持久会话，首次登录后后续复用登录态。
- 保持个人自用、人工触发、低频广播。
- 第一版尽量轻量，不做历史、回答抽取、复杂调试面板或全局自动化。

## 4. 非目标

- 不做普通浏览器 iframe 方案。
- 不绕过登录、验证码、风控或服务限制。
- 不做批量队列、后台循环发送或定时任务。
- 不抽取各家回答内容到统一对比面板。
- 不保存问题历史或回答历史。
- 不提供清理单个服务登录态/缓存的 UI。
- 不做键盘快捷键或全局热键。
- 不面向团队共享或商业分发。

## 5. 服务范围

第一版支持 9 家服务：

| 服务 | 建议入口 | 会话分区 | 初始状态 |
| --- | --- | --- | --- |
| ChatGPT | `https://chatgpt.com` | `persist:chatgpt` | 实验 |
| DeepSeek | `https://chat.deepseek.com` | `persist:deepseek` | 实验 |
| Grok | `https://grok.com` | `persist:grok` | 实验 |
| 豆包 | `https://www.doubao.com/chat/` | `persist:doubao` | 实验 |
| Gemini | `https://gemini.google.com` | `persist:gemini` | 实验 |
| 元宝 | `https://yuanbao.tencent.com` | `persist:yuanbao` | 实验 |
| 千问 | `https://chat.qwen.ai` | `persist:qwen` | 实验 |
| 智谱 | `https://chatglm.cn` | `persist:zhipu` | 实验 |
| Perplexity | `https://www.perplexity.ai` | `persist:perplexity` | 实验 |

说明：所有网页自动发送能力都以 adapter 形式实现。每家网页 DOM、登录状态、风控策略可能变化，因此第一版状态均标记为实验。

## 6. 核心交互

### 6.1 主界面

主界面采用 3x3 全景网格，9 家服务同时可见。

窗口结构：

- 顶部控制区
- 3x3 服务网格
- 每个服务格子的轻量状态条

### 6.2 顶部控制区

顶部控制区包含：

- 一个主问题输入框
- 9 个服务开关
- 一个“发送到已选”按钮

默认 9 家服务全部选中。用户可以临时关闭某个服务，例如该服务未登录、卡验证码、不可用，或当前不想发送给它。

### 6.3 服务格子

每个服务格子包含：

- 服务名
- 开关
- 状态点
- 错误提示
- 官方网页视图

不包含额外操作按钮，例如重试、复制问题、聚焦等。

### 6.4 放大视图

3x3 网格中的任一格可以临时放大查看，再返回 3x3 全景。具体触发方式可以在实现阶段用鼠标双击或标题区点击确定。

第一版不做键盘快捷键。

## 7. 状态模型

每个服务维护独立状态。

建议状态：

- `loading`：页面加载中
- `ready`：页面已加载，等待发送
- `login_required`：疑似需要登录
- `sending`：正在注入并发送问题
- `sent`：已完成发送动作
- `manual_required`：需要人工处理，例如验证码或页面结构不匹配
- `error`：发送失败或页面异常
- `disabled`：用户关闭该服务

状态条展示规则：

- 状态点用于快速区分状态。
- 错误提示只展示简短人话，例如“未找到输入框”“疑似需要登录”“页面加载失败”。
- 不在服务格子内提供恢复按钮。

## 8. 技术架构

### 8.1 桌面壳

使用 Electron。

第一版实现采用 Electron `<webview>`：

- 本地 renderer 负责顶部控制区、3x3 网格、状态条和双击放大。
- 每个 AI 服务使用一个 `<webview>` guest 页面。
- 每个 `<webview>` 使用独立 `persist:<service>` 分区。
- 主进程通过 `will-attach-webview` 校验服务 URL 和 session 分区，并剥离 guest preload。

选择 `<webview>` 的原因是第一版需要在一个本地 HTML renderer 中稳定组合顶部控件、9 个网页视图、服务状态和错误提示。后续如果需要更强的主进程视图编排能力，可以再评估 `BaseWindow + WebContentsView`。

### 8.2 会话隔离

每个服务使用独立持久会话分区：

```text
persist:chatgpt
persist:deepseek
persist:grok
persist:doubao
persist:gemini
persist:yuanbao
persist:qwen
persist:zhipu
persist:perplexity
```

首次使用时，用户需要分别在每个服务中登录。后续由 Electron 持久 session 保留登录态。

### 8.3 自动发送

点击“发送到已选”后：

1. 读取主输入框内容。
2. 找出已启用且被选中的服务。
3. 对每个服务调用对应 adapter。
4. adapter 在对应 `webContents` 中执行隔离脚本。
5. 脚本尝试定位输入框、填入问题、触发输入事件并提交。
6. 如果失败，只更新该服务状态和错误提示。

第一版通过 `<webview>.executeJavaScript(...)` 执行受控 DOM 脚本。主进程不向远程网页暴露 Electron 或 Node API，并在 webview attach 阶段剥离 guest preload、关闭 Node integration、限制初始 URL 和分区。

### 8.4 Adapter 结构

每个服务一个 adapter：

```text
service id
display name
url
partition
input selectors
submit selectors
readiness checks
login checks
send implementation
error mapping
```

第一版不追求所有服务 adapter 一次稳定。UI 应允许单个服务失败，不影响其他服务发送。

## 9. 安全和隐私

### 9.1 Electron 安全基线

远程网页必须按不可信内容处理：

- `nodeIntegration: false`
- `contextIsolation: true`
- 不关闭 `webSecurity`
- 不向远程网页暴露 Electron 或 Node API
- 限制新窗口和外部跳转行为

### 9.2 数据保存策略

第一版不保存：

- 问题历史
- 回答内容
- 发送记录
- 对话摘要

持久化的数据仅为各服务网页自身 session 产生的登录态、cookie、localStorage 等浏览器数据。

### 9.3 使用边界

工具定位为：

- 个人自用
- 人工触发
- 低频广播

不做：

- 批量任务
- 后台自动循环
- 验证码绕过
- 风控规避
- 抓取或转售输出内容

## 10. 风险

### 10.1 网页自动化脆弱

各服务网页 DOM 会变化，输入框和发送按钮选择器可能失效。

缓解：

- adapter 独立维护
- 单个服务失败不阻塞其他服务
- UI 显示简短错误提示

### 10.2 登录和风控

部分服务可能不喜欢 embedded browser，SSO、验证码、Cloudflare challenge 或地区限制可能影响使用。

缓解：

- 保留官方网页原貌
- 不绕过验证
- 将失败标记为需要人工处理

### 10.3 9 格可读性

3x3 同屏在小屏幕上会拥挤。

缓解：

- 支持临时放大单格
- 设计最小窗口尺寸
- 建议在大屏或外接显示器使用

## 11. 第一版验收标准

- 应用可以打开一个 Electron 桌面窗口。
- 顶部显示问题输入框、9 个服务开关和发送按钮。
- 主区域显示 3x3 服务网格。
- 每家服务使用独立持久 session 加载官方网页。
- 用户可以分别完成网页登录。
- 输入问题后，点击发送到已选，会对选中的服务尝试自动填入并发送。
- 某个服务失败时，只更新该服务错误提示，不影响其他服务。
- 不保存问题或回答历史。
- 不提供清理登录态/缓存入口。
- 不提供快捷键。

## 12. 后续阶段

### 阶段 1：Electron 原型

- 搭建 Electron 项目。
- 实现 3x3 `<webview>` 布局。
- 实现顶部控制区。
- 加载 9 家官方网页。
- 实现持久 session 分区。

### 阶段 2：发送 Adapter

- 为每家服务写最小发送 adapter。
- 加入状态点和错误提示。
- 验证单家失败不影响其他服务。

### 阶段 3：体验打磨

- 临时放大单格。
- 调整最小窗口尺寸和响应式布局。
- 增强登录状态识别。
- 梳理错误文案。

## 13. 暂不处理的问题

- 是否支持 Claude、Kimi、通义网页版以外入口等更多服务。
- 是否自动提取回答内容。
- 是否保存发送历史。
- 是否提供开发调试面板。
- 是否提供清理单个服务 session 的设置项。
- 是否打包分发。
