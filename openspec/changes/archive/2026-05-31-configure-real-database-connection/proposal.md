## Why

当前仓库已经支持通过环境变量传入 PostgreSQL 连接串，但对“真实连接数据库”的行为仍不够完整：缺少统一的配置落点、启动时连接校验、连接失败可观测状态，以及面向本地开发/部署的明确说明。现在需要把数据库连接从“代码里可以传 URL”提升为“运行时可明确启用、可验证、可排障的真实数据库接入能力”，这样后续真实数据同步和查询链路才有稳定基础。

## What Changes

- 明确 PostgreSQL 连接配置约定，包括优先级、必填条件和推荐的环境变量入口。
- 为真实模式增加数据库连接校验与失败状态暴露，避免服务看似启动成功但实际未连上数据库。
- 补充连接健康检查或启动日志语义，使开发环境和部署环境都能快速确认当前数据库目标与连接结果。
- 更新开发说明，提供本地 PostgreSQL 配置示例与最小联调步骤。

## Capabilities

### New Capabilities
- 无

### Modified Capabilities
- `aircraft-anomaly-monitoring`: 明确真实模式下 PostgreSQL 连接的配置、校验和状态输出要求，确保后台同步与查询链路建立在真实可用的数据库连接之上。

## Impact

- 影响 `server/lib/anomaly/config.ts`、`server/lib/anomaly/repository.ts`、数据库相关启动/健康检查逻辑以及开发文档。
- 可能影响 `server/api/health.get.ts` 或异常状态 API 中的连接状态输出。
- 需要补充针对数据库连接配置解析、连接失败提示和健康状态输出的测试。
