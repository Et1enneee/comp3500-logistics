# Group 42 · 物流管理地基候选 v0.3.1

这是在尹培旭已交付后端上完成页面与集成的**本地教学演示基线**（本地模拟、非真实认证），不是完整物流系统，也不是已获全组签收的最终版本。尚未上传或合并到团队 GitHub；应先审差异，不得覆盖仓库中的其他新工作。

**v0.3.1 封版修订**：仅同步范围文案、修正追踪读取失败反馈（不误报操作失败、不诱导重复提交），并把本轮测试/构建/浏览器日志收入包内；未新增功能、未改 schema、未升级依赖。

## 本包能做什么

- `/`：数据库商品目录、整数数量、实时预估合计、真实下单、ORD 单号、可读错误。
- `/staff`：按 ORD 单号查询；自动使用内部 order.id 确认；成功后重新查询；角色错误、重复操作与网络结果未知提示。
- 服务端：创建校验与价格快照；确认时事务更新状态、条件扣可用库存、记录 ORDER_CONFIRM 流水；失败回滚。
- v0.3 增量：STAFF 拣货（CONFIRMED→PICKING）、发货（POST `/api/v1/shipments`，事务内生成唯一 LG- 运单＋初始追踪事件）、追踪查询与模拟揽收/签收（SHIPPED→IN_TRANSIT→DELIVERED）。发货不再扣库存。
- v0.3.1：追踪读取仅把明确的“无运单”视为空；500/网络错误会提示，且不会把已成功的状态操作误报为失败。实际日志见 `docs/verification-logs/v0.3.1/`。
- 未实现：取消接口、独立库存预警页、通知、报表、真实登录与对象级访问控制。schema 或状态枚举出现这些实体不代表功能已经完成。

## 1. 全新目录安装（已用 Node 24 测试；v0.3.1 复跑于 Node 25.4.0）

> Node 25 下 vitest 会给出 EBADENGINE 警告；本轮实测全部检查通过。

本 ZIP 不含 node_modules、构建缓存或数据库；不要在旧库上照抄清库命令。

```bash
npm ci
npm run db:setup
```

**仅全新或可丢弃的演示库**初始化商品和账号。seed 会清空演示数据库，现已加入明确确认闸口：

macOS / Linux：
```bash
RESET_DEMO_DATA=YES npm run db:seed:demo
```

Windows PowerShell：
```powershell
$env:RESET_DEMO_DATA="YES"
npm run db:seed:demo
Remove-Item Env:RESET_DEMO_DATA
```

之后运行：
```bash
npm run dev:local
```

打开 `http://127.0.0.1:3000`。若用生产模式：
```bash
npm run build
npm run start -- --hostname 127.0.0.1
```

请始终在本机回环地址运行。演示邮箱可被冒用，不能对公网部署此身份机制。

## 2. 三分钟演示

1. 客户页默认 SKU001 × 2，合计 ¥3.00，提交取得新 ORD 单号。
2. 点击“带入员工工作台”，再点“查询订单”。状态应为 CREATED。
3. 演示账号选员工，点击“确认订单”。刷新后的状态为 CONFIRMED；确认按钮禁用。
4. 点击“开始拣货”→ PICKING（库存不变）；填写承运商后点“发货”→ SHIPPED，页面出现 LG- 运单号与追踪事件；库存仍不变。
5. 点“模拟揽收”→ IN_TRANSIT，再点“模拟签收”→ DELIVERED；追踪事件依次为 仓库 / 揽收网点 / 收件地址。
6. 返回客户页，可用库存由初始 100 变 98（仅确认预占；创建与发货都不减库存）。
7. 新订单选择客户演示账号进行确认/拣货/发货，应显示 403，数据不变。
8. SKU001 改 0，SKU007 填 10；提交应显示可读库存不足，不能新增订单。

库存流水由数据库/自动测试核查；页面没有伪造“实时流水”界面。演示数据随操作变化，截图中的历史单号不能直接用于全新数据库。

## 3. 检查命令

```bash
npm run typecheck
npm test
npm run test:integration
npm run lint
npm run build
```

集成测试使用临时 SQLite，不连接或清空项目 dev.db。包含原后端确认场景、新增创建端验证及物流主链。v0.3.1 实际结果见 `docs/verification-v0.3.1.md`，本轮日志在 `docs/verification-logs/v0.3.1/`；历史证据归档在 `docs/evidence-history/`，本轮截图在 `docs/evidence/`。

## 4. 交接入口

- `docs/handoff/FOUNDATION.md`：范围、规则、第三方接续边界。
- `docs/contracts/api.md`：实际接口及本候选版变更。
- `docs/contracts/data-model.md`：当前可用库存语义。
- `docs/contracts/state-machine.md`：设计范围与已实现转换的区别。
- `docs/handoff/messages.md`：给尹培旭、杨庭彰的复核任务。
- `docs/verification-original-1026.md`：尹培旭原交付记录（历史，不是本轮结果）。

已知依赖风险：npm audit 报 3 项 high，关联 Prisma 工具链的 deepmerge-ts 递归合并问题；尚未修复，也没有因此认定公网安全。不要运行 `npm audit fix --force` 直接跨主版本升级 Prisma。

本候选版没有改变 Prisma schema；基线已有 migration。现有项目合并本包**不要求删除数据库或重新 seed**。

## 5. 可选浏览器验收（会创建测试订单）

仅在**新建且刚 seed 的可丢弃副本**运行，不要对原有数据库执行此测试。先在一个终端运行生产服务：
```bash
npm run build
npm run start -- --hostname 127.0.0.1 --port 3100
```

另一个终端安装测试浏览器并确认执行（macOS/Linux）：
```bash
npx playwright install chromium
FOUNDATION_BROWSER_TEST=YES npm run test:browser
```

Windows PowerShell：
```powershell
npx playwright install chromium
$env:FOUNDATION_BROWSER_TEST="YES"
npm run test:browser
Remove-Item Env:FOUNDATION_BROWSER_TEST
```

已安装系统 Chromium 时可用 CHROMIUM_PATH 指定路径。默认测试端口 3100，可用 FOUNDATION_BASE_URL 修改，仅允许 localhost/127.0.0.1。该测试预期初始 SKU001=100、SKU007=4，会写入订单并改变 SKU001 库存；不得把反复失败当成需要清空原库的理由。

## 文档收口入口（docs-closure-1）

范围、角色、用例、证据归属与接续清单统一见 `docs/closure/README.md`。此次仅文档修订，软件版本仍为0.3.1，未扩功能。
