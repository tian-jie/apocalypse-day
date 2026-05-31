## Why

当前真实飞行数据是在用户请求 dashboard 时即时拉取、归一化并持久化，这会把外部 provider 的延迟、限流和不稳定性直接带到读请求链路里。现在需要把“取数”与“展示/评分”解耦，让真实数据通过后台同步进入 PostgreSQL，而 API 和 dashboard 只消费本地规范化数据，从而提升稳定性、可预测性和分析一致性。

## What Changes

- 增加后台真实数据同步流程，按固定周期从外部 provider 拉取、归一化并写入 PostgreSQL。
- 将 dashboard 和异常评分读路径改为优先读取 PostgreSQL 中最近一次成功同步的小时级快照，而不是在请求时直接访问外部 provider。
- 为同步任务补充状态记录、最近成功同步时间和失败原因，使 API 可以暴露“数据是否新鲜、同步是否异常”。
- 明确区分“同步链路”与“查询链路”的运行职责，为后续移除 mock fallback 和独立调度部署提供边界。

## Capabilities

### New Capabilities
- 无

### Modified Capabilities
- `aircraft-anomaly-monitoring`: 将真实数据获取方式从请求时拉取改为后台同步入库，并调整状态输出以反映同步状态与数据新鲜度。

## Impact

- 影响 `server/lib/anomaly/ingestion.ts`、`server/lib/anomaly/repository.ts`、`server/lib/anomaly/dashboard.ts` 以及异常状态 API 的读写路径。
- 预计新增后台同步入口、同步状态持久化与相应环境变量约定。
- 需要补充针对同步流程、库内读取路径、数据新鲜度和 API 输出的测试。
