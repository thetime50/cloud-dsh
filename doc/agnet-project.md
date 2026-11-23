# cloud-dsh 项目说明

方案：
- 按工作区隔离
- 按实例隔离（当前文档方案）

进行插件开发时可以参考本地DSH 创造模式里面提供的方法和工具

## 需求

可以让仅跑一个DSH容器  
一个用户绑定一个(dsh-profile实例 + 沙箱) 
用户可以使用的
1. 基础agent会话 安全的全功能基础agent (也是一种基础app)
2. app agent会话 有限的能力,旨在实现指定的功能需求(平台以应用的形式提供功能，一个应用就是一个DSH插件 包含了 依赖插件 MCP SKILL 等等)

能力	限制策略  
Python/Node.js/Shell	立沙箱内执行限制 CPU、内存、执行时间 (可开关)  
文件读取	仅允许用户自己的沙箱内  
文件写入	自己的沙箱内空间限制目录、磁盘容量 （区分用户只读区域(数据 文件归档等 不可见)和读写区域）  
网络访问	通过受控代理访问，流量限制 (请求来源：沙箱 浏览器，可以知道来源的DSH实例)  
浏览器 通过代理，给一个轻量无头浏览器限制资源 用户context隔离 只允许有限的安全的操作  
MCP 默认禁止	白名单、工具级权限 实例-工作区-会话自由安装 (注意区分客户需求能力和框架基础设施能力(数据库 rag),基础设施的关键信息(密钥 端口)和多余指令不要暴露出去)   
  (用户安装mcp预留/当前禁止，做好基础设施能力的管控(用一个公共的窗口plugn实现))  
Skill	允许生成，但脚本必须沙箱执行 实例-工作区-会话自由安装级安装  
DSH Plugin	默认禁止 白名单(系统内的安全镜像) 实例-工作区-会话自由安装级安装 (预留/当前禁止处理)  
SubAgent	限制数量、递归深度  
后台任务	限制并发、运行时间  
网络、CPU、内存、磁盘配额	容器监控 限制 只需要知道哪个任务占用大 网络请求多，来自哪个实例就可以了  
LLM	Token 用户自己的token 配额、费用上限  
API Key	服务端托管，禁止脚本读取  

### dsh多实例和沙箱
多用户云ai助手，有一定脚本能力 网络能力，如果一个用户一个docker环境是不是资源占用就太多了，很不划算，而且对比在一个环境中，无论是否使用都要占用资源

有没有在一个环境中无感沙箱技术

- 环境
  - DSH-web实例
  - 用户轻量软沙箱（管理项 网络数量+请求频率 硬盘 内存 cpu 脚本(安全 提供简单的py js shell 用于请求和数据处理文件编辑环境，避免高危高权限的命令 库) 读写安全）

### 阶段
- 0.0.0 实现功能，不管权限
  - DSH 数据 提醒 文件 rag 通知 其他全禁止 只有最简单的兜底限制
- 0.1.0 基本权限和功能
- 0.2.0 完整权限和功能


## 一、项目框架

```drawio locked
<mxfile>
  <diagram id="TYCpDoQH-oQfS0cEAunW" name="第 1 页">
    <mxGraphModel dx="738" dy="645" grid="1" gridSize="10" guides="1" tooltips="0" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="827" pageHeight="1169" math="0" shadow="0">
      <root>
        <mxCell id="v3Jhe25T8bevsHLFG7Wf-0" />
        <mxCell id="v3Jhe25T8bevsHLFG7Wf-1" parent="v3Jhe25T8bevsHLFG7Wf-0" />
        <mxCell id="ucAPlG4X_9IS2Ic_CEf1-5" edge="1" parent="v3Jhe25T8bevsHLFG7Wf-1" source="ucAPlG4X_9IS2Ic_CEf1-0" style="edgeStyle=none;html=1;" target="ucAPlG4X_9IS2Ic_CEf1-2">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="ucAPlG4X_9IS2Ic_CEf1-0" parent="v3Jhe25T8bevsHLFG7Wf-1" style="rounded=1;whiteSpace=wrap;html=1;arcSize=24;fillColor=#E3F2FD;strokeColor=#D4E2EE;fontColor=#004F99;fontSize=13;fontStyle=1;align=center;verticalAlign=middle;" value="User" vertex="1">
          <mxGeometry height="50" width="100" x="350" y="190" as="geometry" />
        </mxCell>
        <mxCell id="ucAPlG4X_9IS2Ic_CEf1-7" edge="1" parent="v3Jhe25T8bevsHLFG7Wf-1" source="ucAPlG4X_9IS2Ic_CEf1-1" style="edgeStyle=none;html=1;entryX=0.5;entryY=0;entryDx=0;entryDy=0;strokeColor=#A0A0A0;" target="ucAPlG4X_9IS2Ic_CEf1-3">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="ucAPlG4X_9IS2Ic_CEf1-1" parent="v3Jhe25T8bevsHLFG7Wf-1" style="rounded=1;whiteSpace=wrap;html=1;arcSize=24;fillColor=#E3F2FD;strokeColor=#D4E2EE;fontColor=#004F99;fontSize=13;fontStyle=1;align=center;verticalAlign=middle;" value="创建worker" vertex="1">
          <mxGeometry height="50" width="88" x="274" y="330" as="geometry" />
        </mxCell>
        <mxCell id="ucAPlG4X_9IS2Ic_CEf1-4" edge="1" parent="v3Jhe25T8bevsHLFG7Wf-1" source="ucAPlG4X_9IS2Ic_CEf1-2" style="edgeStyle=none;html=1;endArrow=none;endFill=0;strokeColor=#A0A0A0;" target="ucAPlG4X_9IS2Ic_CEf1-0" value="">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="ucAPlG4X_9IS2Ic_CEf1-6" edge="1" parent="v3Jhe25T8bevsHLFG7Wf-1" source="ucAPlG4X_9IS2Ic_CEf1-2" style="edgeStyle=none;html=1;entryX=0.5;entryY=0;entryDx=0;entryDy=0;exitX=0.268;exitY=1.016;exitDx=0;exitDy=0;exitPerimeter=0;strokeColor=#A0A0A0;" target="ucAPlG4X_9IS2Ic_CEf1-1">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="4ZF2dgNDXLvtN-DRSVFl-0" edge="1" parent="v3Jhe25T8bevsHLFG7Wf-1" source="ucAPlG4X_9IS2Ic_CEf1-2" style="edgeStyle=orthogonalEdgeStyle;html=1;exitX=0.683;exitY=1.001;exitDx=0;exitDy=0;entryX=0.5;entryY=0;entryDx=0;entryDy=0;exitPerimeter=0;strokeColor=#A0A0A0;" target="4ZF2dgNDXLvtN-DRSVFl-1">
          <mxGeometry relative="1" x="-0.7441" as="geometry">
            <Array as="points" />
            <mxPoint x="405.83333333333337" y="340" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="ucAPlG4X_9IS2Ic_CEf1-2" parent="v3Jhe25T8bevsHLFG7Wf-1" style="rounded=1;whiteSpace=wrap;html=1;arcSize=24;fillColor=#E3F2FD;strokeColor=#D4E2EE;fontColor=#004F99;fontSize=13;fontStyle=1;align=center;verticalAlign=middle;" value="&lt;span style=&quot;white-space: pre-wrap;&quot;&gt;dsh-profile实例 + 沙箱&lt;br&gt;&lt;font style=&quot;font-weight: normal; font-size: 10px;&quot;&gt;（管理项 网络数量+请求频率 硬盘 内存 cpu 脚本(安全 提供简单的py js shell 用于请求和数据处理文件编辑环境，避免高危高权限的命令 库) 读写安全）&lt;/font&gt;&lt;/span&gt;" vertex="1">
          <mxGeometry height="50" width="350" x="225" y="260" as="geometry" />
        </mxCell>
        <mxCell id="uc-8vFEHTe5hpCGVcvdb-3" edge="1" parent="v3Jhe25T8bevsHLFG7Wf-1" style="edgeStyle=orthogonalEdgeStyle;html=1;entryX=0.5;entryY=0;entryDx=0;entryDy=0;strokeColor=#A0A0A0;" target="uc-8vFEHTe5hpCGVcvdb-1">
          <mxGeometry relative="1" x="0.35" as="geometry">
            <mxPoint x="290" y="449.99999999999994" as="sourcePoint" />
            <mxPoint x="212" y="480" as="targetPoint" />
          </mxGeometry>
        </mxCell>
        <mxCell id="uc-8vFEHTe5hpCGVcvdb-4" edge="1" parent="v3Jhe25T8bevsHLFG7Wf-1" source="ucAPlG4X_9IS2Ic_CEf1-3" style="edgeStyle=orthogonalEdgeStyle;html=1;entryX=0.5;entryY=0;entryDx=0;entryDy=0;strokeColor=#A0A0A0;" target="uc-8vFEHTe5hpCGVcvdb-0">
          <mxGeometry relative="1" x="0.1778" as="geometry">
            <Array as="points">
              <mxPoint x="340" y="465" />
              <mxPoint x="400" y="465" />
            </Array>
          </mxGeometry>
        </mxCell>
        <mxCell id="ucAPlG4X_9IS2Ic_CEf1-3" parent="v3Jhe25T8bevsHLFG7Wf-1" style="rounded=1;whiteSpace=wrap;html=1;arcSize=24;fillColor=#E3F2FD;strokeColor=#D4E2EE;fontColor=#004F99;fontSize=13;fontStyle=1;align=center;verticalAlign=middle;" value="创建app agent会话" vertex="1">
          <mxGeometry height="50" width="148" x="244" y="400" as="geometry" />
        </mxCell>
        <mxCell id="uc-8vFEHTe5hpCGVcvdb-2" edge="1" parent="v3Jhe25T8bevsHLFG7Wf-1" source="uc-8vFEHTe5hpCGVcvdb-0" style="edgeStyle=none;html=1;entryX=1;entryY=0.5;entryDx=0;entryDy=0;dashed=1;strokeColor=#A0A0A0;" target="uc-8vFEHTe5hpCGVcvdb-1">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="uc-8vFEHTe5hpCGVcvdb-0" parent="v3Jhe25T8bevsHLFG7Wf-1" style="rounded=1;whiteSpace=wrap;html=1;arcSize=24;fillColor=#E3F2FD;strokeColor=#D4E2EE;fontColor=#004F99;fontSize=13;fontStyle=1;align=center;verticalAlign=middle;" value="用户对话" vertex="1">
          <mxGeometry height="50" width="100" x="350" y="480" as="geometry" />
        </mxCell>
        <mxCell id="uc-8vFEHTe5hpCGVcvdb-1" parent="v3Jhe25T8bevsHLFG7Wf-1" style="rounded=1;whiteSpace=wrap;html=1;arcSize=24;fillColor=#E3F2FD;strokeColor=#D4E2EE;fontColor=#004F99;fontSize=13;fontStyle=1;align=center;verticalAlign=middle;" value="app agent 插件框架和能力提供" vertex="1">
          <mxGeometry height="50" width="100" x="190" y="480" as="geometry" />
        </mxCell>
        <mxCell id="4ZF2dgNDXLvtN-DRSVFl-1" parent="v3Jhe25T8bevsHLFG7Wf-1" style="rounded=1;whiteSpace=wrap;html=1;arcSize=24;fillColor=#E3F2FD;strokeColor=#D4E2EE;fontColor=#004F99;fontSize=13;fontStyle=1;align=center;verticalAlign=middle;" value="DSH Task" vertex="1">
          <mxGeometry height="50" width="100" x="414" y="330" as="geometry" />
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
```
## 二、代码架构

### 1. 外围

由主站“play-site” 提供鉴权 用户信息 用户配置(默认llmkey等)

### 2. 多实例服务基座
服务基座  launcher 和 reverse proxy
- 基座业务 根据主站管理实例 增删启停 绑定沙箱 (基座业务接口)
- 管理业务 本项目的权限管理 扩容等管理页面(对应5. 支持/管理页面 (预留) 转发页面 管理页面接口)
- 入口 基座可以不在公网机器上。公网侧跑 frps，基座机器上的 frpc 把 gateway 映射为 `dsh.<主站域名>`。浏览器直接打开这个域名，主站不转发页面。WebSocket 走同一条隧道。基座访问主站确认权限用自己的出站。

### 3. 沙箱
让 DSH实例 的 Python / Node / Shell 文件读写走沙箱管理
共享 只读的DSH执行文件 SDH插件/node/py依赖等

### 4. 安全管理
网络请求频率流量 CPU 内存等

### 5. 支持/管理页面 (预留)
(nuxt框架 /manage)
- 应用市场列表页
- 用户环境列表页 网页->C-DSH触发向主站拿当前用户列表->c-dsh渲染页面
- 后台资源监控页
- 后台安全监控页


## 三、完整能力管控清单

| 能力                    | 限制策略                   | 实现层                    |
| --------------------- | ---------------------- | ---------------------- |
| Python / Node / Shell | 按需沙箱、资源限制、独立开关         | nsjail                |
| 文件读取                  | 工作区隔离、目录白名单            | File Service / nsjail |
| 文件写入                  | 可写目录、磁盘配额              | File Service / nsjail |
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

## 四、用户沙箱存储设计

不需要每个工作区创建独立磁盘，可以使用文件系统的目录级配额。

```
/storage/
  users/
    user-001/
      shared/         # 共享资源 只读
      dsh-profile/    # 用户DSH配置
      files/          # Agent 可读写
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

**基础 Agent**

通用、安全的个人工作助手
也是一种应用 (base app)

- 通用对话
- 沙箱脚本
- 文件处理
- 受控网络
- 浏览器
- Skill 创建
- 授权 MCP
- SubAgent

**App Agent**

针对特定业务的应用助手
平台以应用的形式提供功能，一个应用就是一个DSH插件 包含了 依赖插件 MCP SKILL 等等

- 专用 System Prompt
- 指定 Skills
- 指定 MCP Tools
- 指定知识库
- 独立能力配置
- <s>独立资源配额<s>
- 默认关闭通用执行能力


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
| 实例权限              | 沙箱等 |
| 用户与工作区管理           | 自行开发              |
| AgentProfile       | 自行封装              |
| Policy Engine      | 自行开发              |
| 脚本沙箱               | 集成外部执行器           |
| Browser Pool       | 集成 Playwright 等   |
| Network Gateway    | 独立代理服务            |
| Storage Quota      | 文件系统配额            |
| 基础设施 MCP           | 自行封装              |
| 资源计量与审计            | 自行开发              |



# 框图

```drawio
<mxfile>
  <diagram id="h6lTthcl_BWDAnZA0HOL" name="第 1 页">
    <mxGraphModel dx="1500" dy="1100" grid="1" gridSize="10" guides="1" tooltips="0" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="1600" pageHeight="1300" math="0" shadow="0">
      <root>
        <mxCell id="0" />
        <mxCell id="1" parent="0" />
        <mxCell id="playsite" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=14;" value="play-site 主站&#xa;鉴权 / 用户信息 / 用户配置（默认 LLM Key 等）" vertex="1">
          <mxGeometry height="70" width="440" x="550" y="-190" as="geometry" />
        </mxCell>
        <mxCell id="base" parent="1" style="swimlane;html=1;startSize=35;horizontal=1;fillColor=#e1d5e7;strokeColor=#9673a6;fontSize=15;fontStyle=1;" value="多实例服务基座（单 DSH 容器）" vertex="1">
          <mxGeometry height="170" width="930" x="290" y="-70" as="geometry" />
        </mxCell>
        <mxCell id="launcher" parent="base" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#9673a6;" value="Launcher&#xa;实例增删启停 / 绑定沙箱" vertex="1">
          <mxGeometry height="65" width="260" x="30" y="70" as="geometry" />
        </mxCell>
        <mxCell id="proxy" parent="base" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#9673a6;" value="Reverse Proxy" vertex="1">
          <mxGeometry height="65" width="250" x="340" y="70" as="geometry" />
        </mxCell>
        <mxCell id="management" parent="base" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#9673a6;" value="管理业务&#xa;权限管理 / 扩容等管理页面" vertex="1">
          <mxGeometry height="65" width="270" x="630" y="70" as="geometry" />
        </mxCell>
        <mxCell id="instances" parent="1" style="swimlane;html=1;startSize=35;fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=15;fontStyle=1;" value="用户实例（一个用户绑定一个 dsh-profile 实例 + 沙箱）" vertex="1">
          <mxGeometry height="640" width="1220" x="290" y="140" as="geometry" />
        </mxCell>
        <mxCell id="A_1fHoqWQ9abUcOJvhVc-3" edge="1" parent="instances" source="profile" style="edgeStyle=none;shape=connector;rounded=1;html=1;strokeColor=#A0A0A0;align=center;verticalAlign=middle;fontFamily=Helvetica;fontSize=11;fontColor=default;labelBackgroundColor=default;endArrow=classic;" target="A_1fHoqWQ9abUcOJvhVc-1">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="profile" parent="instances" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#6c8ebf;fontSize=14;" value="dsh-profile 实例&#xa;用户 DSH 配置" vertex="1">
          <mxGeometry height="65" width="250" x="40" y="70" as="geometry" />
        </mxCell>
        <mxCell id="baseagent" parent="instances" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#d5e8d4;strokeColor=#82b366;" value="基础 Agent（base app ageng）&lt;br&gt;通用对话 / 沙箱脚本 / 文件处理&lt;br&gt;受控网络 / 浏览器 / Skill 创建&lt;br&gt;授权 MCP / SubAgent" vertex="1">
          <mxGeometry height="120" width="250" x="340" y="280" as="geometry" />
        </mxCell>
        <mxCell id="appagent" parent="instances" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;" value="App Agent&#xa;专用 System Prompt&#xa;指定 Skills / MCP Tools / 知识库&#xa;独立能力配置&#xa;默认关闭通用执行能力" vertex="1">
          <mxGeometry height="120" width="280" x="750" y="280" as="geometry" />
        </mxCell>
        <mxCell id="sandbox" parent="instances" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;" value="用户沙箱&#xa;Python / Node.js / Shell&#xa;CPU / 内存 / 执行时间限制&#xa;文件读写隔离" vertex="1">
          <mxGeometry height="105" width="250" x="40" y="482.5" as="geometry" />
        </mxCell>
        <mxCell id="e5" edge="1" parent="instances" source="baseagent" style="edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=classic;strokeColor=#A0A0A0;align=center;verticalAlign=middle;fontFamily=Helvetica;fontSize=11;fontColor=default;labelBackgroundColor=default;entryX=0.5;entryY=0;entryDx=0;entryDy=0;" target="A_1fHoqWQ9abUcOJvhVc-37">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="e6" edge="1" parent="instances" source="appagent" style="edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=classic;strokeColor=#A0A0A0;align=center;verticalAlign=middle;fontFamily=Helvetica;fontSize=11;fontColor=default;labelBackgroundColor=default;" target="A_1fHoqWQ9abUcOJvhVc-37">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="A_1fHoqWQ9abUcOJvhVc-5" edge="1" parent="instances" source="A_1fHoqWQ9abUcOJvhVc-1" style="edgeStyle=none;shape=connector;rounded=1;html=1;strokeColor=#A0A0A0;align=center;verticalAlign=middle;fontFamily=Helvetica;fontSize=11;fontColor=default;labelBackgroundColor=default;endArrow=classic;" target="A_1fHoqWQ9abUcOJvhVc-2">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="A_1fHoqWQ9abUcOJvhVc-1" parent="instances" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#6c8ebf;fontSize=14;" value="运行种的DSH实例" vertex="1">
          <mxGeometry height="65" width="250" x="340" y="70" as="geometry" />
        </mxCell>
        <mxCell id="A_1fHoqWQ9abUcOJvhVc-6" edge="1" parent="instances" source="A_1fHoqWQ9abUcOJvhVc-2" style="edgeStyle=none;shape=connector;rounded=1;html=1;strokeColor=#A0A0A0;align=center;verticalAlign=middle;fontFamily=Helvetica;fontSize=11;fontColor=default;labelBackgroundColor=default;endArrow=classic;" target="baseagent">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="A_1fHoqWQ9abUcOJvhVc-7" edge="1" parent="instances" source="A_1fHoqWQ9abUcOJvhVc-2" style="edgeStyle=orthogonalEdgeStyle;shape=connector;rounded=1;html=1;entryX=0.5;entryY=0;entryDx=0;entryDy=0;strokeColor=#A0A0A0;align=center;verticalAlign=middle;fontFamily=Helvetica;fontSize=11;fontColor=default;labelBackgroundColor=default;endArrow=classic;" target="appagent">
          <mxGeometry relative="1" x="-0.0513" as="geometry">
            <Array as="points">
              <mxPoint x="670" y="250" />
              <mxPoint x="1015" y="250" />
            </Array>
          </mxGeometry>
        </mxCell>
        <mxCell id="A_1fHoqWQ9abUcOJvhVc-2" parent="instances" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#6c8ebf;fontSize=14;" value="创建worker/会话" vertex="1">
          <mxGeometry height="65" width="250" x="340" y="170" as="geometry" />
        </mxCell>
        <mxCell id="A_1fHoqWQ9abUcOJvhVc-9" edge="1" parent="instances" source="A_1fHoqWQ9abUcOJvhVc-8" style="edgeStyle=none;shape=connector;rounded=1;html=1;strokeColor=#A0A0A0;align=center;verticalAlign=middle;fontFamily=Helvetica;fontSize=11;fontColor=default;labelBackgroundColor=default;endArrow=classic;" target="A_1fHoqWQ9abUcOJvhVc-2">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="A_1fHoqWQ9abUcOJvhVc-8" parent="instances" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#6c8ebf;fontSize=14;" value="应用商城&lt;br&gt;&lt;span style=&quot;font-size: 12px;&quot;&gt;每个应用都是DSH Plugin&lt;/span&gt;&lt;br style=&quot;font-size: 12px;&quot;&gt;&lt;span style=&quot;font-size: 12px;&quot;&gt;依赖插件 / MCP / Skill /&amp;nbsp;&lt;/span&gt;&lt;span style=&quot;font-size: 12px;&quot;&gt;白名单 / 平台审核&lt;/span&gt;" vertex="1">
          <mxGeometry height="65" width="250" x="750" y="170" as="geometry" />
        </mxCell>
        <mxCell id="A_1fHoqWQ9abUcOJvhVc-42" edge="1" parent="instances" source="A_1fHoqWQ9abUcOJvhVc-37" style="edgeStyle=none;shape=connector;rounded=1;html=1;entryX=1;entryY=0.5;entryDx=0;entryDy=0;strokeColor=#A0A0A0;align=center;verticalAlign=middle;fontFamily=Helvetica;fontSize=11;fontColor=default;labelBackgroundColor=default;endArrow=classic;" target="sandbox">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="A_1fHoqWQ9abUcOJvhVc-37" parent="instances" style="swimlane;html=1;startSize=35;fillColor=#dae8fc;strokeColor=#6c8ebf;fontSize=15;fontStyle=1;align=center;verticalAlign=middle;fontFamily=Helvetica;fontColor=default;" value="会话产物" vertex="1">
          <mxGeometry height="150" width="600" x="330" y="460" as="geometry" />
        </mxCell>
        <mxCell id="plugin" parent="A_1fHoqWQ9abUcOJvhVc-37" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#6c8ebf;align=center;verticalAlign=middle;fontFamily=Helvetica;fontSize=12;fontColor=default;" value="会话执行脚本" vertex="1">
          <mxGeometry height="60" width="260" x="50" y="60" as="geometry" />
        </mxCell>
        <mxCell id="task" parent="A_1fHoqWQ9abUcOJvhVc-37" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#6c8ebf;" value="DSH Task&#xa;后台任务 / SubAgent" vertex="1">
          <mxGeometry height="60" width="230" x="340" y="60" as="geometry" />
        </mxCell>
        <mxCell id="controls" parent="1" style="swimlane;html=1;startSize=35;fillColor=#f5f5f5;strokeColor=#666666;fontSize=15;fontStyle=1;" value="能力管控与执行层" vertex="1">
          <mxGeometry height="210" width="1500" x="40" y="850" as="geometry" />
        </mxCell>
        <mxCell id="nsjail" parent="controls" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#f8cecc;strokeColor=#b85450;" value="nsjail&#xa;脚本沙箱" vertex="1">
          <mxGeometry height="65" width="155" x="20" y="65" as="geometry" />
        </mxCell>
        <mxCell id="fileservice" parent="controls" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#666666;" value="File Service&#xa;文件读写权限" vertex="1">
          <mxGeometry height="65" width="155" x="190" y="65" as="geometry" />
        </mxCell>
        <mxCell id="network" parent="controls" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#666666;" value="Network Gateway&#xa;网络代理 / 流量限制" vertex="1">
          <mxGeometry height="65" width="170" x="360" y="65" as="geometry" />
        </mxCell>
        <mxCell id="browser" parent="controls" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#666666;" value="Browser Pool&#xa;上下文隔离 / 操作白名单" vertex="1">
          <mxGeometry height="65" width="170" x="545" y="65" as="geometry" />
        </mxCell>
        <mxCell id="mcpgateway" parent="controls" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#666666;" value="MCP Gateway&#xa;Tool 级白名单" vertex="1">
          <mxGeometry height="65" width="160" x="915" y="65" as="geometry" />
        </mxCell>
        <mxCell id="scheduler" parent="controls" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#666666;" value="Scheduler&#xa;并发 / 运行时间" vertex="1">
          <mxGeometry height="65" width="170" x="730" y="65" as="geometry" />
        </mxCell>
        <mxCell id="modelgateway" parent="controls" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#666666;" value="Model Gateway&#xa;Token / 费用 / 模型白名单" vertex="1">
          <mxGeometry height="65" width="190" x="1090" y="65" as="geometry" />
        </mxCell>
        <mxCell id="secret" parent="controls" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#666666;" value="Secret Manager&#xa;API Key 服务端托管" vertex="1">
          <mxGeometry height="65" width="185" x="1295" y="65" as="geometry" />
        </mxCell>
        <mxCell id="storage" parent="1" style="swimlane;html=1;startSize=35;fillColor=#d5e8d4;strokeColor=#82b366;fontSize=15;fontStyle=1;" value="用户沙箱存储" vertex="1">
          <mxGeometry height="160" width="720" x="40" y="1110" as="geometry" />
        </mxCell>
        <mxCell id="userstorage" parent="storage" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#82b366;align=left;spacingLeft=12;" value="/storage/users/user-001/&#xa;shared/（共享只读）&#xa;dsh-profile/（用户配置）&#xa;files/（Agent 可读写）" vertex="1">
          <mxGeometry height="95" width="325" x="20" y="50" as="geometry" />
        </mxCell>
        <mxCell id="privatestorage" parent="storage" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#ffffff;strokeColor=#82b366;align=left;spacingLeft=12;" value="/private/&#xa;archives/（仅内部服务访问）&#xa;sessions/（会话持久化）&#xa;infrastructure/（基础设施配置）" vertex="1">
          <mxGeometry height="95" width="335" x="365" y="50" as="geometry" />
        </mxCell>
        <mxCell id="managepage" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#e1d5e7;strokeColor=#9673a6;" value="支持 / 管理页面（预留）&#xa;Nuxt /manage&#xa;应用市场列表 / 用户环境列表&#xa;后台资源监控 / 后台安全监控" vertex="1">
          <mxGeometry height="150" width="360" x="1180" y="1110" as="geometry" />
        </mxCell>
        <mxCell id="A_1fHoqWQ9abUcOJvhVc-44" edge="1" parent="1" source="monitor" style="edgeStyle=none;shape=connector;rounded=1;html=1;strokeColor=#A0A0A0;align=center;verticalAlign=middle;fontFamily=Helvetica;fontSize=11;fontColor=default;labelBackgroundColor=default;endArrow=classic;" target="managepage">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="monitor" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=#fff2cc;strokeColor=#d6b656;" value="资源监控与追踪&#xa;CPU / 内存 / 磁盘&#xa;网络请求 / 流量&#xa;脚本 / 浏览器 / MCP&#xa;LLM Token / 费用" vertex="1">
          <mxGeometry height="150" width="360" x="790" y="1110" as="geometry" />
        </mxCell>
        <mxCell id="e1" edge="1" parent="1" source="playsite" style="edgeStyle=orthogonalEdgeStyle;rounded=0;html=1;endArrow=block;endFill=1;strokeColor=#A0A0A0;" target="base">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="e2" edge="1" parent="1" source="launcher" style="edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=classic;strokeColor=#A0A0A0;align=center;verticalAlign=middle;fontFamily=Helvetica;fontSize=11;fontColor=default;labelBackgroundColor=default;" target="profile">
          <mxGeometry relative="1" as="geometry">
            <Array as="points">
              <mxPoint x="440" y="242.5" />
            </Array>
          </mxGeometry>
        </mxCell>
        <mxCell id="e7" edge="1" parent="1" source="sandbox" style="edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=classic;strokeColor=#A0A0A0;align=center;verticalAlign=middle;fontFamily=Helvetica;fontSize=11;fontColor=default;labelBackgroundColor=default;" target="nsjail">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="e8" edge="1" parent="1" source="task" style="edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=classic;strokeColor=#A0A0A0;align=center;verticalAlign=middle;fontFamily=Helvetica;fontSize=11;fontColor=default;labelBackgroundColor=default;" target="scheduler">
          <mxGeometry relative="1" x="-0.3976" as="geometry">
            <Array as="points">
              <mxPoint x="1080" y="820" />
              <mxPoint x="850" y="820" />
            </Array>
          </mxGeometry>
        </mxCell>
        <mxCell id="e10" edge="1" parent="1" source="fileservice" style="edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=classic;strokeColor=#A0A0A0;align=center;verticalAlign=middle;fontFamily=Helvetica;fontSize=11;fontColor=default;labelBackgroundColor=default;" target="userstorage">
          <mxGeometry relative="1" as="geometry" />
        </mxCell>
        <mxCell id="e11" edge="1" parent="1" source="management" style="edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=classic;strokeColor=#A0A0A0;align=center;verticalAlign=middle;fontFamily=Helvetica;fontSize=11;fontColor=default;labelBackgroundColor=default;" target="managepage">
          <mxGeometry relative="1" x="0.4984" as="geometry">
            <Array as="points">
              <mxPoint x="1580" y="-87.5" />
              <mxPoint x="1580" y="1195" />
            </Array>
          </mxGeometry>
        </mxCell>
        <mxCell id="A_1fHoqWQ9abUcOJvhVc-43" connectable="0" parent="e11" style="edgeLabel;html=1;align=center;verticalAlign=middle;resizable=0;points=[];inheritText=1;" value="Text" vertex="1">
          <mxGeometry relative="1" x="-0.3798" y="-3" as="geometry">
            <mxPoint as="offset" />
          </mxGeometry>
        </mxCell>
        <mxCell id="A_1fHoqWQ9abUcOJvhVc-4" edge="1" parent="1" source="proxy" style="edgeStyle=orthogonalEdgeStyle;shape=connector;rounded=1;html=1;strokeColor=#A0A0A0;align=center;verticalAlign=middle;fontFamily=Helvetica;fontSize=11;fontColor=default;labelBackgroundColor=default;endArrow=classic;" target="A_1fHoqWQ9abUcOJvhVc-1">
          <mxGeometry relative="1" as="geometry">
            <mxPoint x="760" y="380" as="targetPoint" />
          </mxGeometry>
        </mxCell>
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>

```
