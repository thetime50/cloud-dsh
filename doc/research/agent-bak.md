# 迭代为DSH实现DIFY

可以让仅跑一个DSH容器
用户可创建多个工作区，工作区和用户绑定,工作区权限在内部，限制工作区内容大小(一个用户或者工作区动态分一个环境内磁盘出来)
DSH已有工作区内权限控制
用户可以使用的
1. 基础agent会话 安全的全功能基础agent
2. app agent会话 有限的能力,旨在实现指定的功能需求

能力	限制策略
Python/Node.js/Shell	立沙箱内执行限制 CPU、内存、执行时间 (可开关)
文件读取	仅允许用户自己的工作空间
文件写入	自己的工作空间限制目录、磁盘容量 （区分用户只读区域(数据 文件归档等 不可见)和读写区域）
网络访问	通过受控代理访问，流量限制 (请求来源：砂箱 浏览器，可以知道来源的worker)
浏览器 通过代理，给一个轻量无头浏览器限制资源 用户context隔离 只允许有限的安全的操作
MCP 默认禁止	白名单、工具级权限 工作区级安装 (注意区分客户需求能力和框架基础设施能力(数据库 rag),基础设施的关键信息(密钥 端口)和多余指令不要暴露出去) 
  (用户安装mcp预留/当前禁止，做好基础设施能力的管控(用一个公共的窗口plugn实现))
Skill	允许生成，但脚本必须沙箱执行 工作区级安装
DSH Plugin	默认禁止 白名单(系统内的安全镜像) 工作区级安装 (预留/当前禁止处理)
SubAgent	限制数量、递归深度
后台任务	限制并发、运行时间
网络、CPU、内存、磁盘配额	容器监控 限制 只需要知道哪个任务占用大 网络请求多，来自哪个工作区就可以了
LLM	Token 用户自己的token 配额、费用上限
API Key	服务端托管，禁止脚本读取

- 0.0.0 实现功能，不管权限
  - DSH 数据 提醒 文件 rag 通知 其他全禁止
- 0.1.0 基本权限和功能
- 0.2.0 完整权限和功能

----


这个方案可行。建议将其定义为 单 DSH 实例、多租户工作区、能力级权限控制、按需沙箱执行架构。

核心是将 DSH 作为可信的 Agent 调度层，而不是用户代码的执行环境。

## 一、整体架构

## 二、资源与权限模型
```
\#chatgpt-mermaid-\_r_3fi\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(13, 13, 13);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_3fi\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_3fi\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_3fi\_ .error-icon{fill:rgb(243, 243, 243);}#chatgpt-mermaid-\_r_3fi\_ .error-text{fill:rgb(13, 13, 13);stroke:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_3fi\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_3fi\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_3fi\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_3fi\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_3fi\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_3fi\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_3fi\_ .marker{fill:rgb(143, 143, 143);stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_3fi\_ .marker.cross{stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_3fi\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-\_r_3fi\_ p{margin:0;}#chatgpt-mermaid-\_r_3fi\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_3fi\_ .cluster-label text{fill:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_3fi\_ .cluster-label span{color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_3fi\_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-\_r_3fi\_ .label text,#chatgpt-mermaid-\_r_3fi\_ span{fill:rgb(13, 13, 13);color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_3fi\_ .node rect,#chatgpt-mermaid-\_r_3fi\_ .node circle,#chatgpt-mermaid-\_r_3fi\_ .node ellipse,#chatgpt-mermaid-\_r_3fi\_ .node polygon,#chatgpt-mermaid-\_r_3fi\_ .node path{fill:rgb(222, 234, 251);stroke:rgb(83, 154, 248);stroke-width:1px;}#chatgpt-mermaid-\_r_3fi\_ .rough-node .label text,#chatgpt-mermaid-\_r_3fi\_ .node .label text,#chatgpt-mermaid-\_r_3fi\_ .image-shape .label,#chatgpt-mermaid-\_r_3fi\_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-\_r_3fi\_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-\_r_3fi\_ .rough-node .label,#chatgpt-mermaid-\_r_3fi\_ .node .label,#chatgpt-mermaid-\_r_3fi\_ .image-shape .label,#chatgpt-mermaid-\_r_3fi\_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-\_r_3fi\_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-\_r_3fi\_ .root .anchor path{fill:rgb(143, 143, 143)!important;stroke-width:0;stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_3fi\_ .arrowheadPath{fill:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_3fi\_ .edgePath .path{stroke:rgb(143, 143, 143);stroke-width:1px;}#chatgpt-mermaid-\_r_3fi\_ .flowchart-link{stroke:rgb(143, 143, 143);fill:none;}#chatgpt-mermaid-\_r_3fi\_ .edgeLabel{background-color:rgb(252, 252, 252);text-align:center;}#chatgpt-mermaid-\_r_3fi\_ .edgeLabel p{background-color:rgb(252, 252, 252);}#chatgpt-mermaid-\_r_3fi\_ .edgeLabel rect{opacity:0.5;background-color:rgb(252, 252, 252);fill:rgb(252, 252, 252);}#chatgpt-mermaid-\_r_3fi\_ .labelBkg{background-color:rgba(252, 252, 252, 0.5);}#chatgpt-mermaid-\_r_3fi\_ .cluster rect{fill:rgb(243, 243, 243);stroke:rgba(0, 0, 0, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_3fi\_ .cluster text{fill:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_3fi\_ .cluster span{color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_3fi\_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(243, 243, 243);border:1px solid rgba(0, 0, 0, 0.1);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-\_r_3fi\_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_3fi\_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-\_r_3fi\_ .icon-shape,#chatgpt-mermaid-\_r_3fi\_ .image-shape{background-color:rgb(252, 252, 252);text-align:center;}#chatgpt-mermaid-\_r_3fi\_ .icon-shape p,#chatgpt-mermaid-\_r_3fi\_ .image-shape p{background-color:rgb(252, 252, 252);padding:2px;}#chatgpt-mermaid-\_r_3fi\_ .icon-shape .label rect,#chatgpt-mermaid-\_r_3fi\_ .image-shape .label rect{opacity:0.5;background-color:rgb(252, 252, 252);fill:rgb(252, 252, 252);}#chatgpt-mermaid-\_r_3fi\_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-\_r_3fi\_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-\_r_3fi\_ .node .neo-node{stroke:rgb(83, 154, 248);}#chatgpt-mermaid-\_r_3fi\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_3fi\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_3fi\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_3fi\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_3fi\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_3fi\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_3fi\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_3fi\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_3fi\_ [data-look="neo"].node .neo-line path{stroke:rgb(83, 154, 248);filter:none;}#chatgpt-mermaid-\_r_3fi\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_3fi\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_3fi\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_3fi\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_3fi\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_3fi\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_3fi\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_3fi\_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(0, 79, 153);}#chatgpt-mermaid-\_r_3fi\_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(0, 79, 153);}#chatgpt-mermaid-\_r_3fi\_ .node tspan[font-weight="normal"],#chatgpt-mermaid-\_r_3fi\_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-\_r_3fi\_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(245, 250, 255);stroke:rgb(206, 219, 229);stroke-width:1px;}#chatgpt-mermaid-\_r_3fi\_ .node rect,#chatgpt-mermaid-\_r_3fi\_ .node circle,#chatgpt-mermaid-\_r_3fi\_ .node ellipse,#chatgpt-mermaid-\_r_3fi\_ .node polygon,#chatgpt-mermaid-\_r_3fi\_ .node path{fill:rgb(229, 243, 255);stroke:rgba(0, 0, 0, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_3fi\_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-\_r_3fi\_ .mermaid-decision .label-container{fill:rgb(245, 250, 255);stroke:rgb(206, 219, 229);stroke-dasharray:2,2;}#chatgpt-mermaid-\_r_3fi\_ .edgePaths .flowchart-link{stroke:rgb(143, 143, 143);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-\_r_3fi\_ .marker{fill:rgb(143, 143, 143);stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_3fi\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}UserWorkspace 1..NSession 1..NSkillsMCPStorageWorkspace PolicyAgent Profile基础 AgentApp AgentTaskSandbox / Browser Worker
```
建议权限采用交集模型：

实际权限 = 平台权限 ∩ 用户权限 ∩ 工作区权限 ∩ Agent 权限 ∩ 任务权限

下级只能缩小权限，不能扩大权限。

## 三、完整能力管控清单

| 能力                    | 限制策略                   | 实现层                    |
| --------------------- | ---------------------- | ---------------------- |
| Python / Node / Shell | 按需沙箱、资源限制、独立开关         | Sandbox                |
| 文件读取                  | 工作区隔离、目录白名单            | File Service / Sandbox |
| 文件写入                  | 可写目录、磁盘配额              | File Service / Sandbox |
| 网络访问                  | 强制代理、域名/IP限制、流量配额      | Network Gateway        |
| 浏览器                   | 独立浏览器上下文或进程、资源限制、操作白名单 | Browser Pool           |
| MCP                   | 默认禁止、工作区级授权、Tool级白名单   | MCP Gateway            |
| Skill                 | 工作区级安装、允许生成、脚本沙箱执行     | DSH + Sandbox          |
| DSH Plugin            | 默认禁止、仅平台审核插件           | DSH                    |
| SubAgent              | 数量、递归深度、权限继承           | DSH                    |
| 后台任务                  | 并发、运行时间、任务取消           | Scheduler              |
| CPU / 内存              | 用户、工作区、任务级配额           | Worker / cgroups       |
| 磁盘                    | 用户总配额、工作区子配额           | Storage                |
| LLM                   | Token、费用、模型白名单         | Model Gateway          |
| API Key               | 服务端托管、禁止脚本访问           | Secret Manager         |
| 基础设施                  | 仅暴露业务接口                | Internal MCP / Tool    |

## 四、工作区存储设计

不需要每个工作区创建独立磁盘，可以使用文件系统的目录级配额。

```
/storage/
  users/
    user-001/
      workspace-001/
        files/          # Agent 可读写
        skills/         # Skill
        readonly/       # Agent 只读
      workspace-002/
        ...
/private/
  archives/             # 仅内部服务访问
  sessions/             # 会话持久化
  infrastructure/       # 基础设施配置
```

| 存储方案              | 特点         |
| ----------------- | ---------- |
| XFS Project Quota | 目录级配额，推荐   |
| Btrfs Subvolume   | 子卷隔离、配额、快照 |
| ZFS Dataset       | 独立配额、快照    |
| S3 / MinIO        | 适合归档及非本地文件 |

注意：只读区域与不可见区域是不同的权限。 不可见区域不能挂载到用户沙箱中。

## 五、两种 Agent 模式

基础 Agent

通用、安全的个人工作助手

- 通用对话
- 沙箱脚本
- 文件处理
- 受控网络
- 浏览器
- Skill 创建
- 授权 MCP
- SubAgent

App Agent

针对特定业务的应用助手

- 专用 System Prompt
- 指定 Skills
- 指定 MCP Tools
- 指定知识库
- 独立能力配置
- 独立资源配额
- 默认关闭通用执行能力

两者共用 Agent Runtime，通过 `AgentProfile` 控制能力，而不需要独立部署 DSH。

## 六、资源监控与追踪

所有任务及工具调用统一携带以下上下文：

```
interface ExecutionContext {
  userId: string;
  workspaceId: string;
  sessionId: string;
  agentId: string;
  taskId: string;
  workerId: string;
  traceId: string;
}
```

通过该上下文统计：

- CPU 使用时间、内存峰值、磁盘占用。
- 网络请求次数、上传下载流量。
- 脚本、浏览器、MCP 调用情况。
- LLM Token 消耗与费用。

网络代理根据 Worker 的可信身份识别请求来源，而不是信任脚本自行传入的 `workspaceId`。

## 七、DSH 原生能力与需要开发的能力

| 模块                 | 实现方式              |
| ------------------ | ----------------- |
| Agent Loop         | DSH 原生            |
| Session / SubAgent | DSH 原生 + 限制扩展     |
| Skill / MCP        | DSH 原生 + 租户隔离改造   |
| 工作区权限              | DSH 原生能力 + 强制隔离扩展 |
| 用户与工作区管理           | 自行开发              |
| AgentProfile       | 自行封装              |
| Policy Engine      | 自行开发              |
| 脚本沙箱               | 集成外部执行器           |
| Browser Pool       | 集成 Playwright 等   |
| Network Gateway    | 独立代理服务            |
| Storage Quota      | 文件系统配额            |
| 基础设施 MCP           | 自行封装              |
| 资源计量与审计            | 自行开发              |

## 八、关键安全边界

你的设计中有三个需要特别注意的地方：

1. DSH 工作区权限不等于多租户安全隔离。 必须确保所有文件、会话、Skill、工具调用都经过租户鉴权。
2. 工作区级 DSH Plugin 不等于插件级隔离。 插件如果运行在共享 DSH 进程中，可能访问其他用户数据。因此现阶段禁止用户安装是正确的。
3. 共享 DSH 容器无法直接实现精确的工作区级 CPU、内存限制。 脚本和浏览器应由独立 Worker 执行，通过任务级 cgroups 实现计量与限制。

上述 DSH 原生能力的具体扩展接口还需要结合源码验证，目前属于架构设计，并非已经验证可直接配置实现的部署方案。

最终建议：一个 DSH 容器负责所有用户的 Agent 调度，共享基础设施服务，按任务动态分配隔离执行环境，而不是按用户分配容器。



# RAGflow部署资源分析
RAGflow部署占用资源分布分析，（xx模块支持(如数据库/向量数据库) - xx资源）
阿里云有没有Ragflow服务，可全量导出迁移。对比市面上用量最大价格最低的Ragflow

## **一、RAGFlow 资源占用分布**

RAGFlow 不是单一服务，而是一套完整的文档处理、存储和检索系统。

\#chatgpt-mermaid-\_r_2n6\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(13, 13, 13);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_2n6\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_2n6\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_2n6\_ .error-icon{fill:rgb(243, 243, 243);}#chatgpt-mermaid-\_r_2n6\_ .error-text{fill:rgb(13, 13, 13);stroke:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_2n6\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_2n6\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_2n6\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_2n6\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_2n6\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_2n6\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_2n6\_ .marker{fill:rgb(143, 143, 143);stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_2n6\_ .marker.cross{stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_2n6\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-\_r_2n6\_ p{margin:0;}#chatgpt-mermaid-\_r_2n6\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_2n6\_ .cluster-label text{fill:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_2n6\_ .cluster-label span{color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_2n6\_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-\_r_2n6\_ .label text,#chatgpt-mermaid-\_r_2n6\_ span{fill:rgb(13, 13, 13);color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_2n6\_ .node rect,#chatgpt-mermaid-\_r_2n6\_ .node circle,#chatgpt-mermaid-\_r_2n6\_ .node ellipse,#chatgpt-mermaid-\_r_2n6\_ .node polygon,#chatgpt-mermaid-\_r_2n6\_ .node path{fill:rgb(222, 234, 251);stroke:rgb(83, 154, 248);stroke-width:1px;}#chatgpt-mermaid-\_r_2n6\_ .rough-node .label text,#chatgpt-mermaid-\_r_2n6\_ .node .label text,#chatgpt-mermaid-\_r_2n6\_ .image-shape .label,#chatgpt-mermaid-\_r_2n6\_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-\_r_2n6\_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-\_r_2n6\_ .rough-node .label,#chatgpt-mermaid-\_r_2n6\_ .node .label,#chatgpt-mermaid-\_r_2n6\_ .image-shape .label,#chatgpt-mermaid-\_r_2n6\_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-\_r_2n6\_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-\_r_2n6\_ .root .anchor path{fill:rgb(143, 143, 143)!important;stroke-width:0;stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_2n6\_ .arrowheadPath{fill:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_2n6\_ .edgePath .path{stroke:rgb(143, 143, 143);stroke-width:1px;}#chatgpt-mermaid-\_r_2n6\_ .flowchart-link{stroke:rgb(143, 143, 143);fill:none;}#chatgpt-mermaid-\_r_2n6\_ .edgeLabel{background-color:rgb(252, 252, 252);text-align:center;}#chatgpt-mermaid-\_r_2n6\_ .edgeLabel p{background-color:rgb(252, 252, 252);}#chatgpt-mermaid-\_r_2n6\_ .edgeLabel rect{opacity:0.5;background-color:rgb(252, 252, 252);fill:rgb(252, 252, 252);}#chatgpt-mermaid-\_r_2n6\_ .labelBkg{background-color:rgba(252, 252, 252, 0.5);}#chatgpt-mermaid-\_r_2n6\_ .cluster rect{fill:rgb(243, 243, 243);stroke:rgba(0, 0, 0, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_2n6\_ .cluster text{fill:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_2n6\_ .cluster span{color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_2n6\_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(243, 243, 243);border:1px solid rgba(0, 0, 0, 0.1);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-\_r_2n6\_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_2n6\_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-\_r_2n6\_ .icon-shape,#chatgpt-mermaid-\_r_2n6\_ .image-shape{background-color:rgb(252, 252, 252);text-align:center;}#chatgpt-mermaid-\_r_2n6\_ .icon-shape p,#chatgpt-mermaid-\_r_2n6\_ .image-shape p{background-color:rgb(252, 252, 252);padding:2px;}#chatgpt-mermaid-\_r_2n6\_ .icon-shape .label rect,#chatgpt-mermaid-\_r_2n6\_ .image-shape .label rect{opacity:0.5;background-color:rgb(252, 252, 252);fill:rgb(252, 252, 252);}#chatgpt-mermaid-\_r_2n6\_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-\_r_2n6\_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-\_r_2n6\_ .node .neo-node{stroke:rgb(83, 154, 248);}#chatgpt-mermaid-\_r_2n6\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_2n6\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_2n6\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_2n6\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_2n6\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_2n6\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_2n6\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_2n6\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_2n6\_ [data-look="neo"].node .neo-line path{stroke:rgb(83, 154, 248);filter:none;}#chatgpt-mermaid-\_r_2n6\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_2n6\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_2n6\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_2n6\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_2n6\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_2n6\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_2n6\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_2n6\_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(0, 79, 153);}#chatgpt-mermaid-\_r_2n6\_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(0, 79, 153);}#chatgpt-mermaid-\_r_2n6\_ .node tspan[font-weight="normal"],#chatgpt-mermaid-\_r_2n6\_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-\_r_2n6\_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(245, 250, 255);stroke:rgb(206, 219, 229);stroke-width:1px;}#chatgpt-mermaid-\_r_2n6\_ .node rect,#chatgpt-mermaid-\_r_2n6\_ .node circle,#chatgpt-mermaid-\_r_2n6\_ .node ellipse,#chatgpt-mermaid-\_r_2n6\_ .node polygon,#chatgpt-mermaid-\_r_2n6\_ .node path{fill:rgb(229, 243, 255);stroke:rgba(0, 0, 0, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_2n6\_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-\_r_2n6\_ .mermaid-decision .label-container{fill:rgb(245, 250, 255);stroke:rgb(206, 219, 229);stroke-dasharray:2,2;}#chatgpt-mermaid-\_r_2n6\_ .edgePaths .flowchart-link{stroke:rgb(143, 143, 143);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-\_r_2n6\_ .marker{fill:rgb(143, 143, 143);stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_2n6\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}RAGFlow API / WebTask Executor · 文档解析 /切片MySQL · 业务数据库Redis · 缓存 / 任务队列MinIO · 文件存储Elasticsearch / InfinityEmbedding / Rerank API

### **各模块资源估算**

以传统 Python 版本 RAGFlow、10 万文档切片、低并发、远程模型 API 为例：

| 模块     | 支持服务          | CPU     | 内存         | 主要用途         |
| ------ | ------------- | ------- | ---------- | ------------ |
| 检索引擎   | Elasticsearch | 2～4 核   | 4～8 GB     | 向量、全文索引      |
| 文档处理   | Task Executor | 2～4 核   | 2～6 GB     | PDF解析、OCR、切片 |
| 主服务    | RAGFlow API   | 1 核     | 0.5～2 GB   | 业务逻辑、检索调度    |
| 业务数据库  | MySQL         | 0.5～1 核 | 0.5～1 GB   | 用户、知识库、任务    |
| 缓存及队列  | Redis         | 0.2 核   | 128～512 MB | 任务调度         |
| 文件存储   | MinIO         | 0.5 核   | 256～512 MB | 原文、图片        |
| Web 服务 | Nginx         | 0.1 核   | 64 MB      | Web访问        |

各模块 CPU 是活跃时的预算，不代表需要永久独占这些核心。内存是工程估算，并非官方逐模块压测数据。

### **典型 16 GB 服务器内存预算**

| 资源 | 内存 | 比例 |
| --- | --- | --- |
| Elasticsearch | 6 GB | 37.5% |
| 文档解析 | 4 GB | 25.0% |
| RAGFlow API | 1.5 GB | 9.4% |
| MySQL | 1 GB | 6.3% |
| Redis / MinIO / Nginx | 0.8 GB | 5.0% |
| 系统与剩余空间 | 2.7 GB | 16.9% |

**内存消耗最大的两个模块是检索引擎和文档解析，合计约占上述预算的 62.5%。**

新版 RAGFlow 1.x 的 Go 部署架构还引入了 Kvrocks、NATS、ClickHouse 等组件，具体取决于启用的服务配置，不能直接套用旧版本预算。

[image](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub+1



## **二、将资源密集模块迁移到云端**

| RAGFlow 模块    | 可替代的云服务                  | 是否需要适配开发    |
| ------------- | ------------------------ | ----------- |
| MySQL         | 阿里云 RDS MySQL            | 通常不需要       |
| Elasticsearch | 阿里云 Elasticsearch        | 需验证版本及连接    |
| Redis         | 阿里云 Tair                 | 需验证兼容性      |
| MinIO         | 阿里云 OSS                  | 需验证存储适配     |
| Embedding     | 阿里云百炼                    | 配置即可        |
| 向量检索引擎        | OSS Vectors / DashVector | 需要开发适配层     |
| 文档解析          | 云端解析 API                 | 需要适配或采用已有集成 |

需要注意，逐个购买托管数据库服务，固定费用可能比直接购买一台 16 GB ECS 更高。

## **三、阿里云 RAGFlow 服务**

阿里云有两种不同的部署方案。

[DTS data transmission Vector Icons free download in SVG, PNG Format](https://images.openai.com/static-rsc-4/yWgK84SsKiKBMc8yoyLrKodEVQiTJM_pJabIrAKzeXV-Bjs6BzXUVpUH6D4K9wiC6rqt7SINNdIhwLqIZP4MWNCJdE2itO9FftSQUoY9vxst_DWeQ0aoGANN5y8iD3ZWkWL6RggstOH6Qv3Y6e_y_nifqId6SnLemaPz3Xoau8M?purpose=inline)

**阿里云 DTS RAGFlow 知识库**

真正的托管 RAGFlow 服务，支持使用 AnalyticDB PostgreSQL、PolarDB pgvector、Lindorm 等向量数据库。

[官方文档](https://help.aliyun.com/zh/dts/user-guide/create-and-use-a-ragflow-instance?utm_source=chatgpt.com)

| 计费项         | 中国大陆价格     |
| ----------- | ---------- |
| 基础服务        | ¥1.7273/小时 |
| 数据准备服务      | ¥1.7273/小时 |
| 基础服务单独运行30天 | ¥1,243.66  |
| 两项均运行30天    | ¥2,487.31  |
| 向量数据库       | 额外收费       |
| OSS         | 额外收费       |
| 内置模型、增强解析   | 额外收费       |

首次购买提供15天免费试用。

[image](https://www.google.com/s2/favicons?domain=https://help.aliyun.com\&sz=32)

help.aliyun.com+1



**价格很高，不适合你的初期小规模部署。** 按量付费在这里是按服务运行时长计费，并非仅按实际检索次数计费。

[Alibaba Cloud Community](https://images.openai.com/static-rsc-4/bD-waq2ipMCI9msH2eiig2C9YgBlvmtkiSh3sj4dR4VTsESaZFNzGjSvAVRyQ2E6NRsiyI6fg8ZH2tZXcwrbGTKz1Kx0FX3pRGnepa0L37cuYE78XKcAvJ7sfTZQyLHSO_Jy5D3cPfTwe82wEC8AKpMrWSapYJqBzt_xpg72gG8?purpose=inline)

**阿里云计算巢 RAGFlow 社区版**

一键在自己的 ECS 上部署开源版本，软件免费，只收服务器、磁盘、带宽费用。

[官方部署文档](https://help.aliyun.com/zh/compute-nest/use-cases/ragflow-community-edition-service-instance-deployment-document?utm_source=chatgpt.com)

支持自行控制服务器和底层数据，因此更容易完整备份和迁移。

[image](https://www.google.com/s2/favicons?domain=https://help.aliyun.com\&sz=32)

help.aliyun.com



## **四、市面上 RAGFlow 云服务价格对比**

| 服务                                                                                                 | 起步价格     | API | 完整底层数据控制 |
| -------------------------------------------------------------------------------------------------- | -------- | --- | -------- |
| [RAGFlow Cloud Free](https://cloud.ragflow.io?utm_source=chatgpt.com)                              | 免费       | 不支持 | 否        |
| [RAGFlow Cloud Starter](https://ragflow.io/?utm_source=chatgpt.com)                                | $29/月    | 支持  | 否        |
| RAGFlow Cloud Pro                                                                                  | $129/月   | 支持  | 否        |
| [Elestio](https://elest.io/open-source/ragflow/resources/plans-and-pricing?utm_source=chatgpt.com) | 按服务器规格计费 | 支持  | 需确认备份权限  |
| 阿里云计算巢                                                                                             | ECS价格    | 支持  | 是        |
| 阿里云 DTS                                                                                            | ¥1244/月起 | 支持  | 部分       |
| 自行购买 VPS 部署                                                                                        | VPS价格    | 支持  | 是        |

[image](https://www.google.com/s2/favicons?domain=https://ragflow.io\&sz=32)

ragflow\.io+3

其中，**RAGFlow 官方 Cloud 是目前查到具有明确低价订阅、且支持 API 的托管方案。**

### **官方 Cloud 套餐**

|            | Free   | Starter | Pro   |
| ---------- | ------ | ------- | ----- |
| 月费         | $0     | $29     | $129  |
| 知识库存储      | 0.1 GB | 5 GB    | 50 GB |
| 团队成员       | 1      | 5       | 20    |
| App 数量     | 5      | 50      | 无限    |
| 每月 Credits | 500    | 5000    | 20000 |
| API Key    | ❌      | ✅       | ✅     |

[image](https://www.google.com/s2/favicons?domain=https://ragflow.io\&sz=32)

ragflow\.io

目前没有找到各家托管 RAGFlow 的真实活跃用户数量，因此不能准确判断哪个云服务用量最大。

## **五、全量导出和迁移能力**

| 数据     | 自部署 RAGFlow | 官方 Cloud  | 阿里云 DTS |
| ------ | ----------- | --------- | ------- |
| 原始文件   | ✅           | API 下载    | OSS     |
| 知识库配置  | ✅           | API 导出    | 部分      |
| 文档切片   | ✅           | API 导出    | 底层数据库   |
| 原始向量   | ✅           | 未提供公开导出接口 | 底层数据库   |
| 全文索引   | ✅           | ❌         | 需验证     |
| 用户及权限  | ✅           | 部分        | 需验证     |
| 完整实例迁移 | ✅           | 未确认支持     | 未确认支持   |

官方 API 支持下载文档、遍历知识库及切片，但切片接口未提供原始 Embedding 向量字段。

[image](https://www.google.com/s2/favicons?domain=https://ragflow.io\&sz=32)

RAGFlow+1



自部署版本则提供完整备份恢复方案：

- [RAGFlow 1.x 备份与恢复](https://ragflow.io/docs/backup_and_restore_v1?utm_source=chatgpt.com)
- [RAGFlow 0.x 备份与恢复](https://ragflow.io/docs/backup_and_restore_v0?utm_source=chatgpt.com)

包含数据库、文件、向量索引及其他持久化数据。

[image](https://www.google.com/s2/favicons?domain=https://ragflow.io\&sz=32)

RAGFlow+1



## **六、最低成本方案**

低价 VPS 自部署通常比购买完整托管服务划算。

| VPS 厂商                                                                    | 内存    | 参考月费        |
| ------------------------------------------------------------------------- | ----- | ----------- |
| [Hostinger](https://www.hostinger.com/vps-hosting?utm_source=chatgpt.com) | 16 GB | **$28.99**|
| [OVHcloud](https://www.ovhcloud.com/en/vps/?utm_source=chatgpt.com)       | 24 GB | $57.16      |
| [Netcup](https://www.netcup.com/?utm_source=chatgpt.com)                  | 16 GB | $25.39      |
| [Vultr](https://www.vultr.com/?utm_source=chatgpt.com)                    | 16 GB | $80         |

**长期 有货的价格**
以上为近期第三方价格调查数据，需确认购买周期、续费价格及库存。

[image](https://www.google.com/s2/favicons?domain=https://hostmath.dev\&sz=32)

hostmath.dev



## **七、最终推荐**

| 需求          | 推荐方案                  |
| ----------- | --------------------- |
| 最低成本        | 低价 VPS 自部署 RAGFlow    |
| 不想维护服务器     | RAGFlow Cloud Starter |
| 完整数据控制和迁移   | 自部署 RAGFlow           |
| 阿里云企业托管     | DTS RAGFlow           |
| 极低资源、按使用量计费 | 自研 RAG + OSS Vectors  |

针对你的 DSH 平台，我更建议 **独立部署一个 RAGFlow 实例，所有用户共享，通过业务 MCP 实现知识库隔离**。

这样既能获得完整 RAG 能力，又可以将 RAGFlow 单独迁移、扩容，不影响 DSH 主服务。初期一台 4 核 16 GB 的低价 VPS 即可作为起步配置，而不必为每个用户部署 RAGFlow。



是的，**RAGFlow 官方云服务与 16GB VPS 的长期成本基本相同。**

| 对比     | RAGFlow Cloud Starter | Hostinger KVM 4 |
| ------ | --------------------- | --------------- |
| 月费     | $29                   | $28.99          |
| 知识库存储  | 5 GB                  | 自主分配            |
| 总磁盘    | 受套餐限制                 | 200 GB          |
| API 调用 | 支持                    | 不限平台调用次数        |
| 用户数量   | 5 个团队成员               | 自主管理            |
| 完整数据迁移 | 受限                    | 支持              |
| 二次开发   | 受限                    | 支持              |
| 运维成本   | 低                     | 较高              |
| 部署其他服务 | 不支持                   | 支持              |


# LightRAG
**Microsoft GraphRAG 已进入维护模式，不再主动开发新功能。LightRAG 仍在活跃开发**
知识图谱构建时的 LLM Token 消耗才是需要重点关注的成本。

**LightRAG 比 RAGFlow 更适合低成本部署。** 最新版本支持仅使用 PostgreSQL 承载全部四类存储，无需额外部署图数据库、Redis 或独立向量数据库。

## **1. 资源占用分布**

假设 3 个用户、10 万文档切片、远程 LLM 和 Embedding API。

| 模块              | 支持的存储或服务                            | 内存估算        |
| --------------- | ----------------------------------- | ----------- |
| LightRAG 主服务    | Python / FastAPI                    | 512 MB～1 GB |
| KV 存储           | PostgreSQL、MongoDB、Redis、JSON       | 128～512 MB  |
| 向量存储            | pgvector、Qdrant、Milvus、NanoVectorDB | 1～3 GB      |
| 知识图谱            | PostgreSQL、Neo4j、NetworkX、Memgraph  | 512 MB～2 GB |
| 文档状态            | PostgreSQL、MongoDB、Redis、JSON       | 64～128 MB   |
| LLM / Embedding | 远程 API                              | 可忽略         |

[image](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub+1

以上是模块资源预算，共享数据库时不应简单累加。

### **不同部署组合**

| 部署组合                                   | CPU       | 建议内存       |
| -------------------------------------- | --------- | ---------- |
| LightRAG + 默认本地存储                      | 2 核       | 2～4 GB     |
| **LightRAG + PostgreSQL**              | **2～4 核** | **4～8 GB** |
| LightRAG + PostgreSQL + Qdrant         | 4 核       | 8 GB       |
| LightRAG + PostgreSQL + Milvus + Neo4j | 8 核       | 16 GB      |

默认本地存储会将全部数据加载至内存，不适合大规模生产环境。

新版 `PGTableGraphStorage` 不再依赖 Apache AGE，普通 PostgreSQL 14+ 配合 pgvector 即可承载全部四类存储。

[image](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub



## **2. 阿里云 LightRAG 服务**

阿里云提供 [LightRAG 一键部署方案](https://help.aliyun.com/zh/ecs/user-guide/lightrag?utm_source=chatgpt.com)，但本质上是 **ECS + 百炼模型 API**，不是独立的 Serverless LightRAG 服务。

[image](https://www.google.com/s2/favicons?domain=https://help.aliyun.com\&sz=32)

help.aliyun.com



| 模块              | 阿里云服务                     |
| --------------- | ------------------------- |
| LightRAG        | ECS                       |
| 统一数据库           | RDS PostgreSQL + pgvector |
| LLM / Embedding | 百炼                        |
| 原始文档            | OSS（需适配）                  |

目前未找到阿里云独立运营的全托管 LightRAG API 服务。

## **3. 云服务及长期价格对比**

以下采用公开常规价格，不采用新用户优惠、限时促销。

| 服务商                                                                                  | 2核4GB    | 4核8GB  | 部署方式   |
| ------------------------------------------------------------------------------------ | -------- | ------ | ------ |
| [OVHcloud](https://www.ovhcloud.com/en/vps/?utm_source=chatgpt.com)                  | $4.54起   | $8.50起 | VPS自部署 |
| [DigitalOcean](https://www.digitalocean.com/pricing/droplets?utm_source=chatgpt.com) | $24      | $48    | VPS自部署 |
| [Railway](https://railway.com/deploy/lightrag?utm_source=chatgpt.com)                | 按资源用量    | 按资源用量  | 一键部署   |
| [WZ-IT](https://wz-it.com/en/expertises/lightrag/?utm_source=chatgpt.com)            | €129.90起 | 更高     | 全托管    |

[image](https://www.google.com/s2/favicons?domain=https://www.ovhcloud.com\&sz=32)

OVHcloud Worldwide+3

单位：每月，不含模型费用。

Hetzner 的低价实例由于存在明显缺货问题，不列入长期可采购推荐。OVHcloud 是本次核实的低价候选，但不能保证未来始终有货，具体续费及区域库存需以订单为准。

目前没有公开的 LightRAG 托管服务使用量排名，无法确定哪家用户量最大。

## **4. 全量导出迁移**

| 数据           | 自部署 LightRAG |
| ------------ | ------------ |
| 原始文档         | ✅            |
| 文档切片         | ✅            |
| Embedding 向量 | ✅            |
| 知识图谱         | ✅            |
| LLM 缓存       | ✅            |
| 完整实例迁移       | ✅            |

采用 PostgreSQL 统一存储时，通过 `pg_dump` 加上文档目录及配置文件备份，即可迁移至兼容实例，无需重新计算向量和知识图谱。

但跨不同存储引擎迁移需要额外适配，不能仅依赖 LightRAG 的 CSV 导出功能。

[image](https://www.google.com/s2/favicons?domain=https://github.com\&sz=32)

GitHub+1



## **5. 最低成本架构推荐**

\#chatgpt-mermaid-\_r_2ba\_{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;fill:rgb(13, 13, 13);}@keyframes edge-animation-frame{from{stroke-dashoffset:0;}}@keyframes dash{to{stroke-dashoffset:0;}}#chatgpt-mermaid-\_r_2ba\_ .edge-animation-slow{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 50s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_2ba\_ .edge-animation-fast{stroke-dasharray:9,5!important;stroke-dashoffset:900;animation:dash 20s linear infinite;stroke-linecap:round;}#chatgpt-mermaid-\_r_2ba\_ .error-icon{fill:rgb(243, 243, 243);}#chatgpt-mermaid-\_r_2ba\_ .error-text{fill:rgb(13, 13, 13);stroke:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_2ba\_ .edge-thickness-normal{stroke-width:1px;}#chatgpt-mermaid-\_r_2ba\_ .edge-thickness-thick{stroke-width:3.5px;}#chatgpt-mermaid-\_r_2ba\_ .edge-pattern-solid{stroke-dasharray:0;}#chatgpt-mermaid-\_r_2ba\_ .edge-thickness-invisible{stroke-width:0;fill:none;}#chatgpt-mermaid-\_r_2ba\_ .edge-pattern-dashed{stroke-dasharray:3;}#chatgpt-mermaid-\_r_2ba\_ .edge-pattern-dotted{stroke-dasharray:2;}#chatgpt-mermaid-\_r_2ba\_ .marker{fill:rgb(143, 143, 143);stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_2ba\_ .marker.cross{stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_2ba\_ svg{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:16px;}#chatgpt-mermaid-\_r_2ba\_ p{margin:0;}#chatgpt-mermaid-\_r_2ba\_ .label{font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_2ba\_ .cluster-label text{fill:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_2ba\_ .cluster-label span{color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_2ba\_ .cluster-label span p{background-color:transparent;}#chatgpt-mermaid-\_r_2ba\_ .label text,#chatgpt-mermaid-\_r_2ba\_ span{fill:rgb(13, 13, 13);color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_2ba\_ .node rect,#chatgpt-mermaid-\_r_2ba\_ .node circle,#chatgpt-mermaid-\_r_2ba\_ .node ellipse,#chatgpt-mermaid-\_r_2ba\_ .node polygon,#chatgpt-mermaid-\_r_2ba\_ .node path{fill:rgb(222, 234, 251);stroke:rgb(83, 154, 248);stroke-width:1px;}#chatgpt-mermaid-\_r_2ba\_ .rough-node .label text,#chatgpt-mermaid-\_r_2ba\_ .node .label text,#chatgpt-mermaid-\_r_2ba\_ .image-shape .label,#chatgpt-mermaid-\_r_2ba\_ .icon-shape .label{text-anchor:middle;}#chatgpt-mermaid-\_r_2ba\_ .node .katex path{fill:#000;stroke:#000;stroke-width:1px;}#chatgpt-mermaid-\_r_2ba\_ .rough-node .label,#chatgpt-mermaid-\_r_2ba\_ .node .label,#chatgpt-mermaid-\_r_2ba\_ .image-shape .label,#chatgpt-mermaid-\_r_2ba\_ .icon-shape .label{text-align:center;}#chatgpt-mermaid-\_r_2ba\_ .node.clickable{cursor:pointer;}#chatgpt-mermaid-\_r_2ba\_ .root .anchor path{fill:rgb(143, 143, 143)!important;stroke-width:0;stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_2ba\_ .arrowheadPath{fill:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_2ba\_ .edgePath .path{stroke:rgb(143, 143, 143);stroke-width:1px;}#chatgpt-mermaid-\_r_2ba\_ .flowchart-link{stroke:rgb(143, 143, 143);fill:none;}#chatgpt-mermaid-\_r_2ba\_ .edgeLabel{background-color:rgb(252, 252, 252);text-align:center;}#chatgpt-mermaid-\_r_2ba\_ .edgeLabel p{background-color:rgb(252, 252, 252);}#chatgpt-mermaid-\_r_2ba\_ .edgeLabel rect{opacity:0.5;background-color:rgb(252, 252, 252);fill:rgb(252, 252, 252);}#chatgpt-mermaid-\_r_2ba\_ .labelBkg{background-color:rgba(252, 252, 252, 0.5);}#chatgpt-mermaid-\_r_2ba\_ .cluster rect{fill:rgb(243, 243, 243);stroke:rgba(0, 0, 0, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_2ba\_ .cluster text{fill:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_2ba\_ .cluster span{color:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_2ba\_ div.mermaidTooltip{position:absolute;text-align:center;max-width:200px;padding:2px;font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";font-size:12px;background:rgb(243, 243, 243);border:1px solid rgba(0, 0, 0, 0.1);border-radius:2px;pointer-events:none;z-index:100;}#chatgpt-mermaid-\_r_2ba\_ .flowchartTitleText{text-anchor:middle;font-size:18px;fill:rgb(13, 13, 13);}#chatgpt-mermaid-\_r_2ba\_ rect.text{fill:none;stroke-width:0;}#chatgpt-mermaid-\_r_2ba\_ .icon-shape,#chatgpt-mermaid-\_r_2ba\_ .image-shape{background-color:rgb(252, 252, 252);text-align:center;}#chatgpt-mermaid-\_r_2ba\_ .icon-shape p,#chatgpt-mermaid-\_r_2ba\_ .image-shape p{background-color:rgb(252, 252, 252);padding:2px;}#chatgpt-mermaid-\_r_2ba\_ .icon-shape .label rect,#chatgpt-mermaid-\_r_2ba\_ .image-shape .label rect{opacity:0.5;background-color:rgb(252, 252, 252);fill:rgb(252, 252, 252);}#chatgpt-mermaid-\_r_2ba\_ .label-icon{display:inline-block;height:1em;overflow:visible;vertical-align:-0.125em;}#chatgpt-mermaid-\_r_2ba\_ .node .label-icon path{fill:currentColor;stroke:revert;stroke-width:revert;}#chatgpt-mermaid-\_r_2ba\_ .node .neo-node{stroke:rgb(83, 154, 248);}#chatgpt-mermaid-\_r_2ba\_ [data-look="neo"].node rect,#chatgpt-mermaid-\_r_2ba\_ [data-look="neo"].cluster rect,#chatgpt-mermaid-\_r_2ba\_ [data-look="neo"].node polygon{stroke:url(#chatgpt-mermaid-\_r_2ba\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_2ba\_ [data-look="neo"].swimlane.cluster rect{filter:none;}#chatgpt-mermaid-\_r_2ba\_ [data-look="neo"].node path{stroke:url(#chatgpt-mermaid-\_r_2ba\_-gradient);stroke-width:1px;}#chatgpt-mermaid-\_r_2ba\_ [data-look="neo"].node .outer-path{filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_2ba\_ [data-look="neo"].node .neo-line path{stroke:rgb(83, 154, 248);filter:none;}#chatgpt-mermaid-\_r_2ba\_ [data-look="neo"].node circle{stroke:url(#chatgpt-mermaid-\_r_2ba\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_2ba\_ [data-look="neo"].node circle .state-start{fill:#000000;}#chatgpt-mermaid-\_r_2ba\_ [data-look="neo"].icon-shape .icon{fill:url(#chatgpt-mermaid-\_r_2ba\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_2ba\_ [data-look="neo"].icon-shape .icon-neo path{stroke:url(#chatgpt-mermaid-\_r_2ba\_-gradient);filter:drop-shadow( 1px 2px 2px rgba(185,185,185,1));}#chatgpt-mermaid-\_r_2ba\_ .node text{font-size:14px;font-weight:600;letter-spacing:normal;fill:rgb(0, 79, 153);}#chatgpt-mermaid-\_r_2ba\_ .edgeLabels text{font-size:13px;font-weight:600;letter-spacing:-0.08px;fill:rgb(0, 79, 153);}#chatgpt-mermaid-\_r_2ba\_ .node tspan[font-weight="normal"],#chatgpt-mermaid-\_r_2ba\_ .edgeLabels tspan[font-weight="normal"]{font-weight:600;}#chatgpt-mermaid-\_r_2ba\_ .edgeLabel .label rect{opacity:1;rx:13px;ry:13px;fill:rgb(245, 250, 255);stroke:rgb(206, 219, 229);stroke-width:1px;}#chatgpt-mermaid-\_r_2ba\_ .node rect,#chatgpt-mermaid-\_r_2ba\_ .node circle,#chatgpt-mermaid-\_r_2ba\_ .node ellipse,#chatgpt-mermaid-\_r_2ba\_ .node polygon,#chatgpt-mermaid-\_r_2ba\_ .node path{fill:rgb(229, 243, 255);stroke:rgba(0, 0, 0, 0.1);stroke-width:1px;}#chatgpt-mermaid-\_r_2ba\_ .node rect{rx:16px;ry:16px;}#chatgpt-mermaid-\_r_2ba\_ .mermaid-decision .label-container{fill:rgb(245, 250, 255);stroke:rgb(206, 219, 229);stroke-dasharray:2,2;}#chatgpt-mermaid-\_r_2ba\_ .edgePaths .flowchart-link{stroke:rgb(143, 143, 143);stroke-width:1px;stroke-linecap:round;stroke-linejoin:round;}#chatgpt-mermaid-\_r_2ba\_ .marker{fill:rgb(143, 143, 143);stroke:rgb(143, 143, 143);}#chatgpt-mermaid-\_r_2ba\_ :root{--mermaid-font-family:-apple-system-body,ui-sans-serif,-apple-system,system-ui,"Segoe UI",Helvetica,"Apple Color Emoji",Arial,sans-serif,"Segoe UI Emoji","Segoe UI Symbol";}DSHRAG MCPLightRAGPostgreSQL + pgvector百炼 / DeepSeek API

- **硬件：** 4核8GB，LightRAG 与 PostgreSQL 共享服务器。
- **成本：** OVHcloud $8.50/月起。
- **迁移：** 完整可控。
- **额外开销：** 知识图谱构建需要大量 LLM Token，可能远高于服务器成本。

**相比 RAGFlow，LightRAG 更值得你当前的平台采用，但需要额外关注复杂文档解析能力及图谱构建的模型费用。**
