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
