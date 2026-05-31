## Why

当前异常监测流程已经具备稳定的数据契约、评分逻辑与 dashboard 展示能力，但默认仍依赖内置 mock 数据，无法反映真实世界中的航空活动变化。现在开始推进真实数据接入，可以尽早暴露数据质量、刷新延迟、字段映射与失败回退等实际问题，避免后续在评分层和 UI 层累积错误假设。

## What Changes

- 增加真实航空数据源适配能力，使系统可以从外部数据提供方拉取并转换为现有的小时级快照结构。
- 增加基于 PostgreSQL 的快照与摄取状态持久化，用于支撑真实数据缓存、历史基线与跨重启恢复。
- 增加摄取源配置与启动时选择逻辑，支持在 mock 与真实数据源之间切换。
- 增加数据新鲜度、摄取失败与回退状态，使 dashboard 和 API 能区分“真实数据正常”“真实数据降级到 mock”“真实数据不可用”等状态。
- 保持现有评分、预测、解释与本地化输出契约不变，仅在必要处补充来源与新鲜度相关字段。

## Capabilities

### New Capabilities
- 无

### Modified Capabilities
- `aircraft-anomaly-monitoring`: 将数据输入从仅支持 mock 扩展为支持真实数据源、源切换、摄取失败回退与数据新鲜度暴露。

## Impact

- 影响 `server/lib/anomaly/ingestion.ts`、`server/lib/anomaly/api.ts` 以及相关类型定义与 dashboard 数据组装逻辑。
- 预计新增真实数据源适配器、PostgreSQL 访问层、运行时配置读取与环境变量约定。
- 需要补充针对真实数据映射、回退行为与 API 输出的测试。
