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

### 外围

由主站“play-site” 提供鉴权 用户信息 用户配置(默认llmkey等)

### 多实例服务基座
服务基座  launcher 和 reverse proxy
根据主站管理实例 增删启停 绑定沙箱
本项目的权限管理 扩容等管理页面

### 沙箱
让 DSH实例 的 Python / Node / Shell 文件读写走沙箱管理
共享 只读的DSH执行文件 SDH插件/node/py依赖等

### 安全管理
网络请求频率流量 CPU 内存等

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

