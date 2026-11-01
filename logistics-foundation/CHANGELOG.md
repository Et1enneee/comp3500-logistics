## v0.4.2 · 收尾修复

- 页面/API 共用参数校验，非法状态、重复参数及小数/超界页码可恢复；查询失败不执行列表查询。
- 畸形会话 Cookie 解码失败视为失效会话，API 401、页面返回登录，不再 500。
- 恢复创建订单 `SKU_NOT_FOUND_<sku>` / `INSUFFICIENT_STOCK_<sku>`，补精确错误码和无写入断言。
- 更新完整及 omit=dev 原始审计 JSON、实际计数与风险范围；不做破坏性升级。
- 状态转移、库存事务与含义、角色边界、schema/migrations、技术栈均保持原有规则。

## v0.4.1 · 验收反馈修复

- 证据命令要求调用者显式确认，只在独立临时源码副本和新库执行安装/迁移/seed/测试；原项目库不参与。
- CI 性能与浏览器检查共用同一服务生命周期。
- 日期趋势生成完整区间；新增 668 天末日与总量对账回归；非法日期表单保留输入并显示错误。
- 登录按规范化邮箱限流，轮换代理来源头不能绕过；保留进程内限制说明。
- 演示数据完整历史链前移，事件、通知和库存日志均不晚于生成时刻。
- 退出检查响应，503/网络失败可见、可重试，成功后才跳转；会话删除存储故障不再吞掉。
- 员工确认订单增加二次确认，返回不写库存；浏览器验证确认后才扣减。
- 统一源码复制/排除/摘要规则，打包强制核对证据摘要；测试数量来自实际日志。
- 同步根命令、README 与版本；依赖审计和远端 CI 状态如实披露。

# 变更记录

## v0.4.0（第三方交付版本）

在 v0.3.1 封版底座上补齐 P0 + P1，不更换框架/数据库，不升级 Prisma 大版本。

### 新增：真实登录与授权（P0-A）
- `Session` 表保存 token 的 SHA-256 与 CSRF 令牌；原始 token 只进入 HttpOnly Cookie（SameSite=Lax，HTTPS 时 Secure，8 小时过期）。
- 密码改为 Node 内置 scrypt（每用户随机盐），seed 不再写 `passwordHash:"demo"`；`X-Demo-User-Email` 彻底失效。
- 写请求要求 `X-CSRF-Token` 且校验 Origin/Host；登录失败按“邮箱+来源”限流（5 次/10 分钟）。
- 统一边界：未登录 401、角色越权 403、跨客户对象 404（隐匿）。

### 新增：订单中心、履约工作台、取消（P0-B/C/D）
- 客户：`/orders` 列表（分页/状态筛选/按 ORD 查询）、`/orders/{id}` 详情与自助追踪、取消 CREATED/CONFIRMED。
- 员工：`/staff` 队列（筛选/分页/ORD 查询）、`/staff/orders/{id}` 确认/拣货/发货/揽收/签收/取消。
- `PATCH /api/v1/orders/{id}/status` 新增 `to:"CANCELLED"`：CREATED 不动库存；CONFIRMED 同一事务回补并写 `ORDER_CANCEL_RELEASE`，只释放一次；拣货后 409。
- 新增 `GET /api/v1/orders` 分页列表与 `GET /api/v1/orders/{id}` 详情；原 `?orderNumber=` 保留。

### 新增：库存工作台与预警（P0-E）
- `GET /api/v1/inventory`、`/low-stock`、`/logs`；`POST /api/v1/inventory/{productId}/replenish` 仅增量并写 `STOCK_REPLENISH` + 操作人。
- 预警严格 `stock < threshold`；库存/流水页支持筛选与分页，无删除入口。

### 新增：站内通知（P1-A）
- 确认/取消/发货/揽收/签收在业务事务内写通知；`(orderId,type)` 唯一，重复/并发不重发。
- 客户通知中心：未读数、列表分页、本人标记已读；他人通知 404。

### 新增：ADMIN 只读报表与 CSV（P1-B）
- `GET /api/v1/reports/overview`：订单数、状态分布、已签收金额、非取消金额、当前低库存 SKU；GMT+8 自然日边界；默认近 7 天。
- `GET /api/v1/reports/export.csv`：与筛选一致，列名/时区/金额单位明确，防公式注入，不含个人信息。

### 数据库与迁移（P0-F）
- 迁移 `20261030120000_auth_inventory_notifications`：新增 Session、InventoryLog.actorId、Notification.orderId + 唯一键、列表查询索引；手写 SQL 保留既有数据（不 reset）。
- seed 重建 56 张订单（含两种取消路径/各状态/低库存/通知），演示账号使用真实密码哈希，默认密码 `Demo1234!`（可用 `DEMO_PASSWORD` 覆盖）。

### 测试与工程
- 单元测试 31；集成测试 102（真实 SQLite，每文件独立临时库）；浏览器验收 21 项（客户 A 全链、客户 B 隔离、员工履约、取消、补货预警、报表、越权、网络未知后恢复、移动端、暗色）；另有重启保留检查（订单/会话/库存）。
- 新增 `scripts/run-verification.mjs`（证据与性能）与迁移保留数据校验脚本；CI 更新为完整执行并上传 artifacts。

### 界面
- 新增登录页、订单中心、员工详情操作面板、库存工作台、通知中心、管理看板；统一状态徽章（文字+颜色）；1440/390 无横向溢出；补货表单紧凑化。

## 地基候选 v0.3.1（封版修订）

仅封版修订，不新增功能、不改 schema、不升级依赖、不合并远端。

- 页面横幅、README、交接范围同步为“下单/查询/确认/拣货/发货/追踪”，保留“本地模拟、非真实认证”。
- 追踪读取失败反馈：仅明确的“无运单”（SHIPMENT_NOT_FOUND）视为空；500/网络错误提示；已成功的状态操作不误报失败、不诱导重复提交。
- 本轮 typecheck/unit/integration/lint/build/browser 日志收入 `docs/verification-logs/v0.3.1/`；历史证据归档到 `docs/evidence-history/`。
- 版本号 0.3.1；新增 `BASELINE-v0.3.1.json` 与完整 `SHA256SUMS.txt`；v0.2 来源记录保留。

## 地基候选 v0.3

在已验证 v0.2 唯一底座上做物流主链最小增量（不移植通知/补货/取消/真实登录）。

- 状态路由扩展：保留原 CONFIRMED 事务，新增 CONFIRMED→PICKING、SHIPPED→IN_TRANSIT、IN_TRANSIT→DELIVERED；仍仅 STAFF、必须 X-Demo-User-Email。
- 新增 POST /api/v1/shipments：事务内条件转换 PICKING→SHIPPED、生成当日唯一 LG- 运单、写初始追踪事件；顺序/并发重复只产生一张运单。
- 新增 GET /api/v1/orders/{id}/tracking：按内部 id，事件正序；未发货 404；错误 id 不泄露其他订单。
- 发货不扣库存、不写 InventoryLog；确认流水仍为 ORDER_CONFIRM（未来取消预定义 ORDER_CANCEL_RELEASE）。
- /staff 增加最少必要按钮与运单追踪显示；未整页替换。
- 新增 tests/logistics-chain.integration.ts 并纳入 npm run test:integration；浏览器脚本追加 3 项主链断言。
- schema 未改；seed 闸口保留；未升级 Prisma。

## 地基候选 v0.2

复用尹培旭第一周修正项目与 10/26 后端增量；AI 辅助补客户/员工页面、真实接口联调、创建校验、临时库测试和交接说明。

- 新增 /staff 查询/确认工作台和反馈、防重复点击、网络结果未知保护。
- 客户页使用数据库目录，取代硬编码价格与库存；金额快照由服务器计算。
- 新增创建参数校验、重复 SKU 汇总和 CUSTOMER 演示角色限制，保留库存预检。
- 沿用确认时的状态/库存/流水事务与重复确认 409；未扩写其业务逻辑。
- 配置回归 Next 16.4.3 常规模式，去掉远程字体/实验缓存/CSS loader。
- seed 清库需显式确认；不含数据库，不要求重置已有数据。
- 明确可用库存语义及尚未实现范围。此语义收敛等待组长/杨庭彰复核；不声称已同步全部历史契约。
