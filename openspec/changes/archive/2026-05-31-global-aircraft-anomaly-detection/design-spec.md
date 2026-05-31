# Design

## Context

当前仓库已经将产品定位统一为 Aether Watch，并采用标语 “Tracking black swan signals in the sky.”。本次变更引入第一个明确的产品能力：一个按小时运行的航空异常监测流程，用于将观测到的飞行行为与历史预期进行比较，并输出 1 到 5 级异常等级。

在真实飞行数据接入尚未最终确定之前，系统也应具备可用性，因此第一版实现需要清晰的数据摄取接口以及预置的 mock 数据。核心分数必须保持可解释、可量化；LLM 的使用范围仅限于预测辅助、复盘摘要和面向用户的解释文本。

## Goals / Non-Goals

**Goals:**

- 将每小时航空活动建模为快照，先支持从 mock 数据摄取，后续再扩展到真实的 ADS-B 类数据源。
- 基于小时、星期几以及近期滚动历史等时间维度建立历史基线。
- 预测下一小时的预期活动范围，并在实际快照到达后对上一轮预测进行复盘。
- 将偏差和加权异常信号转换为透明的 1 到 5 级异常等级。
- 生成可直接用于 dashboard 的输出，解释当前等级、关键驱动因素与近期趋势。
- 支持中英双语 locale，使 dashboard 文案、解释文本和场景说明可以按语言切换。

**Non-Goals:**

- 不宣称能够预测灾难，也不声称能确定识别某个具体现实事件。
- 在 MVP 中不识别、不指控、也不暴露具体飞机所有者。
- 不让 LLM 成为风险分数的唯一来源。
- 第一版实现不纳入金融、航运、社交媒体或更广泛情报信号。
- 第一版不做复杂翻译平台、远程词条管理或多地区日期格式体系。

## Decisions

1. 先在摄取接口之后使用 mock 的小时级数据。

   这样可以在无需等待数据提供方凭证或 API 方案确定的前提下，先完成产品形态、评分流程和 dashboard。替代方案是直接接入实时 ADS-B 数据，但那会在核心流程尚未验证之前，过早引入数据源限制、数据质量问题和合规性问题。

2. 每个小时使用聚合快照表示，而不是保存原始逐飞机轨迹。

   MVP 需要的异常信号包括起飞数量、重点城市起飞量、目的地集中度、跨境比例和身份缺失指标等。聚合快照可以降低隐私风险，并保持第一版评分模型简洁。如果后续需要航线级分析，再引入原始轨迹即可。

3. 评分保持确定性与可解释性。

   系统应基于历史基线对偏差进行归一化，应用可见的权重，再将结果映射到 1 到 5 级。替代方案是直接让 LLM 给出分数，但那会更难测试、审计和调优。

4. 将 LLM 输出定位为解释层与可选预测辅助。

   LLM 适合总结分数变化原因，并补充节假日、天气或大型会议等可能的正常解释。但在未来未做明确设计之前，它不应覆盖数值评分引擎的结果。

5. 将 dashboard 输出设计成稳定的数据契约。

   后端应提供当前等级、上一等级、趋势、预测与实际对比值、主要异常驱动因素以及简洁解释。这样可以让前端专注于展示，而不是在 UI 中重复实现评分逻辑。

6. 使用轻量级 locale 字典，而不是先引入完整 i18n 平台。

   当前 MVP 的语言范围仅为中文和英文，且文案集中在 dashboard 与解释文本。先使用前端和后端各自的 locale 字典即可满足切换需求，并保持改动面可控；后续若语言数量继续增长，再迁移到更完整的国际化方案。

## Risks / Trade-offs

- 节假日、天气、体育赛事、会议或区域性扰动可能造成误报 -> 需要加入上下文字段、解释文本和针对正常波动的回测样例。
- 航空数据可能不完整或被匿名化 -> 应基于聚合行为评分，并引入身份缺失指标，而不是依赖精确的飞机身份。
- 容易夸大系统确定性 -> 应使用“异常”“信号”“偏差”等措辞，避免对灾难或因果关系做确定性表述。
- 早期阈值可能显得武断 -> 从透明阈值、固定样例和明确的调参点开始。
- mock 数据可能掩盖真实世界中的数据质量问题 -> 保持摄取层隔离，以便后续独立接入并测试真实数据源适配器。
- 前后端语言词条可能漂移 -> 将 locale 作为 API 显式输入，并为中英文输出补充测试。

# Specs

## aircraft-anomaly-monitoring

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