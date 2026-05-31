## ADDED Requirements

### Requirement: Hourly aircraft snapshots
系统 SHALL 将航空活动表示为按小时聚合的快照，包含观测时间、起飞数、降落数、活跃航空器数量、重点城市起飞计数、目的地集中度、跨境比例、身份缺失比例以及可选的上下文标记。

#### Scenario: Snapshot contains anomaly inputs
- **WHEN** 系统摄取一条小时级航空活动记录时
- **THEN** 系统存储基线对比、预测复盘、评分与解释所需的聚合指标

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
系统 SHALL 暴露可供 dashboard 直接使用的状态数据，包括当前等级、上一等级、趋势、最新快照指标、预测复盘、主要异常驱动因素与解释。

#### Scenario: Current status is displayed
- **WHEN** 用户打开异常 dashboard 时
- **THEN** dashboard 可以通过单个状态载荷展示当前全局异常状态、近期变化和支撑证据

### Requirement: Localized dashboard copy
系统 SHALL 支持至少中文和英文两种 locale，并能够按用户选择输出对应语言的 dashboard 文案、解释文本与场景说明。

#### Scenario: User switches locale
- **WHEN** 用户将界面语言从中文切换为英文时
- **THEN** dashboard 标题、解释文本、主要驱动因素描述与场景标签应切换为英文

#### Scenario: API returns localized explanation
- **WHEN** 客户端以指定 locale 请求异常状态接口时
- **THEN** 接口返回的 headline、summary、drivers、window 与 benign context 应使用对应语言
