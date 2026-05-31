# Design

## Context

当前实现已经通过 `AircraftSnapshotIngestionSource` 将摄取层与评分层解耦，但默认 `defaultIngestionSource` 仍固定为 `MockAircraftSnapshotSource`，并通过 fixture `scenarioId` 返回预制小时快照。归档设计与现有 capability spec 已经明确三项长期约束：一是内部分析始终围绕小时级聚合快照进行，二是评分与解释保持确定性和可解释性，三是 dashboard 依赖稳定的状态契约而不是在前端重复计算。

这意味着“开始使用真实数据”不应推翻当前评分、预测与解释流程，而应在摄取边界内增加真实数据适配器、运行时源选择、失败回退与数据新鲜度表达。设计还需要兼顾本地开发与演示环境，因此 mock 模式不能被移除，只能降级为可选来源或回退来源。

复用的既有设计决策包括：继续使用小时级聚合快照作为内部标准结构、保持分数计算逻辑独立于数据源、继续提供可直接驱动 dashboard 的单一状态载荷，以及继续使用轻量级 locale 输出文案。

## Goals / Non-Goals

**Goals:**

- 在现有摄取接口外侧增加真实航空数据适配器，并将外部提供方数据归一化为当前小时级快照模型。
- 使用 PostgreSQL 持久化规范化后的小时快照与摄取状态，使真实数据链路具备跨重启可恢复性。
- 支持通过运行时配置选择 `mock` 或 `real` 作为默认摄取模式。
- 为 API 和 dashboard 暴露数据来源、最新数据时间、新鲜度与降级状态，避免把回退数据误认为真实实时数据。
- 在真实数据不可用、超时、字段缺失或过旧时，提供可预测的降级行为，并保持评分链路尽量可用。
- 尽量保持现有评分、预测、解释和本地化实现不变，使变更集中在摄取与状态封装层。

**Non-Goals:**

- 不在本次设计中重写异常评分模型、预测算法或 explanation 文案策略。
- 不在本次设计中引入原始逐飞机轨迹存储、PostgreSQL 之外的额外分析数据库或新的前端页面。
- 不承诺一次性支持多个真实数据提供方；MVP 只需要先定义单个 provider 适配接口与替换点。
- 不移除 mock fixtures；它们仍用于本地开发、测试和真实源故障时的受控回退。

## Decisions

1. 保持 `HourlyAircraftSnapshot` 作为内部唯一分析输入，并在外层新增摄取元数据。

   真实提供方往往返回逐架次或逐位置记录，而当前评分链路已经围绕小时聚合结构构建。继续以 `HourlyAircraftSnapshot` 作为内部标准对象，可以最大程度复用 baseline、prediction、review 与 scoring 代码。相比直接把外部 provider payload 传入后续模块，这种方式需要额外做一次归一化，但能把 provider 差异限制在适配器边界内。

2. 将默认摄取源从固定实例改为基于配置解析的 source resolver。

   当前 `defaultIngestionSource` 在模块加载时固定指向 mock 实现，不足以表达部署环境差异。改为通过环境变量或运行时配置解析 `mock` / `real` / `real-with-fallback` 等模式，可以在不改调用方的前提下切换来源。替代方案是在每个 API 调用中显式传入 source，但那会把部署配置扩散到多个调用面。

3. 真实数据适配器负责“抓取 + 聚合 + 字段修复”，评分层只消费规范化结果。

   provider 返回字段不一定与内部指标一一对应，例如跨境比例、重点城市起飞量或身份缺失比例可能需要从原始记录推导。把这些推导集中在 adapter 层，可以保证评分层继续只处理完整、同构的数据结构。替代方案是让评分层感知缺失字段并分支处理，但那会显著提高复杂度并削弱可测试性。

4. 使用 PostgreSQL 作为真实数据模式下的唯一持久化存储。

   真实数据接入后需要保存最近成功抓取的小时快照、摄取状态、来源时间戳与回退原因，以支撑基线计算、重启恢复和排障。选择 PostgreSQL 可以满足结构化查询、一致性和后续扩展需要，也与用户给定的数据库约束一致。替代方案是仅用内存缓存或引入额外时序数据库；前者无法跨重启保留状态，后者会扩大 MVP 复杂度。

5. Dashboard/API 新增显式 ingestion status，而不是隐式通过 summary 文案表达。

   当系统使用回退数据或读取到过旧快照时，如果仅靠自然语言摘要提示，客户端很难稳定判断状态。应新增结构化字段，例如 source kind、snapshot freshness、degraded flag、fallback reason、provider timestamp，使 UI 和测试都能稳定识别。替代方案是将这些信息埋入 explanation 文本，但那不利于程序消费。

6. 真实数据失败时优先“有状态降级”，而不是静默切换。

   对外部数据源而言，超时、限流、字段异常和空数据都属于正常故障模式。系统可以在配置允许时回退到 mock，但必须把“当前结果并非真实数据”作为结构化状态暴露出来；若未开启回退，则返回明确的摄取失败状态。静默回退虽然最省事，但会制造错误的产品认知。

7. 凭证、PostgreSQL 连接信息和提供方参数全部走环境配置，不写入代码仓库。

   真实数据接入必然引入 endpoint、token、超时、freshness threshold 与数据库连接串等参数，这些都应由环境变量提供，并在服务启动时校验。替代方案是把默认值硬编码在模块内部，但那不利于不同环境的安全配置与运维管理。

## Risks / Trade-offs

- [真实 provider 的字段定义与现有指标不完全对齐] → 在 adapter 层提供明确映射表与缺失字段兜底规则，并为归一化逻辑补充测试样例。
- [实时数据延迟或长时间无更新会降低结论可信度] → 引入 freshness threshold，并在 API 中显式返回 stale/degraded 状态。
- [PostgreSQL schema 设计不当会放大写入和查询成本] → 首版只保存小时级聚合快照与必要摄取状态，避免过早持久化原始逐架次数据。
- [静默回退会让用户误以为看到的是真实数据] → 所有回退结果都必须携带 source 与 fallback reason，前端据此展示提示。
- [真实源请求失败会增加接口尾延迟] → 为 provider 请求设置超时，并在超时后走降级或失败分支，而不是无限等待。
- [当前类型使用 `scenarioId` 表示数据场景，与真实模式语义不完全匹配] → 在实现时补充来源标识字段，并逐步把场景概念限制在 mock 模式内部。

## Migration Plan

1. 先引入 PostgreSQL 连接、schema 与持久化访问层，但保持默认模式为 `mock`，确保现有开发流程不受影响。
2. 接入真实数据 adapter、source resolver 与配置校验，并将规范化快照与摄取状态写入 PostgreSQL。
3. 为 dashboard 状态与 API 响应补充 ingestion metadata，并同步更新测试夹具与断言。
4. 在具备 provider 凭证的环境中开启 `real-with-fallback`，优先观察字段映射、新鲜度、数据库写入与降级表现。
5. 在真实源稳定后，再将生产默认模式切换为 `real` 或 `real-with-fallback`。
6. 如需回滚，只需将运行时模式切回 `mock`，数据库可保留但不参与当前读路径。

## Open Questions

- 首个真实数据 provider 的协议与字段集合是什么，是否直接提供聚合结果，还是必须从原始航班/位置记录自行聚合？
- PostgreSQL 访问层是直接使用 `pg` 驱动，还是再叠加查询/迁移工具封装？
- 当真实源处于 `real-with-fallback` 模式时，前端是否需要单独展示“当前为回退数据”的高优先级提示？
- 对“数据过旧”的判定阈值应按分钟还是按小时配置，是否需要区分演示环境与生产环境？

# Specs

## aircraft-anomaly-monitoring

## MODIFIED Requirements

### Requirement: Hourly aircraft snapshots
系统 SHALL 将航空活动表示为按小时聚合的快照，包含观测时间、起飞数、降落数、活跃航空器数量、重点城市起飞计数、目的地集中度、跨境比例、身份缺失比例以及可选的上下文标记；系统同时 SHALL 为每个最新快照保留来源类别、来源时间戳、新鲜度或降级状态等摄取元数据，以区分真实数据、mock 数据与回退数据。

#### Scenario: Snapshot contains anomaly inputs
- **WHEN** 系统从 mock 或真实数据源摄取一条小时级航空活动记录时
- **THEN** 系统存储基线对比、预测复盘、评分与解释所需的聚合指标，并保留足够的来源元数据供 API 与 dashboard 使用

#### Scenario: Real provider payload is normalized
- **WHEN** 系统收到来自真实 provider 的原始航空活动数据时
- **THEN** 系统在进入基线、预测与评分流程前将其转换为统一的小时级快照结构

### Requirement: Dashboard status output
系统 SHALL 暴露可供 dashboard 直接使用的状态数据，包括当前等级、上一等级、趋势、最新快照指标、预测复盘、主要异常驱动因素与解释；系统同时 SHALL 暴露当前摄取来源、最新成功数据时间、数据新鲜度以及是否处于降级/回退状态，使客户端能够明确识别当前状态是否基于真实数据。

#### Scenario: Current status is displayed
- **WHEN** 用户打开异常 dashboard 时
- **THEN** dashboard 可以通过单个状态载荷展示当前全局异常状态、近期变化、支撑证据以及当前摄取状态

#### Scenario: Dashboard shows degraded ingestion
- **WHEN** 最新一次评估使用了回退数据或检测到真实数据已过新鲜度阈值时
- **THEN** 状态载荷包含明确的降级标记、原因与时间信息，且客户端无需解析自然语言说明即可识别该状态

## ADDED Requirements

### Requirement: Configurable ingestion source
系统 SHALL 支持通过运行时配置选择默认摄取模式，至少包括 `mock` 与 `real` 两种模式，并在启用真实模式时初始化对应的真实数据适配器，而不要求评分逻辑感知 provider 差异。

#### Scenario: Service starts in real mode
- **WHEN** 部署环境将默认摄取模式设置为 `real`
- **THEN** 系统初始化真实数据适配器并将其作为默认快照来源

#### Scenario: Service starts in mock mode
- **WHEN** 部署环境未提供真实数据配置或显式将模式设置为 `mock`
- **THEN** 系统继续使用现有 mock 摄取源，保持本地开发与测试行为稳定

### Requirement: Graceful fallback for real-data ingestion
系统 SHALL 在真实数据获取失败、响应超时、字段无法归一化或最新数据超过新鲜度阈值时，生成明确的摄取失败或降级状态；若部署启用了回退策略，系统 MUST 回退到受控的备用数据源，并在输出中显式标记该回退。

#### Scenario: Real source request fails with fallback enabled
- **WHEN** 真实数据适配器请求失败且运行时配置允许回退
- **THEN** 系统返回回退后的状态结果，并显式标记当前数据并非来自真实源

#### Scenario: Real source data is stale without fallback
- **WHEN** 最新一次成功获取的真实快照早于配置的新鲜度阈值且未启用回退
- **THEN** 系统返回明确的 stale/degraded 摄取状态，供 API 和 dashboard 向用户展示
