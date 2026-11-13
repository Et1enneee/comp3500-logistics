# 地基候选 v0.2 · 本轮实际验证

本轮由助手在独立沙箱中实际执行，不是转抄开发者报告。不是团队已签收、不是用户电脑验收、不是 GitHub Actions 已通过。

## 结果

| 检查 | 实际结果 |
| --- | --- |
| npm ci（全新副本） | 通过 |
| Prisma generate / migrate deploy / 全新演示 seed | 通过；仅操作本次新建库 |
| TypeScript | 通过 |
| ESLint | 通过 |
| Vitest 状态机 | 9 tests passed |
| 真实 Prisma/SQLite 集成 | 26 个业务子场景＋2 个顶层 test，统计 pass 28 / fail 0 |
| 生产构建 | 通过；页面 /、/staff，两个订单接口 |
| 浏览器验收 | 12 项检查通过；1440 桌面、390 移动端、明暗主题，无页面脚本异常 |
| npm audit | 3 high 未修复；见 known-issues |

集成测试覆盖原 17 个确认场景＋新增 9 个创建/组合场景。包括并发竞争、重复明细、流水失败回滚；这些是隔离库测试，不等于全系统性能或生产安全通过。

## 浏览器实际链路

- 本轮订单：ORD-20261027-0001，内部 ID：cmvqw432a0001msjy9b2x1xmc。这是本轮临时演示库中的记录，不随 ZIP 分发。
- SKU001 × 2，下单总额 300 分；CREATED，库存仍 100，无流水。
- 客户演示身份确认被拒 403，状态/库存不变。
- STAFF 确认：状态 CONFIRMED，库存 98，ORDER_CONFIRM 流水 1 条 delta=-2。
- 真实 HTTP 重复请求：409 INVALID_STATE_TRANSITION，库存仍 98、流水仍 1。
- 返回客户页显示数据库库存 98。SKU007 × 10：可读库存不足，无新订单。
- 网络结果未知时移除旧确认按钮并要求重新查询，不显示假成功。

## 证据与范围

完整命令输出、浏览器检查列表与 8 张截图见 docs/evidence。截图未替代数据库断言。移动端表格输入框经视觉检查调整，不横向溢出文档。额外以 capture_html helper 渲染客户页快照，未发现覆盖/裁切/横向页面溢出。

全新副本另执行 npm ci → db:setup → 显式初始化演示库 → typecheck → unit → integration → lint → build，全流程成功，日志为 clean-reproduction.log。

未测：真实认证、对象级访问控制、真实用户体验、其他浏览器、负载、全天可用性、取消/物流/报表等未实现功能。尚未在用户电脑执行，未检查当前团队远程仓库差异。
