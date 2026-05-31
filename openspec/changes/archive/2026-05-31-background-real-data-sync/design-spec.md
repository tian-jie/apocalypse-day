# Design

## Context

当前实现已经具备真实 provider 适配器与 PostgreSQL 快照持久化能力，但真实数据仍然在用户请求 dashboard 时即时拉取，再由请求链路负责归一化、入库和评分。这使 API 响应时间直接受外部 provider 的可用性、延迟和限流影响，也让“读请求”和“同步请求”耦合在同一个控制面上。

已有设计决策仍然有效：内部分析继续围绕小时级聚合快照展开，评分与解释逻辑应独立于外部 provider，PostgreSQL 作为规范化快照与摄取状态的持久化载体，dashboard 继续依赖稳定的数据契约。新变更要解决的问题不是数据模型，而是同步时机和责任边界。

因此，本次设计复用现有快照结构、PG 仓储和状态元数据，调整为“后台同步链路负责拉取和写入，查询链路只负责读取和评分”的模式。这样更符合监控类产品的工程常识，也为后续移除 mock fallback、独立 worker 部署和同步告警打基础。

## Goals / Non-Goals

**Goals:**

- 将真实 provider 拉取从请求时执行改为后台周期同步。
- 让 dashboard 和异常评分链路优先读取 PostgreSQL 中最近一次成功同步的规范化快照。
- 为同步任务补充结构化状态，包括最近成功同步时间、失败原因、同步健康度与数据新鲜度。
- 将“同步链路”和“查询链路”拆分为可独立演进的边界，同时尽量复用现有 PG schema 与评分逻辑。

**Non-Goals:**

- 不在本次设计中重写异常评分、预测或 explanation 逻辑。
- 不在本次设计中引入消息队列、分布式调度系统或复杂任务编排平台。
- 不在本次设计中要求存储原始逐架次轨迹；仍以小时级聚合快照为分析基础。
- 不改变 mock 模式的开发用途；它仍可作为显式开发模式存在。

## Decisions

1. 将同步链路显式建模为独立的后台 job，而不是请求内隐式行为。

   当前 API 请求会直接触发 `defaultIngestionSource.getSnapshots()`，导致外部依赖抖动会直达用户请求。改为后台 job 后，查询链路只面向本地 PG，外部 provider 故障只影响同步健康度，不直接拖慢前台请求。替代方案是继续请求时拉取并加缓存，但那仍然无法彻底分离职责。

2. 查询链路只读 PostgreSQL 中的规范化快照和同步状态。

   这样 baseline、prediction、review 和 dashboard 状态都基于同一份本地快照数据，避免同一时间窗口内多个请求拿到不同的外部响应。替代方案是查询链路在 PG 无数据时再现场拉取，但那会重新引入控制面耦合。

3. 同步任务继续复用现有 provider 归一化逻辑和 PG 仓储。

   `HttpRealAircraftSnapshotSource` 已经能够完成 HTTP 拉取与 payload 归一化，`PgSnapshotRepository` 已经可以保存快照与摄取元数据。让后台 job 直接复用这些边界，可以减少重复实现，避免出现两套写入语义。替代方案是为 job 和 API 分别实现各自的数据通道，但那会增加维护成本。

4. 新增独立的同步状态记录，而不是只复用查询侧 ingestion metadata。

   ingestion metadata 主要服务于 dashboard 展示，而后台同步还需要记录任务级状态，例如最近一次尝试时间、最近一次成功时间、最近失败原因和同步批次结果。应在现有状态基础上增加 job 视角字段，保证运维与前端都能消费。替代方案是把任务状态塞进 notes 文本，但那不利于程序化判断。

5. 数据新鲜度基于“最近成功同步的快照时间”判定，而不是请求时间。

   当查询链路不再触发现场拉取后，freshness 的真实含义应是“本地库里最新成功同步的数据是否过旧”。这一定义更稳定，也更适合告警。替代方案是继续以每次请求的当前时间去猜测 provider 状态，但那不再准确。

6. 首版使用应用内定时器或显式同步入口即可，不强制拆出独立部署单元。

   MVP 需要先落地同步语义，而不是一开始就上复杂调度基础设施。可以先提供服务启动后的定时同步器和手动触发入口，后续再视运行负载拆成独立 worker。替代方案是立即引入外部调度系统，但超出当前复杂度预算。

## Risks / Trade-offs

- [后台 job 停止运行时，查询链路会持续读取旧数据] → 暴露最近成功同步时间和 freshness，并在 API/前端明确显示 stale 状态。
- [应用内定时器在多实例部署时可能重复执行同步] → 为同步 job 预留互斥或 leader 选举扩展点，首版先在单实例或单 worker 场景运行。
- [PG 中快照不足时评分链路无法产出完整结果] → 在查询路径增加最小样本校验，缺少足够历史时返回明确状态，而不是隐式现场拉取。
- [同步状态和展示状态混用可能导致语义混乱] → 区分 job 级同步时间与快照级 provider 时间，并在接口契约中分字段输出。

## Migration Plan

1. 先增加后台同步入口和同步状态记录，但保留现有 provider 与 PG 归一化逻辑。
2. 将 dashboard 查询路径切换为只读 PostgreSQL，并为“库内数据不足”返回明确状态。
3. 在开发和预发布环境启用定时同步，观察 freshness、同步失败率和查询延迟。
4. 确认稳定后，再移除请求时实时拉取路径和相关测试假设。
5. 如需回滚，可暂时恢复请求时拉取实现，但保留已写入 PG 的快照数据。

## Open Questions

- 首版后台同步是使用应用内 `setInterval`、Nitro task，还是单独提供手动/定时触发入口供外部 cron 调用？
- 多实例部署时，是否需要在 PostgreSQL 中增加轻量锁来避免重复同步？
- 当 PostgreSQL 中还没有足够历史快照时，dashboard 是返回明确“数据不足”，还是只展示同步状态而不出分？

# Specs

## aircraft-anomaly-monitoring

## MODIFIED Requirements

### Requirement: Dashboard status output
系统 SHALL 暴露可供 dashboard 直接使用的状态数据，包括当前等级、上一等级、趋势、最新快照指标、预测复盘、主要异常驱动因素与解释；系统同时 SHALL 暴露当前数据的新鲜度、最近一次成功同步时间、同步健康度以及同步失败原因，使客户端能够明确识别当前状态是否来自本地已同步数据。

#### Scenario: Current status is displayed from synchronized data
- **WHEN** 用户打开异常 dashboard 且 PostgreSQL 中存在最近一次成功同步的小时级快照时
- **THEN** dashboard 通过单个状态载荷展示当前全局异常状态、近期变化、支撑证据以及同步状态，而无需在请求时直接访问外部 provider

#### Scenario: Dashboard shows stale synchronized data
- **WHEN** PostgreSQL 中最近一次成功同步的快照已超过新鲜度阈值时
- **THEN** 状态载荷包含明确的 stale/degraded 标记、最近成功同步时间与失败原因（如有）

### Requirement: Configurable ingestion source
系统 SHALL 支持通过运行时配置选择默认摄取模式，至少包括 `mock` 与 `real` 两种模式；在启用真实模式时，系统 MUST 通过后台同步流程更新 PostgreSQL 中的规范化快照，而不要求 dashboard 查询链路在请求时直接访问真实 provider。

#### Scenario: Service starts in real mode
- **WHEN** 部署环境将默认摄取模式设置为 `real`
- **THEN** 系统初始化真实数据同步配置，并使查询链路从 PostgreSQL 读取最近一次成功同步的快照

#### Scenario: Service starts in mock mode
- **WHEN** 部署环境未提供真实数据配置或显式将模式设置为 `mock`
- **THEN** 系统继续使用现有 mock 摄取源，保持本地开发与测试行为稳定

## ADDED Requirements

### Requirement: Background real-data synchronization
系统 SHALL 提供后台同步流程，以固定周期从真实 provider 拉取飞行数据、归一化为小时级快照并写入 PostgreSQL；同步流程 MUST 记录最近一次尝试时间、最近一次成功时间以及最近失败原因。

#### Scenario: Scheduled sync writes normalized snapshots
- **WHEN** 后台同步任务按计划执行且真实 provider 返回有效数据时
- **THEN** 系统将规范化后的小时级快照与同步状态写入 PostgreSQL，供后续查询链路直接读取

#### Scenario: Sync failure updates sync status
- **WHEN** 后台同步任务请求真实 provider 失败、超时或返回不可归一化的数据时
- **THEN** 系统更新同步失败状态与原因，并保留最近一次成功同步的数据供查询链路继续使用

### Requirement: Query path reads persisted snapshots
系统 SHALL 在真实模式下优先从 PostgreSQL 中读取最近一次成功同步的规范化快照，以驱动基线、预测、评分与 dashboard 状态，而不是在读请求期间直接拉取外部 provider。

#### Scenario: Read path uses PostgreSQL snapshots
- **WHEN** dashboard 或 API 请求当前异常状态且 PostgreSQL 中已有足够的规范化历史快照
- **THEN** 系统仅使用本地持久化快照完成评估与响应

#### Scenario: Persisted history is insufficient
- **WHEN** PostgreSQL 中没有足够的规范化历史快照来完成评估
- **THEN** 系统返回明确的数据不足或同步未完成状态，而不是在该请求中直接访问真实 provider
