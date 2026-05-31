# Design

## Context

当前实现已经支持通过 `ANOMALY_PG_URL` 或 `DATABASE_URL` 传入 PostgreSQL 连接串，真实模式下的仓储层也会在有连接串时构造 `PgSnapshotRepository`。但从运行时视角看，这个能力仍不完整：一方面，服务启动时不会主动确认数据库是否可达；另一方面，健康检查和状态输出也不会明确告知“当前是否真的连上了数据库、连的是哪个目标、失败发生在配置阶段还是连接阶段”。

已有归档设计已经明确两项可复用决策：一是 PostgreSQL 仍然是后台同步与查询链路的唯一持久化存储；二是真实模式依赖稳定的本地持久化链路，而不是把 request-time fetch 作为主路径。本次设计不改变这些决策，而是在它们之上补齐“数据库连接可配置、可验证、可观测”的运行时能力。

## Goals / Non-Goals

**Goals:**

- 明确数据库连接配置入口、优先级和真实模式下的必填约束。
- 在真实模式启动后尽早验证 PostgreSQL 可连接性，而不是等到首次读写再被动失败。
- 为健康检查或状态接口补充结构化数据库连接状态，便于快速确认当前连接目标与失败原因。
- 更新开发说明，提供本地 PostgreSQL 最小接入步骤，降低联调成本。

**Non-Goals:**

- 不在本次设计中替换 PostgreSQL 驱动或引入新的 ORM / migration framework。
- 不在本次设计中重写后台同步逻辑、评分逻辑或 dashboard 数据模型。
- 不在本次设计中解决多数据库、读写分离或连接池调优等扩展性议题。
- 不把敏感连接信息完整暴露给前端或非受保护日志。

## Decisions

1. 继续以环境变量作为唯一数据库配置入口，但收紧为明确优先级与模式约束。

   `ANOMALY_PG_URL` 继续优先于 `DATABASE_URL`，这样 anomaly 模块可以独立于仓库其他潜在数据库用途配置。真实模式下若两者都不存在，应返回明确的 validation error；mock 模式允许为空。替代方案是把连接串写入 Nuxt runtime config 文件，但当前仓库并没有独立配置层，且环境变量更符合部署习惯。

2. 增加显式的数据库连通性检查，而不只依赖首次业务查询触发。

   当前仓储对象只有在读写时才会触发表创建和连接获取，导致服务看起来已启动，但数据库问题会延后到首次同步或查询时才暴露。增加轻量级 `ping` 或 `connect + SELECT 1` 检查，可以在服务启动或健康检查时更早发现问题。替代方案是保持懒连接，但排障成本更高。

3. 数据库状态通过服务端健康信息输出，且默认只暴露安全摘要。

   需要让开发者知道“数据库已连接/未连接/配置缺失/连接失败”，同时避免把完整连接串泄漏到前端。建议输出结构化状态，如 `configured`、`reachable`、`databaseName`、`host` 的安全摘要，以及 `failureReason`。替代方案是只打日志，但接口化状态更适合自动检查和测试断言。

4. 将“数据库未就绪”视为真实模式下的一级运行状态，而不是普通日志。

   对当前系统来说，真实模式下 PostgreSQL 不可达意味着后台同步与持久化查询链路都不成立，因此这是系统行为级问题，不只是实现细节。健康检查和同步状态应能区分“未配置数据库”和“数据库配置存在但连接失败”。替代方案是统一归为 degraded，但会丢失排障信息。

5. 开发文档需要提供最小本地联调路径。

   当前 README 提到了环境变量，但没有告诉用户如何确认实际连到了哪个库、如何验证 schema 已创建、以及真实模式启动失败时该看什么。补上这类步骤可以显著降低“我以为已经连上数据库”这类误判。替代方案是仅依赖口头说明，但不利于后续协作。

## Risks / Trade-offs

- [启动时增加数据库探测会引入额外失败点] → 使用轻量级检查并限制在真实模式或显式健康检查时触发。
- [过度暴露连接信息可能泄漏敏感数据] → 仅输出安全摘要，不返回用户名、密码或完整连接串。
- [健康接口加入数据库状态后，测试夹具需要同步更新] → 将新增字段设计为结构化且可预测，补充对应断言。
- [配置缺失和连接失败若混为一类，会增加排障成本] → 分别建模 `not-configured`、`unreachable`、`ready` 等状态。

## Migration Plan

1. 在配置层增加数据库配置解析结果与状态结构，保持 mock 模式默认行为不变。
2. 在仓储层增加轻量级连接检查接口，供启动阶段或健康接口复用。
3. 扩展健康检查或状态接口，输出数据库连接状态摘要。
4. 更新 README，补充 `.env` 示例、连接确认方式与常见失败排查。
5. 在具备本地 PostgreSQL 的环境中验证真实模式启动、健康状态与失败提示；如需回滚，可先保留旧接口字段并关闭主动连接检查。

## Open Questions

- 数据库连通性检查应仅放在健康接口，还是在 Nitro 启动阶段就主动执行一次？
- 健康接口是否需要返回当前实际 database name / host，还是只返回抽象状态与失败原因？
- 如果仓库未来接入其他数据库用途，`DATABASE_URL` 是否仍应作为 anomaly 模块的回退来源？

# Specs

## aircraft-anomaly-monitoring

## MODIFIED Requirements

### Requirement: Configurable ingestion source
系统 SHALL 支持通过运行时配置选择默认摄取模式，至少包括 `mock` 与 `real` 两种模式；在启用真实模式时，系统 MUST 通过后台同步流程更新 PostgreSQL 中的规范化快照，而不要求 dashboard 查询链路在请求时直接访问真实 provider。系统同时 MUST 明确 PostgreSQL 连接配置来源与优先级，并在真实模式下将数据库连接视为必需运行依赖。

#### Scenario: Service starts in real mode with explicit database configuration
- **WHEN** 部署环境将默认摄取模式设置为 `real` 且提供了 `ANOMALY_PG_URL` 或 `DATABASE_URL`
- **THEN** 系统解析 PostgreSQL 连接配置，并将其作为真实模式的持久化存储目标

#### Scenario: Real mode starts without database configuration
- **WHEN** 部署环境将默认摄取模式设置为 `real` 但未提供 `ANOMALY_PG_URL` 和 `DATABASE_URL`
- **THEN** 系统返回明确的配置校验错误，并将真实模式标记为未就绪，而不是静默退回无持久化实现

### Requirement: Background real-data synchronization
系统 SHALL 提供后台同步流程，以固定周期从真实 provider 拉取飞行数据、归一化为小时级快照并写入 PostgreSQL；同步流程 MUST 记录最近一次尝试时间、最近一次成功时间以及最近失败原因。

#### Scenario: Sync starts with reachable database
- **WHEN** 真实模式已启用且 PostgreSQL 可连接
- **THEN** 后台同步流程可以写入规范化快照与同步状态，供后续查询链路直接读取

#### Scenario: Sync detects unreachable database
- **WHEN** 真实模式已启用、数据库配置存在，但 PostgreSQL 连接失败或不可达
- **THEN** 系统返回明确的数据库不可达状态与失败原因，并阻止把同步链路误报为正常

## ADDED Requirements

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
