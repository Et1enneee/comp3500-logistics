# 当前测试与证据计划

## 自动验证
在logistics-foundation目录执行（或使用仓库根目录同名npm命令），Node24，先npm ci、db:setup；seed只用于全新/可丢弃演示库。

```bash
npm run typecheck
npm test
npm run test:integration
npm run lint
npm run build
```
现有基线预期：unit9、integration39（含3顶层）；新执行结果必须如实记录。

## 浏览器系统验收（会修改演示库）
1. 确认当前prisma/dev.db为新建/可丢弃；显式RESET_DEMO_DATA=YES执行seed。
2. `npx playwright install chromium`（Linux CI用--with-deps）。
3. `mkdir -p docs/evidence`，构建后以本机回环地址启动：`npm run start -- --hostname 127.0.0.1 --port 3100`。
4. 另一终端：`FOUNDATION_BROWSER_TEST=YES FOUNDATION_BASE_URL=http://127.0.0.1:3100 npm run test:browser`。
5. 若使用系统Chromium，附CHROMIUM_PATH。预期16项，保留实际输出，不删断言。

集成测试使用临时SQLite，与项目演示库分开。browser是UI/API/DB系统验证，不冒称已有独立组件测试套件。性能/可用性/真人走查尚无当前正式报告。

## CI
仓库根.github/workflows/ci.yml在logistics-foundation工作目录执行文件校验、安装、初始化一次性库、类型、单元、集成、lint、构建与浏览器。Actions实际结果以对应commit为准；失败保留日志，不能凭本地结果标CI通过。
历史分支独有用例与缺陷记录保留在reference/legacy/Jaden-*，原有署名/结果只代表旧环境。


---

## v0.4.0 现状（替代上文计数）

```bash
npm run typecheck          # tsc --noEmit
npm test                   # 单元 31 项（状态机、GMT+8、scrypt、Cookie/CSRF、限流）
npm run test:integration   # 真实 SQLite 102 项，8 个文件各自独立临时库
npm run verify:migration   # 旧库保留数据 + demo 哈希失效 + 重设工具
npm run lint
npm run build
```

浏览器验收（真实登录、四角色、21 项检查）：

1. `RESET_DEMO_DATA=YES npm run db:seed:demo`（仅可丢弃库）
2. `npm run build && npm run start -- --hostname 127.0.0.1 --port 3100`
3. `FOUNDATION_BROWSER_TEST=YES FOUNDATION_BASE_URL=http://127.0.0.1:3100 EVIDENCE_DIR=../evidence/screenshots npm run test:browser`

覆盖：客户 A 登录→下单→详情空运单→客户 B 直接 URL/ORD/API 均不可读→员工队列筛选/ORD 查询→确认（库存与流水断言）→拣货→发货（唯一 LG）→注入追踪读失败不误报→签收（3 条有序事件、客户侧时间线）→通知未读数与标记已读→ADMIN 聚合与 DB 对账 + CSV→角色越权 403/401/CSRF→SKU007 确认后取消回补一次→补货 4→5 预警消失→流水操作人→缺货可读错误→390px 四页无整页横向溢出→暗色→退出会话失效；写请求网络中断显示“结果未知”，恢复后刷新显示真实状态。

重启保留由 `npm run evidence` 单独验证：创建订单→停止/启动服务→同一 Cookie 会话、订单与库存均保留（`evidence/restart-check.json`）。

一键生成全部证据（日志、截图、性能、审计、结果）：

```bash
EVIDENCE_ROOT=../evidence npm run evidence
```
