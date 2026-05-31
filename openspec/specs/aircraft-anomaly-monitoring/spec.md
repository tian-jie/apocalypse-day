## ADDED Requirements

### Requirement: Hourly aircraft snapshots
系统 SHALL 将航空活动表示为按小时聚合的快照，包含观测时间、起飞数、降落数、活跃航空器数量、重点城市起飞计数、目的地集中度、跨境比例、身份缺失比例以及可选的上下文标记；系统同时 SHALL 为每个最新快照保留来源类别、来源时间戳、新鲜度或降级状态等摄取元数据，以区分真实数据、mock 数据与回退数据。

#### Scenario: Snapshot contains anomaly inputs
- **WHEN** 系统从 mock 或真实数据源摄取一条小时级航空活动记录时
- **THEN** 系统存储基线对比、预测复盘、评分与解释所需的聚合指标，并保留足够的来源元数据供 API 与 dashboard 使用

#### Scenario: Real provider payload is normalized
- **WHEN** 系统收到来自真实 provider 的原始航空活动数据时
- **THEN** 系统在进入基线、预测与评分流程前将其转换为统一的小时级快照结构

### Requirement: Historical baseline comparison
系统 SHALL 基于相关时间窗口匹配的历史快照计算预期活动基线，包括小时、星期几以及近期滚动历史。

#### Scenario: Baseline generated for current hour
- **WHEN** 系统评估一个新的小时级快照时
- **THEN** 系统生成异常评分流程所需指标的预期范围

### Requirement: Next-hour prediction
系统 SHALL 为下一小时生成预测，内容包括预期指标范围以及基于近期趋势和历史基线数据的简短说明。

#### Scenario: Prediction recorded before next snapshot
- **WHEN** 系统完成当前小时的评估时
- **THEN** 系统记录下一小时的预测，以便在实际数据到达后进行复盘

### Requirement: Prediction review
系统 SHALL 将每一次已完成的预测与该小时的实际快照进行比较，并计算被追踪指标的偏差。

#### Scenario: Actual data arrives for predicted hour
- **WHEN** 某个先前已预测小时的实际快照可用时
- **THEN** 系统记录预测与实际之间的偏差，并识别偏差最强的驱动因素

### Requirement: Five-level anomaly score
系统 SHALL 将归一化偏差和加权异常信号映射为 1 到 5 的整数异常等级，其中 1 表示常态行为，5 表示极端偏离。

#### Scenario: Routine behavior receives low score
- **WHEN** 实际航空活动在大多数被追踪指标上仍处于预期范围内时
- **THEN** 系统分配 1 级或 2 级异常等级

#### Scenario: Extreme synchronized deviation receives high score
- **WHEN** 航空活动在多个加权信号上显著超出预期范围时
- **THEN** 系统分配 4 级或 5 级异常等级，并包含主要驱动因素

### Requirement: Anomaly explanation
系统 SHALL 为每个异常分数生成简洁解释，说明当前等级、主要驱动因素、预测与实际差异，以及在可用时补充可能的正常背景因素。

#### Scenario: Dashboard requests current explanation
- **WHEN** dashboard 加载最新异常状态时
- **THEN** 它无需重新计算分数即可获得当前等级的人类可读解释

### Requirement: Dashboard status output
系统 SHALL 暴露可供 dashboard 直接使用的状态数据，包括当前等级、上一等级、趋势、最新快照指标、预测复盘、主要异常驱动因素与解释；系统同时 SHALL 暴露当前数据的新鲜度、最近一次成功同步时间、同步健康度以及同步失败原因，使客户端能够明确识别当前状态是否来自本地已同步数据。

#### Scenario: Current status is displayed from synchronized data
- **WHEN** 用户打开异常 dashboard 且 PostgreSQL 中存在最近一次成功同步的小时级快照时
- **THEN** dashboard 通过单个状态载荷展示当前全局异常状态、近期变化、支撑证据以及同步状态，而无需在请求时直接访问外部 provider

#### Scenario: Dashboard shows stale synchronized data
- **WHEN** PostgreSQL 中最近一次成功同步的快照已超过新鲜度阈值时
- **THEN** 状态载荷包含明确的 stale/degraded 标记、最近成功同步时间与失败原因（如有）

### Requirement: Localized dashboard copy
系统 SHALL 支持至少中文和英文两种 locale，并能够按用户选择输出对应语言的 dashboard 文案、解释文本与场景说明。

#### Scenario: User switches locale
- **WHEN** 用户将界面语言从中文切换为英文时
- **THEN** dashboard 标题、解释文本、主要驱动因素描述与场景标签应切换为英文

#### Scenario: API returns localized explanation
- **WHEN** 客户端以指定 locale 请求异常状态接口时
- **THEN** 接口返回的 headline、summary、drivers、window 与 benign context 应使用对应语言

### Requirement: Configurable ingestion source
系统 SHALL 支持通过运行时配置选择默认摄取模式，至少包括 `mock` 与 `real` 两种模式；在启用真实模式时，系统 MUST 通过后台同步流程更新 PostgreSQL 中的规范化快照，而不要求 dashboard 查询链路在请求时直接访问真实 provider。系统同时 MUST 明确 PostgreSQL 连接配置来源与优先级，并在真实模式下将数据库连接视为必需运行依赖。

#### Scenario: Service starts in real mode
- **WHEN** 部署环境将默认摄取模式设置为 `real` 且提供了 `ANOMALY_PG_URL` 或 `DATABASE_URL`
- **THEN** 系统解析 PostgreSQL 连接配置，并将其作为真实模式的持久化存储目标

#### Scenario: Real mode starts without database configuration
- **WHEN** 部署环境将默认摄取模式设置为 `real` 但未提供 `ANOMALY_PG_URL` 和 `DATABASE_URL`
- **THEN** 系统返回明确的配置校验错误，并将真实模式标记为未就绪，而不是静默退回无持久化实现

#### Scenario: Service starts in mock mode
- **WHEN** 部署环境未提供真实数据配置或显式将模式设置为 `mock`
- **THEN** 系统继续使用现有 mock 摄取源，保持本地开发与测试行为稳定

### Requirement: Background real-data synchronization
系统 SHALL 提供后台同步流程，以固定周期从真实 provider 拉取飞行数据、归一化为小时级快照并写入 PostgreSQL；同步流程 MUST 记录最近一次尝试时间、最近一次成功时间以及最近失败原因。

#### Scenario: Scheduled sync writes normalized snapshots
- **WHEN** 后台同步任务按计划执行且真实 provider 返回有效数据时
- **THEN** 系统将规范化后的小时级快照与同步状态写入 PostgreSQL，供后续查询链路直接读取

#### Scenario: Sync failure updates sync status
- **WHEN** 后台同步任务请求真实 provider 失败、超时或返回不可归一化的数据时
- **THEN** 系统更新同步失败状态与原因，并保留最近一次成功同步的数据供查询链路继续使用

#### Scenario: Sync detects unreachable database
- **WHEN** 真实模式已启用、数据库配置存在，但 PostgreSQL 连接失败或不可达
- **THEN** 系统返回明确的数据库不可达状态与失败原因，并阻止把同步链路误报为正常

### Requirement: Database connection observability
系统 SHALL 为真实模式暴露结构化数据库连接状态，使开发与运维可以确认当前数据库依赖是否已配置、是否可达以及失败发生在哪个阶段；该状态输出 MUST 避免暴露完整连接串等敏感信息。

#### Scenario: Health endpoint shows database readiness
- **WHEN** 服务运行在真实模式且数据库连接检查成功
- **THEN** 健康检查或等价的服务端状态接口返回数据库已配置、可达和安全摘要后的目标信息

#### Scenario: Health endpoint shows database failure
- **WHEN** 服务运行在真实模式且数据库未配置或连接检查失败
- **THEN** 健康检查或等价的服务端状态接口返回明确的数据库未就绪状态和可排障的失败原因

#### Scenario: Mock mode does not require database readiness
- **WHEN** 服务运行在 `mock` 模式
- **THEN** 系统不将 PostgreSQL 连接状态作为 mock 模式可用性的前置条件

### Requirement: Query path reads persisted snapshots
系统 SHALL 在真实模式下优先从 PostgreSQL 中读取最近一次成功同步的规范化快照，以驱动基线、预测、评分与 dashboard 状态，而不是在读请求期间直接拉取外部 provider。

#### Scenario: Read path uses PostgreSQL snapshots
- **WHEN** dashboard 或 API 请求当前异常状态且 PostgreSQL 中已有足够的规范化历史快照
- **THEN** 系统仅使用本地持久化快照完成评估与响应

#### Scenario: Persisted history is insufficient
- **WHEN** PostgreSQL 中没有足够的规范化历史快照来完成评估
- **THEN** 系统返回明确的数据不足或同步未完成状态，而不是在该请求中直接访问真实 provider

### Requirement: Graceful fallback for real-data ingestion
系统 SHALL 在真实数据获取失败、响应超时、字段无法归一化或最新数据超过新鲜度阈值时，生成明确的摄取失败或降级状态；若部署启用了回退策略，系统 MUST 回退到受控的备用数据源，并在输出中显式标记该回退。

#### Scenario: Real source request fails with fallback enabled
- **WHEN** 后台同步任务请求真实 provider 失败且运行时配置允许回退
- **THEN** 系统返回回退后的状态结果，并显式标记当前数据并非来自真实源

#### Scenario: Real source data is stale without fallback
- **WHEN** 最近一次成功同步的真实快照早于配置的新鲜度阈值且未启用回退
- **THEN** 系统返回明确的 stale/degraded 摄取状态，供 API 和 dashboard 向用户展示
