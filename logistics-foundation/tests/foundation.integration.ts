import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp,readFile,writeFile,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join,resolve } from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { createOrderPost } from "../lib/create-order";
import { createOrderHandlers } from "../lib/order-api";
test("Foundation creation / real isolated SQLite",{timeout:180000},async t=>{
 const directory=await mkdtemp(join(tmpdir(),"foundation-create-")); let db:PrismaClient|undefined;
 try {
  const url="file:"+join(directory,"test.db");
  const source=await readFile(resolve("prisma/schema.prisma"),"utf8");
  assert.match(source,/url\s*=\s*"file:\.\/dev\.db"/);
  const schema=join(directory,"schema.prisma"); await writeFile(schema,source.replace(/url\s*=\s*"file:\.\/dev\.db"/,'url = env("ORDER_TEST_DATABASE_URL")'));
  const require=createRequire(resolve("package.json"));execFileSync(process.execPath,[require.resolve("prisma/build/index.js"),"db","push","--schema",schema,"--skip-generate"],{env:{...process.env,ORDER_TEST_DATABASE_URL:url},stdio:"pipe",timeout:60000});
  const client = db = new PrismaClient({datasources:{db:{url}}});await client.$connect();
  await client.user.createMany({data:[{email:"customer@test.local",name:"Customer",role:"CUSTOMER",passwordHash:"NEVER_LEAK"},{email:"staff@test.local",name:"Staff",role:"STAFF",passwordHash:"DEMO_ONLY"}]});
  const product=await client.product.create({data:{sku:"SKU001",name:"Water",priceCents:150,stock:10}});
  const post=createOrderPost(client); const handlers=createOrderHandlers(client);
  const request=(body:unknown)=>new Request("http://localhost/api/v1/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  let createdId="",createdNumber="";
  await t.test("create stores snapshot / leaves inventory and logs unchanged",async()=>{
   const r=await post(request({email:"customer@test.local",items:[{sku:"SKU001",quantity:2}]}));assert.equal(r.status,201);const {order}=await r.json();createdId=order.id;createdNumber=order.orderNumber;assert.match(order.orderNumber,/^ORD-\d{8}-\d{4}$/);assert.equal(order.status,"CREATED");assert.equal(order.totalCents,300);assert.equal(order.items[0].unitPriceCents,150);assert.equal((await client.product.findUniqueOrThrow({where:{id:product.id}})).stock,10);assert.equal(await client.inventoryLog.count(),0);
  });
  await t.test("duplicate SKUs aggregate before stock precheck",async()=>{const count=await client.order.count();const r=await post(request({email:"customer@test.local",items:[{sku:"SKU001",quantity:6},{sku:"SKU001",quantity:6}]}));assert.equal(r.status,400);assert.match((await r.json()).error.message,/库存/);assert.equal(await client.order.count(),count);});
  await t.test("valid duplicate SKUs become one order line",async()=>{const r=await post(request({email:"customer@test.local",items:[{sku:"SKU001",quantity:1},{sku:"SKU001",quantity:2}]}));assert.equal(r.status,201);const {order}=await r.json();assert.equal(order.items.length,1);assert.equal(order.items[0].quantity,3);assert.equal(order.totalCents,450);});
  await t.test("reject empty / negative / fractional / malformed lines without writing",async()=>{const count=await client.order.count();for(const items of [[],[{sku:"SKU001",quantity:-2}],[{sku:"SKU001",quantity:1.5}],[{sku:"SKU001",quantity:"2"}],[null]])assert.equal((await post(request({email:"customer@test.local",items}))).status,400);assert.equal(await client.order.count(),count);});
  await t.test("malformed JSON / null request return structured 400",async()=>{const r=await post(new Request("http://localhost",{method:"POST",body:"{"}));assert.equal(r.status,400);assert.equal((await r.json()).error.code,"INVALID_ARGUMENT");assert.equal((await post(request(null))).status,400);});
  await t.test("unknown SKU / customer are rejected",async()=>{for(const body of [{email:"customer@test.local",items:[{sku:"MISSING",quantity:1}]},{email:"missing@test.local",items:[{sku:"SKU001",quantity:1}]}])assert.equal((await post(request(body))).status,400);});
  await t.test("non-customer demo role cannot create orders",async()=>assert.equal((await post(request({email:"staff@test.local",items:[{sku:"SKU001",quantity:1}]}))).status,403));
  await t.test("end-to-end create / lookup / confirm / repeat preserves snapshot",async()=>{
   await client.product.update({where:{id:product.id},data:{priceCents:200}});
   const detail=await handlers.getOrder(new Request(`http://localhost/api/v1/orders?orderNumber=${createdNumber}`));assert.equal(detail.status,200);assert.ok(!JSON.stringify(await detail.json()).includes("passwordHash"));
   const confirm=()=>handlers.confirmOrder(new Request("http://localhost",{method:"PATCH",headers:{"Content-Type":"application/json","X-Demo-User-Email":"staff@test.local"},body:JSON.stringify({to:"CONFIRMED"})}),createdId);
   assert.equal((await confirm()).status,200);assert.equal((await client.product.findUniqueOrThrow({where:{id:product.id}})).stock,8);assert.equal(await client.inventoryLog.count({where:{orderId:createdId}}),1);assert.equal((await confirm()).status,409);assert.equal((await client.order.findUniqueOrThrow({where:{id:createdId}})).totalCents,300);
  });
  await t.test("stock changed after creation: confirmation fails without side effects",async()=>{
   await client.product.update({where:{id:product.id},data:{stock:10}});
   const r=await post(request({email:"customer@test.local",items:[{sku:"SKU001",quantity:10}]}));assert.equal(r.status,201);const {order}=await r.json();await client.product.update({where:{id:product.id},data:{stock:3}});
   const result=await handlers.confirmOrder(new Request("http://localhost",{method:"PATCH",headers:{"Content-Type":"application/json","X-Demo-User-Email":"staff@test.local"},body:JSON.stringify({to:"CONFIRMED"})}),order.id);assert.equal(result.status,409);assert.equal((await client.order.findUniqueOrThrow({where:{id:order.id}})).status,"CREATED");assert.equal((await client.product.findUniqueOrThrow({where:{id:product.id}})).stock,3);assert.equal(await client.inventoryLog.count({where:{orderId:order.id}}),0);
  });
 } finally {if(db)await db.$disconnect();await rm(directory,{recursive:true,force:true});}
});
