# v0.3.1 文档收口入口

## 定位与权威边界
本目录是冻结代码的实现说明与交接补充，不是全项目已完成声明，也不是完整课程 SRS 的替代品。软件版本保持 0.3.1，本次仅修订文档及校验元数据。

- 唯一代码底座：组长冻结的 foundation-v0.3.1-candidate.zip，原始 ZIP SHA-256：`7ab1d4eee9d3195dafcdf0144ca97de450c8f8a7258965c34b591287691f8455`。
- 本次收口包在该底座上只改文档及摘要；没有移植 repo-init，没有改业务源码、测试、依赖或 schema。
- 运行事实按代码与对应版本证据说明；完整需求编号仍沿用团队原 docs/traceability.md 的 FR-01～FR-07、NFR-01～NFR-05，不新增编号。
- 本源码包未提供完整 requirement register、glossary、acceptance、test-plan 或原 SRS 正文；这些团队资产不能假称已经逐项核对。现有 FR-01/FR-02 的映射可确认，其余编号待取得原 register 后对齐，本文按能力名称列出，不擅自分配。
- 原设计的客户取消分支保留为未实现需求，不因为本轮未做而从设计中消失；也不把枚举支持等同于接口支持。
- 原 BASELINE.json 是 v0.2 历史来源；当前来源摘要看 BASELINE-v0.3.1.json。历史修订表中的摘要仅针对当时文件，当前完整性以根目录 SHA256SUMS.txt 为准。

## 阅读顺序
1. `scope-and-srs-addendum.md`：范围、角色、核心语义及设计缺口。
2. `verification-matrix.md`：能力—实现—测试对应关系与验收边界。
3. `use-cases.md`：下单、履约、追踪的正常及异常流程。
4. `usecase.puml`：以已实现功能为主的用例图源文件，待实现取消单独分区。
5. `handoff-checklist.md`：接手、仓库核对、测试和提交要求。
6. `review-record.md`：证据归属与本次文档修订记录。

实际 API 细节以 `../contracts/api.md` 为入口；状态以 `../contracts/state-machine.md` 为入口；数据以 `../contracts/data-model.md` 为入口。若后续调整规则，应同时更新相关契约、测试及本目录，不仅修改图或口头说明。
