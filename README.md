# Aether Watch

*Tracking black swan signals in the sky.*

Aether Watch 是一个面向公众信号的异常监测原型，用于把小时级航空活动转化为可解释的异常等级、预测复盘与风险叙述。

## 技术栈

- 前端：Nuxt 4 + Vue 3
- 后端：Nuxt Server Routes + Nitro Node Server
- 测试：Vitest + Vue Test Utils

## 本地开发

```bash
npm install
npm run dev
```

启动后访问 `http://localhost:3000`。

## 常用命令

```bash
npm run dev
npm run build
npm run preview
npm run test
```

## 真实数据与 PostgreSQL 配置

默认模式仍为 mock；未配置环境变量时，系统继续使用内置 fixture。

可选环境变量：

- `ANOMALY_INGESTION_MODE`：`mock`、`real`、`real-with-fallback`
- `ANOMALY_PG_URL` 或 `DATABASE_URL`：PostgreSQL 连接串
- `ANOMALY_REAL_SOURCE_URL`：真实数据 provider 地址
- `ANOMALY_REAL_SOURCE_TOKEN`：真实数据 provider Bearer Token
- `ANOMALY_REAL_SOURCE_TIMEOUT_MS`：请求超时，默认 `5000`
- `ANOMALY_REAL_SOURCE_FRESHNESS_MINUTES`：数据新鲜度阈值，默认 `90`
- `ANOMALY_ALLOW_MOCK_FALLBACK`：是否允许在真实源失败时回退到 mock

示例：

```bash
export ANOMALY_INGESTION_MODE=real-with-fallback
export ANOMALY_PG_URL=postgres://postgres:postgres@localhost:5432/aether_watch
export ANOMALY_REAL_SOURCE_URL=https://example.com/aircraft/hourly
export ANOMALY_REAL_SOURCE_TOKEN=replace-me
```

如需快速回滚到纯 mock 模式，只需将 `ANOMALY_INGESTION_MODE` 设回 `mock`，无需清理 PostgreSQL 中已写入的数据。

## 当前 MVP 能力

- 以 mock 小时级航空快照作为数据源，通过摄取接口加载场景数据。
- 基于历史窗口构建基线范围，并生成下一小时预测。
- 对预测与实际快照进行复盘，提取主要异常驱动因素。
- 使用确定性权重和阈值生成 1 到 5 级异常等级。
- 输出可直接供 dashboard 使用的状态载荷与解释文本。
- 提供三个回测样例：常态日、节假日尖峰、极端同步异常。

## 主要目录

- `app/pages/index.vue`：dashboard 页面入口
- `app/components/AnomalyDashboard.vue`：异常看板展示组件
- `app/assets/css/main.css`：全局样式
- `server/lib/anomaly/`：摄取、基线、预测、复盘、评分、解释和 LLM 适配边界
- `server/api/health.get.ts`：健康检查接口
- `server/api/signals/summary.get.ts`：异常状态接口
- `openspec/changes/global-aircraft-anomaly-detection/`：当前 OpenSpec 变更文档

## 接口说明

- `/api/health`：返回服务状态与检查时间
- `/api/signals/summary?scenario=normal-day`：返回指定场景的 dashboard 状态数据

可选 `scenario`：

- `normal-day`
- `holiday-spike`
- `extreme-anomaly`

## 当前限制与后续扩展

- 当前数据源仍为 mock 数据，真实 ADS-B 类数据接入尚未实现。
- 当前系统衡量的是异常信号与偏差，不直接宣称具体事件或因果关系。
- 第一版不包含金融、航运、新闻和社交媒体等多源信号。
- LLM 当前仅保留适配边界，尚未接入真实模型能力。
