import assert from "node:assert/strict";
import type { TestContext } from "node:test";
import type { PrismaClient, Prisma } from "@prisma/client";
import { createOrderHandlers } from "../lib/order-api";

// Shared behavioural cases. Integration runner uses REAL Prisma + isolated SQLite.
export async function runScenarios(db: PrismaClient, t: TestContext, peer: PrismaClient = db) {
  const h = createOrderHandlers(db);
  const peerHandlers = createOrderHandlers(peer);
  let serial = 0;
  const staff = await db.user.create({ data: { email: "staff@example.test", name: "Staff", passwordHash: "TEST_ONLY", role: "STAFF" } });
  const customer = await db.user.create({ data: { email: "customer@example.test", name: "Customer", passwordHash: "MUST_NOT_LEAK", role: "CUSTOMER" } });
  const admin = await db.user.create({ data: { email: "admin@example.test", name: "Admin", passwordHash: "TEST_ONLY", role: "ADMIN" } });
  async function product(stock: number) {
    return db.product.create({ data: { sku: `SKU-TEST-${++serial}`, name: "Test product", stock, priceCents: 150 } });
  }
  async function order(lines: { productId: string; quantity: number }[], status = "CREATED") {
    return db.order.create({ data: {
      orderNumber: `ORD-TEST-${++serial}`, customerId: customer.id, status: status as "CREATED",
      totalCents: lines.reduce((n,l) => n+l.quantity*150,0),
      items: { create: lines.map(l => ({ ...l, unitPriceCents: 150 })) },
    } });
  }
  function request(body: unknown = { to: "CONFIRMED" }, email: string | null = staff.email, raw = false, contentType = "application/json") {
    const headers: Record<string,string> = { "Content-Type": contentType };
    if (email !== null) headers["X-Demo-User-Email"] = email;
    return new Request("http://localhost/api/v1/orders/id/status", { method: "PATCH", headers, body: raw ? String(body) : JSON.stringify(body) });
  }
  async function expectError(r: Response, status: number, code: string) {
    assert.equal(r.status,status); const data = await r.json();
    assert.equal(data.error.code, code); assert.equal(typeof data.error.message,"string");
    assert.ok(data.error.message.length > 0); assert.deepEqual(Object.keys(data),["error"]);
  }
  async function snapshot(id: string, productIds: string[]) {
    const o = await db.order.findUniqueOrThrow({ where: { id } });
    const p = await db.product.findMany({ where: { id: { in: productIds } }, orderBy: { id: "asc" } });
    const logs = await db.inventoryLog.findMany({ where: { orderId: id }, orderBy: { productId: "asc" } });
    return { order: o, products: p, logs };
  }
  const baseProduct = await product(20);
  const base = await order([{productId:baseProduct.id,quantity:2}]);
  await t.test("GET: missing/empty/blank orderNumber => 400", async()=>{
    for (const query of ["", "?orderNumber=", "?orderNumber=%20%20"]) {
      await expectError(await h.getOrder(new Request("http://localhost/api/v1/orders"+query)),400,"INVALID_ARGUMENT");
    }
  });
  await t.test("GET: nonexistent order => 404", async()=>{
    await expectError(await h.getOrder(new Request("http://localhost/api/v1/orders?orderNumber=missing")),404,"ORDER_NOT_FOUND");
  });
  await t.test("GET: detail includes SKU/name and no passwordHash", async()=>{
    const r = await h.getOrder(new Request("http://localhost/api/v1/orders?orderNumber="+base.orderNumber));
    assert.equal(r.status,200); const data = await r.json();
    assert.equal(data.order.id,base.id); assert.equal(data.order.status,"CREATED");
    assert.equal(data.order.totalCents,300);
    assert.equal(data.order.items[0].product.sku,baseProduct.sku);
    assert.equal(data.order.items[0].product.name,baseProduct.name);
    assert.equal(data.order.items[0].quantity,2); assert.equal(data.order.items[0].unitPriceCents,150);
    assert.equal(JSON.stringify(data).includes("passwordHash"),false);
    assert.equal(JSON.stringify(data).includes("MUST_NOT_LEAK"),false);
  });
  await t.test("PATCH: invalid/empty/malformed body => 400, no mutation", async()=>{
    const before = await snapshot(base.id,[baseProduct.id]);
    for (const body of [null,[],{}, {to:"SHIPPED"}, {to:"confirmed"}, {to:2}]) {
      await expectError(await h.confirmOrder(request(body),base.id),400,"INVALID_ARGUMENT");
    }
    for(const raw of ["", "{not-json"]) await expectError(await h.confirmOrder(request(raw,staff.email,true),base.id),400,"INVALID_ARGUMENT");
    await expectError(await h.confirmOrder(request({to:"CONFIRMED"},staff.email,false,"text/plain"),base.id),400,"INVALID_ARGUMENT");
    assert.deepEqual(await snapshot(base.id,[baseProduct.id]),before);
  });
  await t.test("PATCH: missing/unknown identity => 401; role spoof ignored", async()=>{
    const before = await snapshot(base.id,[baseProduct.id]);
    await expectError(await h.confirmOrder(request(undefined,null),base.id),401,"UNAUTHENTICATED");
    await expectError(await h.confirmOrder(request(undefined,"unknown@example.test"),base.id),401,"UNAUTHENTICATED");
    await expectError(await h.confirmOrder(request({to:"CONFIRMED",role:"STAFF"},customer.email),base.id),403,"FORBIDDEN");
    await expectError(await h.confirmOrder(request(undefined,admin.email),base.id),403,"FORBIDDEN");
    assert.deepEqual(await snapshot(base.id,[baseProduct.id]),before);
  });
  await t.test("PATCH: unknown internal ID and ORD-number-as-ID => 404",async()=>{
    await expectError(await h.confirmOrder(request(),"missing-internal-id"),404,"ORDER_NOT_FOUND");
    await expectError(await h.confirmOrder(request(),base.orderNumber),404,"ORDER_NOT_FOUND");
  });
  await t.test("PATCH: successful confirmation + repeated call has no effects",async()=>{
    const r = await h.confirmOrder(request(),base.id); assert.equal(r.status,200);
    const data=await r.json(); assert.deepEqual(data,{order:{id:base.id,orderNumber:base.orderNumber,status:"CONFIRMED",totalCents:300}});
    const after=await snapshot(base.id,[baseProduct.id]);
    assert.equal(after.order.status,"CONFIRMED"); assert.equal(after.products[0].stock,18);
    assert.equal(after.logs.length,1); assert.equal(after.logs[0].delta,-2);
    assert.equal(after.logs[0].reason,"ORDER_CONFIRM"); assert.equal(after.logs[0].orderId,base.id);
    assert.equal(after.logs[0].productId,baseProduct.id);
    await expectError(await h.confirmOrder(request(),base.id),409,"INVALID_STATE_TRANSITION");
    assert.deepEqual(await snapshot(base.id,[baseProduct.id]),after);
    const refreshed=await h.getOrder(new Request("http://localhost/api/v1/orders?orderNumber="+base.orderNumber));
    assert.equal((await refreshed.json()).order.status,"CONFIRMED");
  });
  await t.test("PATCH: every other non-CREATED status is rejected",async()=>{
    for(const state of ["PICKING","SHIPPED","IN_TRANSIT","DELIVERED","CANCELLED"]) {
      const o=await order([{productId:baseProduct.id,quantity:1}],state);
      const before=await snapshot(o.id,[baseProduct.id]);
      await expectError(await h.confirmOrder(request(),o.id),409,"INVALID_STATE_TRANSITION");
      assert.deepEqual(await snapshot(o.id,[baseProduct.id]),before);
    }
  });
  await t.test("PATCH: multi-product success writes one log per product",async()=>{
    const a=await product(6), b=await product(9);
    const o=await order([{productId:a.id,quantity:2},{productId:b.id,quantity:3}]);
    assert.equal((await h.confirmOrder(request(),o.id)).status,200);
    const after=await snapshot(o.id,[a.id,b.id]);
    assert.equal(after.products.find((p)=>p.id===a.id)!.stock,4);
    assert.equal(after.products.find((p)=>p.id===b.id)!.stock,6);
    assert.equal(after.logs.length,2);
    assert.deepEqual(after.logs.map((l)=>l.delta).sort((a:number,b:number)=>a-b),[-3,-2]);
  });
  await t.test("PATCH: later stock shortage rolls back earlier decrement/log/status",async()=>{
    const a=await product(8), b=await product(8);
    const [first,second]=[a,b].sort((a,b)=>a.id.localeCompare(b.id));
    await db.product.update({where:{id:second.id},data:{stock:0}});
    const o=await order([{productId:first.id,quantity:2},{productId:second.id,quantity:1}]);
    const before=await snapshot(o.id,[a.id,b.id]);
    await expectError(await h.confirmOrder(request(),o.id),409,"INSUFFICIENT_STOCK");
    assert.deepEqual(await snapshot(o.id,[a.id,b.id]),before);
  });
  await t.test("PATCH: unexpected ledger failure rolls back entire transaction",async()=>{
    const p=await product(6),o=await order([{productId:p.id,quantity:2}]);
    const before=await snapshot(o.id,[p.id]);
    const broken=new Proxy(db, { get(target,key) {
      if(key==="$transaction") return (fn:(tx: Prisma.TransactionClient)=>Promise<unknown>,options?:{maxWait?:number;timeout?:number;isolationLevel?:Prisma.TransactionIsolationLevel})=>target.$transaction(async(tx: Prisma.TransactionClient)=>{
        const wrapped=new Proxy(tx,{get(t,k){
          if(k==="inventoryLog") return {create:async()=>{throw new Error("Injected ledger failure");}};
          return Reflect.get(t,k);
        }});
        return fn(wrapped);
      },options);
      const value=Reflect.get(target,key);
      return typeof value==="function"?value.bind(target):value;
    }});
    await expectError(await createOrderHandlers(broken).confirmOrder(request(),o.id),500,"INTERNAL_ERROR");
    assert.deepEqual(await snapshot(o.id,[p.id]),before);
  });
  await t.test("PATCH: duplicate lines aggregate to one reservation/log",async()=>{
    const p=await product(10),o=await order([{productId:p.id,quantity:2},{productId:p.id,quantity:3}]);
    assert.equal((await h.confirmOrder(request(),o.id)).status,200);
    const s=await snapshot(o.id,[p.id]);assert.equal(s.products[0].stock,5);
    assert.equal(s.logs.length,1);assert.equal(s.logs[0].delta,-5);
  });
  await t.test("PATCH: individually sufficient duplicate lines can fail aggregate check",async()=>{
    const p=await product(4),o=await order([{productId:p.id,quantity:3},{productId:p.id,quantity:2}]);
    const before=await snapshot(o.id,[p.id]);
    await expectError(await h.confirmOrder(request(),o.id),409,"INSUFFICIENT_STOCK");
    assert.deepEqual(await snapshot(o.id,[p.id]),before);
  });
  await t.test("PATCH: stock exactly equal to demand reaches zero, not negative",async()=>{
    const p=await product(2),o=await order([{productId:p.id,quantity:2}]);
    assert.equal((await h.confirmOrder(request(),o.id)).status,200);
    assert.equal((await snapshot(o.id,[p.id])).products[0].stock,0);
  });
  await t.test("PATCH: concurrent requests for same order reserve only once",async()=>{
    const p=await product(10),o=await order([{productId:p.id,quantity:3}]);
    const responses=await Promise.all([h.confirmOrder(request(),o.id),peerHandlers.confirmOrder(request(),o.id)]);
    assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
    await expectError(responses.find(r=>r.status===409)!,409,"INVALID_STATE_TRANSITION");
    const s=await snapshot(o.id,[p.id]);assert.equal(s.products[0].stock,7);assert.equal(s.logs.length,1);
  });
  await t.test("PATCH: two orders compete for limited stock, no overselling",async()=>{
    const p=await product(3),a=await order([{productId:p.id,quantity:2}]),b=await order([{productId:p.id,quantity:2}]);
    const responses=await Promise.all([h.confirmOrder(request(),a.id),peerHandlers.confirmOrder(request(),b.id)]);
    assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);
    await expectError(responses.find(r=>r.status===409)!,409,"INSUFFICIENT_STOCK");
    const states=await db.order.findMany({where:{id:{in:[a.id,b.id]}},orderBy:{id:"asc"}});
    assert.deepEqual(states.map(o=>o.status).sort(),["CONFIRMED","CREATED"]);
    assert.equal((await db.product.findUniqueOrThrow({where:{id:p.id}})).stock,1);
    const logs=await db.inventoryLog.findMany({where:{productId:p.id}});
    assert.equal(logs.length,1);assert.equal(logs[0].delta,-2);
  });
  await t.test("PATCH: invalid historical quantity or empty lines => no mutation",async()=>{
    const p=await product(5);
    for(const lines of [[],[{productId:p.id,quantity:0}],[{productId:p.id,quantity:-1}]]) {
      const o=await order(lines);const before=await snapshot(o.id,[p.id]);
      await expectError(await h.confirmOrder(request(),o.id),400,"INVALID_ARGUMENT");
      assert.deepEqual(await snapshot(o.id,[p.id]),before);
    }
  });
}
