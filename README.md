# Group 42 · Logistics Management System

**本仓库只有一个当前项目：`logistics-foundation/`，软件版本 v0.3.1。** 根目录是统一启动、检查和交接入口；不需要合并repo-init才能运行。

## 最快启动（Node 24）

```bash
npm run setup
npm run db:setup
# 仅在全新/可丢弃演示库运行，会清空该演示库：
RESET_DEMO_DATA=YES npm run db:seed:demo
npm run dev:local
```
打开 http://127.0.0.1:3000 。Windows环境变量写法见项目README。不要对旧库执行reset或seed。根package.json只转发命令；依赖与锁文件唯一位于logistics-foundation，不新增第二套依赖。

## 能演示什么
客户创建订单→按ORD查询→STAFF确认占用可用库存→拣货→发货生成LG→模拟揽收/签收→员工页正序追踪。创建和发货不重复扣库存。
取消、独立预警/补货、通知、报表、真实登录/订单所有权和客户自助追踪门户尚未实现。仅本机演示，邮箱可冒用，不可直接公网部署。

## 检查
```bash
npm run typecheck
npm test
npm run test:integration
npm run lint
npm run build
```
浏览器验收会修改演示库，先读 logistics-foundation/docs/test-plan.md。根GitHub Actions已配置，实际结果看对应PR Checks，不把本地或历史日志冒称CI通过。

## 阅读入口
- logistics-foundation/docs/traceability.md：完整FR/NFR原编号及当前完成/缺口。
- logistics-foundation/docs/contracts/：现行接口、状态、库存、术语。
- logistics-foundation/docs/closure/：范围、场景、证据归属。
- logistics-foundation/docs/handoff/REPOSITORY-CLOSURE.md：交接说明。
- logistics-foundation/docs/handoff/LEGACY-ASSETS.md：旧分支和历史材料处理。

repo-init/只作历史参考，不是当前运行入口；Jaden分支独有测试记录已保留，不整条合并旧稿、不抹去原贡献。源码不含数据库、依赖目录、真实env或密钥。

## 精简交接
.git属性从git archive导出排除repo-init及旧evidence-history；原仓库历史不删除。
```bash
git archive --format=zip -o Group42-logistics-source.zip <已验收commit-sha>
```
导出后解压，在logistics-foundation目录执行 `sha256sum -c SHA256SUMS.txt`，再按README运行。不要仅凭GitHub自动下载结果假定导出属性生效。CI同时生成精简源码artifact和校验文件。
上传GitHub不等于完成课程提交；官方DDL、评分表、报告/视频仍需核实。
