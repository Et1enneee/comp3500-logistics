# 订单查询与确认功能验证记录

## 1. 验证环境
- 本地开发环境：Windows、Next.js 16.4.3、Prisma 6.19.3、SQLite。
- 功能范围：按订单号查询单笔订单；将CREATED订单确认成CONFIRMED。
- 身份方式：X-Demo-User-Email传演示邮箱，后端查询User表判断角色。
- 演示邮箱不是正式认证机制，不代表真实认证安全验收通过。

## 2. 类型检查与数据库集成测试
执行：
npx tsc --noEmit

结果：执行结束，无类型错误输出。

执行：
npx tsx --test tests/orders.integration.ts

结果：真实Prisma／临时SQLite集成测试通过。
17组业务场景，加上顶层测试，统计为pass 18、fail 0。
覆盖参数校验、身份与角色检查、库存不足整单回滚、
流水写入失败回滚、重复商品汇总、重复确认和并发库存保护。
测试使用独立临时数据库，不操作现有dev.db。

测试中的“Order API unexpected failure Error”为故意注入
流水写入失败产生的日志，对应回滚测试通过，不是测试失败。

## 3. 真实HTTP验证（2026-10-26）
测试订单：ORD-20261026-0001
内部ID：cmvp56lid0001kb7c4ifcap1a
商品：SKU001 × 2
单价：150分
总额：300分

### 查询订单
GET /api/v1/orders?orderNumber=ORD-20261026-0001

确认前返回CREATED，包含内部ID及商品SKU、名称、数量和单价。
未返回客户passwordHash。

### 首次确认
PATCH /api/v1/orders/cmvp56lid0001kb7c4ifcap1a/status
演示操作人：staff@demo.com
请求体：{"to":"CONFIRMED"}

实际结果：
- HTTP 200。
- 订单状态为CONFIRMED。
- SKU001可用库存由100降为98。
- 产生1条关联该订单的库存流水：
  reason = ORDER_CONFIRM
  delta = -2

### 重复确认
再次发送相同确认请求。

实际结果：
- HTTP 409。
- error.code = INVALID_STATE_TRANSITION。
- 刷新数据库后，SKU001库存仍为98。
- 当前订单流水仍为1条，没有重复写入。

### 确认后再次查询
相同订单返回CONFIRMED，商品明细与金额保持正确。
真实响应保存于docs/contracts/get-order.example.json。

## 4. 已解决的兼容问题
原补丁中的以下路由配置与项目已开启的cacheComponents冲突：
- export const dynamic = "force-dynamic";
- export const runtime = "nodejs";

已从查询／创建路由和确认路由中移除这两项显式配置。
修改后，查询及确认接口已完成实际HTTP调用验证。

Next.js和eslint-config-next已更新至16.4.3，
升级后的类型检查和数据库集成测试通过。

## 5. 验证边界与待跟进事项
- 人工HTTP验证使用一笔单商品演示订单。
- 多商品回滚、重复商品及并发保护由隔离集成测试覆盖，
  不声称已完成多人前端并发联调。
- 尚需唐朝在其页面中接入查询与确认，并完成前后端联调。
- npm在升级后仍报告3项高危漏洞，尚需进一步评估。
- 未实现发货、取消、通知、订单列表或真实登录。
- 本记录依据本地运行输出及数据库查看结果整理，
  不代表生产环境或完整安全验收通过。