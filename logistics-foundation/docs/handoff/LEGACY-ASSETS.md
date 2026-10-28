# 历史资产核对与处理

来源：main@6da99ec8；旧分支Jaden-Gittt-patch-1@516d141f。没有整条合并或删除旧分支。

| 资产 | 处理 |
|---|---|
| 原logistics-foundation/108文件 | 作为唯一当前运行项目保留；根目录提供统一入口，原候选来源及本次文档修订分开记录 |
| repo-init旧运行代码 | 保留历史，不纳入当前运行/精简导出；不移植旧schema/路由/无鉴权逻辑 |
| 原traceability FR01～07/NFR01～05 | 原文参考保留，新根docs/traceability.md按实际能力重建状态 |
| main更新的acceptance/usability/risks | 不用旧分支模板覆盖；有效场景转换为当前acceptance，历史走查和风险原文保留 |
| Jaden独有defects/test-plan | 原文保留docs/reference/legacy/Jaden-*，不丢原署名与记录，不将10/17旧失败当作当前结果 |
| Jaden acceptance | 是较早占位稿；不覆盖main较完整材料，不按“发货再扣stock”解释 |
| 旧/当前截图 | 当前项目截图保留；过时evidence-history从精简导出排除，CI重新生成本轮截图artifact |
| 旧process/templates | 原文仍在repo-init/docs历史目录；不是当前功能实现声明 |
| 新手运行指南/旧用例模板 | 保留原出处；当前运行按根README，不调用旧端点 |

旧缺陷解释：创建错误码SKU后缀仍属当前约定，不据旧预期直接定为现版本缺陷；旧确认/物流404记录保留，当前主链已有覆盖；/alerts仍未实现。模板DEF-001不计为本轮已验证缺陷。

旧风险台账提到2026-12-08、视频15～25分钟、报告≤1000词，系成员文档对课程页的引述，未独立核对官方原件；保留为待核实提醒，不写成已确认DDL。seed实际3用户/10商品/0预置订单，不沿用50单声明。
