# Group 42 · Logistics Management System v0.4.2

唯一应用位于 `logistics-foundation/`，根目录转发全部运行、测试和证据命令。沿用 v0.3.1 底座、Next.js / React / TypeScript / Prisma 6 / SQLite 与既有锁文件。

## 启动（Node 24，本轮验证 24.22.2）

```bash
npm run setup
npm run db:setup
# 仅全新或可丢弃演示库；此命令会删除该库原数据：
RESET_DEMO_DATA=YES npm run db:seed:demo
npm run dev:local
```

打开 http://127.0.0.1:3000 。旧库仅运行迁移；需升级旧演示密码时使用 `RESET_PASSWORDS=YES npm run db:reset-passwords`，保留订单/库存。Windows 环境变量写法见应用 README。

## 当前能力

真实登录/退出、持久会话与客户对象隔离；客户商品目录/下单/我的订单/物流追踪/取消；员工确认、拣货、发货及模拟揽收/签收；确认后取消一次释放库存；库存预警/补货/流水；站内通知；ADMIN 只读报表与 CSV。默认演示账号与密码配置见应用 README。本地模拟物流，无真实支付或承运商接入。

## 检查与隔离证据

```bash
npm run typecheck
npm test
npm run test:integration
npm run test:delivery
npm run verify:migration
npm run lint
npm run build
# 源码修改后先重建清单，再生成本轮证据：
npm run baseline
# 显式确认后，仅在独立临时源码副本中安装、迁移和重建可丢弃数据库：
RESET_DEMO_DATA=YES npm run evidence
```

`evidence` 不使用原项目数据库。输出默认在应用上一级 `evidence/`，可用 `EVIDENCE_ROOT` 指定。低层 `test:browser` 会修改它所连接的演示库；推荐使用完整隔离证据入口。服务启动、就绪检查、性能与浏览器检查、重启验证、服务清理由证据流程管理。

当前 CI 在 `.github/workflows/ci.yml`；性能与浏览器检查共享同一个服务生命周期。远端运行仍需上传后查看实际 Actions，交付包仅声明本地实测。

## 阅读入口

- `logistics-foundation/README.md`：账号、业务规则和运行步骤。
- `logistics-foundation/docs/known-issues.md`：依赖审计、SQLite、可用性与测试边界。
- `logistics-foundation/docs/contracts/`、`docs/traceability.md`：接口与需求追踪。
- `logistics-foundation/docs/reference/legacy/`：历史材料，不代表当前能力。

交付源码排除依赖、构建缓存、数据库、真实环境变量和旧证据；交付包中的 `evidence/results.json`、`delivery.json` 与 `SHA256SUMS.txt` 用于核对本轮源码和证据。课程报告、演示材料与正式提交记录仍由团队另行管理。
