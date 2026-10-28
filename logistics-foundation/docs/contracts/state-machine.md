# 订单状态：设计范围 vs 当前实现

七状态/七转移的设计模型以 lib/constants.ts 与 Prisma enum 为准，原有 9 条状态机单测保留。状态模型允许某个转换，不等于 HTTP 接口已经实现。

| 转换 | 设计规则 | 当前实现 |
| --- | --- | --- |
| CREATED → CONFIRMED | STAFF；库存充足；预占及流水原子完成 | v0.2 已实现并测试 |
| CREATED → CANCELLED | 客户取消；不回库存 | 未实现（本轮不做） |
| CONFIRMED → CANCELLED | 员工/客户按原规则取消；释放已预占 | 未实现；未来 reason 定名 ORDER_CANCEL_RELEASE |
| CONFIRMED → PICKING | 员工开始拣货 | v0.3 已实现并测试（PATCH /status） |
| PICKING → SHIPPED | 员工发货、生成唯一运单；不重复扣预占库存 | v0.3 已实现并测试（POST /shipments） |
| SHIPPED → IN_TRANSIT | 模拟承运商更新 | v0.3 已实现并测试（PATCH /status） |
| IN_TRANSIT → DELIVERED | 模拟送达/签收 | v0.3 已实现并测试（PATCH /status） |

v0.3 的 PATCH 接受 to=CONFIRMED/PICKING/IN_TRANSIT/DELIVERED；to=SHIPPED 与未实现目标返回 400 INVALID_ARGUMENT，不能把它与“已实现通用状态接口后的非法跳转 409”混为一谈。目标状态与原状态不符时返回 409 INVALID_STATE_TRANSITION，业务数据不变。

Customer 取消和 Staff 确认是两个不同用例；未来用例图应分别表达权限。真实认证、所有权校验及新增端点仍需设计与验收。RETURNED 不在本包范围。

当前用例说明和已实现/待实现分区见 ../closure/use-cases.md 与 ../closure/usecase.puml；取消仍不属于已实现接口。
