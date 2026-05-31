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
系统 SHALL 暴露可供 dashboard 直接使用的状态数据，包括当前等级、上一等级、趋势、最新快照指标、预测复盘、主要异常驱动因素与解释；系统同时 SHALL 暴露当前摄取来源、最新成功数据时间、数据新鲜度以及是否处于降级/回退状态，使客户端能够明确识别当前状态是否基于真实数据。

#### Scenario: Current status is displayed
- **WHEN** 用户打开异常 dashboard 时
- **THEN** dashboard 可以通过单个状态载荷展示当前全局异常状态、近期变化、支撑证据以及当前摄取状态

#### Scenario: Dashboard shows degraded ingestion
- **WHEN** 最新一次评估使用了回退数据或检测到真实数据已过新鲜度阈值时
- **THEN** 状态载荷包含明确的降级标记、原因与时间信息，且客户端无需解析自然语言说明即可识别该状态

### Requirement: Localized dashboard copy
系统 SHALL 支持至少中文和英文两种 locale，并能够按用户选择输出对应语言的 dashboard 文案、解释文本与场景说明。

#### Scenario: User switches locale
- **WHEN** 用户将界面语言从中文切换为英文时
- **THEN** dashboard 标题、解释文本、主要驱动因素描述与场景标签应切换为英文

#### Scenario: API returns localized explanation
- **WHEN** 客户端以指定 locale 请求异常状态接口时
- **THEN** 接口返回的 headline、summary、drivers、window 与 benign context 应使用对应语言

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
