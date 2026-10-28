# 精简交接说明 · repository-closure-1

## 单一入口
仓库根README/package.json负责统一命令；唯一应用与依赖在logistics-foundation/。不再复制整套运行代码到根目录，也不把repo-init当作待合并的运行宿主。
repo-init原资产保留Git历史与目录，但从精简导出排除。旧Jaden分支独有测试和缺陷记录原文保留docs/reference/legacy；旧模板不覆盖新版契约，不删除分支。

## 现行规则
ORD用于查询，order.id用于PATCH和tracking；Product.stock表示可用库存；创建不占用，确认原子扣占并写ORDER_CONFIRM，发货不二次扣减。后续揽收/签收是STAFF模拟；真实认证未实现。
详见contracts、traceability及closure。不对已完成主链重复报价；新增任务需组长批准。

## 改动与证据
本次仅根入口、CI、当前/历史文档对齐及摘要更新；app/lib/tests/scripts/schema/依赖锁文件与PR#2相同。原候选9单元/39集成/16浏览器结果保留来源，当前CI结果以本PR实际check为准，配置存在不等于通过。
根CI执行全部核心检查与浏览器，在一次性runner库中seed；不碰旧库。CI下载的source archive对应实际commit，SHA文件与artifact一并提供。
当前源码SHA清单排除历史evidence-history，符合精简导出。截图/历史响应只代表当时数据，不硬编码到新库。

## 接收者
Node24；根npm run setup安装唯一应用依赖；db:setup后仅可丢弃库显式seed；dev:local启动。精简导出解压后在应用目录校验SHA并运行。GitHub源码上传不是最终课程报告/视频/评分要求完成。
旧台账引述12月8日、15～25分钟视频、≤1000词报告，仅作为待核实提醒，不替代课程官方原件。
