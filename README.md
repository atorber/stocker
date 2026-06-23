# Stocker

A股趋势交易 Web 应用 — 选赛道 · 做减法 · 看长做短。

## 技术栈

- **后端**：Python FastAPI + PyMySQL，读取 `xtrader` 数据库
- **前端**：React + TypeScript + Vite，UI 复用 `design/index.html` 设计稿

## 快速启动

### 1. 配置数据库

在项目根目录 `.env` 中配置 MySQL 连接（已有时可跳过）：

```
MYSQL_HOST=your-host
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=your-password
MYSQL_DB=xtrader
MYSQL_CHARSET=utf8mb4
```

### 2. 启动后端

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 3. 启动前端

```bash
cd frontend
npm install
npm run dev
```

浏览器访问 http://localhost:5173

## API 接口

| 路径 | 说明 |
|------|------|
| `GET /api/meta` | 顶栏日期、各池数量 |
| `GET /api/pools/{daily\|basic\|selected\|trading}` | 基础/精选/交易股票池列表 |
| `GET /api/daily-stock-pool/stocks/by-date/{date}/grid` | 每日更新池（按研报日期） |
| `GET /api/daily-stock-pool/dates` | 有研报的可用日期列表 |
| `GET /api/daily-stock-pool/stocks/by-date/{date}` | 与 xtrader 兼容的研报统计接口 |
| `GET /api/themes/{finance\|consumer\|cycle\|tech}` | 主题方向 |
| `GET /api/industry/chains` | 产业链列表 |
| `GET /api/industry/chains/{id}` | 产业链详情与拓扑 |
| `GET /api/radar?sort=t_3_chg` | 动能排行 Top N |

## 数据适配说明

- **每日更新池**：按研报 `publish_date` 从 `research_reports.extracted_stocks` 聚合，与 xtrader `/api/daily-stock-pool` 逻辑一致
- **入池价**：优先 `close_t5`，否则 `pre_close`，再否则按现价 × 0.92 估算
- **成本价**：来自 `trade_record` 最近买入记录，无则用入池价
- **大方向/细分**：来自 `stock_sector_relations`，未关联时默认「科技 / —」
- **产业链拓扑**：节点无坐标时自动布局，连线按层级生成

设计稿静态原型见 `design/index.html`。
