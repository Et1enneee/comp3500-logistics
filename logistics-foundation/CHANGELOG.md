# 变更记录

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
