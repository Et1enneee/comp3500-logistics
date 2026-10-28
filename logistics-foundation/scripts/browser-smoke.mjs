import { chromium } from 'playwright';
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
if(process.env.FOUNDATION_BROWSER_TEST !== 'YES') throw new Error('仅在可丢弃、全新 seed 的本机演示库中测试。设置 FOUNDATION_BROWSER_TEST=YES 确认。');
const base=process.env.FOUNDATION_BASE_URL || 'http://127.0.0.1:3100';
if(!['127.0.0.1','localhost'].includes(new URL(base).hostname)) throw new Error('只允许本机测试');
const dir=path.resolve('docs/evidence');
const passed=[]; const consoleErrors=[];
const db=new PrismaClient();
(async()=>{
 const browser=await chromium.launch({...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {}),headless:true,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1440,height:1000},colorScheme:'light'});
 const page=await context.newPage(); page.on('pageerror',e=>consoleErrors.push(e.message));
 const check=async(name,fn)=>{await fn();passed.push(name);console.log('PASS '+name)};
 const shot=async(name)=>{await page.screenshot({path:dir+'/'+name+'.png',fullPage:true});};
 try {
  await check('home renders database catalog, initial total ¥3.00',async()=>{
   await page.goto(base);await page.getByRole('heading',{name:'从一张订单开始'}).waitFor();assert.equal(await page.getByTestId('cart-total').textContent(),'¥3.00');assert.match(await page.getByTestId('stock-SKU001').textContent(),/100/);await shot('01-customer-desktop');
   const html=await page.evaluate(()=>{const css=[...document.styleSheets].map(s=>{try{return [...s.cssRules].map(r=>r.cssText).join('\n')}catch{return ''}}).join('\n');const clone=document.documentElement.cloneNode(true);clone.querySelectorAll('script,link').forEach(n=>n.remove());const style=document.createElement('style');style.textContent=css;clone.querySelector('head').appendChild(style);return '<!doctype html>'+clone.outerHTML;});await fs.writeFile(dir+'/home-preview.html',html);
  });
  await check('staff empty / blank input / not-found error',async()=>{
   await page.goto(base+'/staff');await page.getByText('先查询，再确认',{exact:true}).waitFor();await shot('02-staff-empty');await page.getByRole('button',{name:'查询订单',exact:true}).click();await page.getByRole('alert').filter({hasText:'请输入'}).waitFor();await page.getByLabel('订单号',{exact:true}).fill('ORD-19000101-0000');await page.getByRole('button',{name:'查询订单',exact:true}).click();await page.getByRole('alert').filter({hasText:'订单不存在'}).waitFor();
  });
  let number,id;
  await check('browser creates order and inventory stays unchanged',async()=>{
   await page.goto(base);const waiting=page.waitForResponse(r=>r.url().endsWith('/api/v1/orders')&&r.request().method()==='POST');await page.getByRole('button',{name:'提交订单',exact:true}).click();assert.equal((await waiting).status(),201);await page.getByTestId('created-order-number').waitFor();number=(await page.getByTestId('created-order-number').textContent()).trim();const order=await db.order.findUniqueOrThrow({where:{orderNumber:number}});id=order.id;assert.equal(order.totalCents,300);assert.equal(order.status,'CREATED');assert.equal((await db.product.findUniqueOrThrow({where:{sku:'SKU001'}})).stock,100);assert.equal(await db.inventoryLog.count({where:{orderId:id}}),0);await shot('03-order-created');
  });
  await check('created order link prefills lookup and resolves internal ID',async()=>{
   await page.getByRole('link',{name:'带入员工工作台 →'}).click();await page.getByLabel('订单号',{exact:true}).waitFor();assert.equal(await page.getByLabel('订单号',{exact:true}).inputValue(),number);await page.getByRole('button',{name:'查询订单',exact:true}).click();await page.getByTestId('order-status').filter({hasText:'CREATED'}).waitFor();assert.ok((await page.locator('main').innerText()).includes(id));
  });
  await check('customer role forbidden; order and inventory unchanged',async()=>{
   await page.getByLabel('演示操作账号').selectOption('customer@demo.com');await page.getByRole('button',{name:'确认订单',exact:true}).click();await page.getByRole('alert').filter({hasText:'HTTP 403'}).waitFor();assert.equal((await db.order.findUniqueOrThrow({where:{id}})).status,'CREATED');assert.equal((await db.product.findUniqueOrThrow({where:{sku:'SKU001'}})).stock,100);await shot('04-role-forbidden');
  });
  await check('staff confirms real order; DB stock 100→98 / one ORDER_CONFIRM log',async()=>{
   await page.getByLabel('演示操作账号').selectOption('staff@demo.com');await page.getByRole('button',{name:'确认订单',exact:true}).click();await page.getByTestId('order-status').filter({hasText:'CONFIRMED'}).waitFor();await page.getByRole('button',{name:'已确认，不可重复操作'}).waitFor();assert.ok(await page.getByRole('button',{name:'已确认，不可重复操作'}).isDisabled());assert.equal((await db.product.findUniqueOrThrow({where:{sku:'SKU001'}})).stock,98);const logs=await db.inventoryLog.findMany({where:{orderId:id}});assert.equal(logs.length,1);assert.equal(logs[0].delta,-2);assert.equal(logs[0].reason,'ORDER_CONFIRM');await shot('05-order-confirmed');
  });
  await check('actual HTTP repeat returns 409 without another stock/log change',async()=>{
   const r=await page.request.patch(base+`/api/v1/orders/${id}/status`,{headers:{'X-Demo-User-Email':'staff@demo.com'},data:{to:'CONFIRMED'}});assert.equal(r.status(),409);assert.equal((await r.json()).error.code,'INVALID_STATE_TRANSITION');assert.equal((await db.product.findUniqueOrThrow({where:{sku:'SKU001'}})).stock,98);assert.equal(await db.inventoryLog.count({where:{orderId:id}}),1);
  });
  await check('customer page reload displays current database stock 98',async()=>{
   await page.getByRole('link',{name:'客户下单',exact:true}).click();await page.getByTestId('stock-SKU001').waitFor();assert.match(await page.getByTestId('stock-SKU001').textContent(),/98/);
  });
  await check('mobile insufficient-stock error; no order written; no page overflow',async()=>{
   await page.setViewportSize({width:390,height:844});await page.reload();await page.getByLabel('SKU001 数量').fill('0');await page.getByLabel('SKU007 数量').fill('10');const count=await db.order.count();await page.getByRole('button',{name:'提交订单',exact:true}).click();await page.getByRole('alert').filter({hasText:'可用库存为 4'}).waitFor();assert.equal(await db.order.count(),count);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot('06-mobile-insufficient');
  });
  await check('mobile confirmation layout / no horizontal document overflow',async()=>{
   await page.goto(base+`/staff?orderNumber=${number}`);await page.getByRole('button',{name:'查询订单',exact:true}).click();await page.getByTestId('order-status').filter({hasText:'CONFIRMED'}).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot('07-mobile-staff');
  });
  let chainNumber,chainId;
  await check('v0.3 chain: confirm → pick → ship one LG waybill; stock unchanged by shipping',async()=>{
   await page.setViewportSize({width:1440,height:1000});
   const created=await page.request.post(base+'/api/v1/orders',{data:{email:'customer@demo.com',items:[{sku:'SKU001',quantity:1}]}});assert.equal(created.status(),201);
   const {order}=await created.json();chainNumber=order.orderNumber;chainId=order.id;
   const stockBefore=(await db.product.findUniqueOrThrow({where:{sku:'SKU001'}})).stock;
   await page.goto(base+'/staff?orderNumber='+encodeURIComponent(chainNumber));
   await page.getByRole('button',{name:'查询订单',exact:true}).click();
   await page.getByTestId('order-status').filter({hasText:'CREATED'}).waitFor();
   assert.equal(await page.getByTestId('tracking-warning').count(),0);
   await page.getByLabel('演示操作账号').selectOption('staff@demo.com');
   await page.getByRole('button',{name:'确认订单',exact:true}).click();
   await page.getByTestId('order-status').filter({hasText:'CONFIRMED'}).waitFor();
   await page.getByRole('button',{name:'开始拣货',exact:true}).click();
   await page.getByTestId('order-status').filter({hasText:'PICKING'}).waitFor();
   const stockAfterPick=(await db.product.findUniqueOrThrow({where:{sku:'SKU001'}})).stock;
   assert.equal(stockAfterPick,stockBefore-1);
   await page.getByRole('button',{name:'发货',exact:true}).click();
   await page.getByTestId('tracking-number').waitFor();
   const tn=(await page.getByTestId('tracking-number').textContent()).trim();assert.match(tn,/^LG-\d{8}-\d{6}$/);
   assert.equal((await db.product.findUniqueOrThrow({where:{sku:'SKU001'}})).stock,stockAfterPick);
   assert.equal((await db.order.findUniqueOrThrow({where:{id:chainId}})).status,'SHIPPED');
   assert.equal(await db.shipment.count({where:{orderId:chainId}}),1);
   assert.equal(await db.trackingEvent.count({where:{shipment:{orderId:chainId}}}),1);
   await shot('09-logistics-shipped');
  });
  await check('v0.3 chain: duplicate shipment returns 409 with single waybill',async()=>{
   const r=await page.request.post(base+'/api/v1/shipments',{headers:{'X-Demo-User-Email':'staff@demo.com'},data:{orderNumber:chainNumber,carrier:'顺丰速运'}});assert.equal(r.status(),409);
   assert.equal(await db.shipment.count({where:{orderId:chainId}}),1);
  });
  await check('v0.3.1 chain: tracking 500 after successful transit warns without false failure',async()=>{
   await page.route('**/tracking',route=>route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:{code:'INTERNAL_ERROR',message:'注入的追踪故障'}})}));
   await page.getByRole('button',{name:'模拟揽收',exact:true}).click();
   await page.getByTestId('order-status').filter({hasText:'IN_TRANSIT'}).waitFor();
   await page.getByTestId('tracking-warning').waitFor();
   const warn=(await page.getByTestId('tracking-warning').textContent()).trim();
   assert.ok(warn.includes('运单追踪读取失败'),warn);
   const alertTexts=await page.getByRole('alert').allTextContents();
   assert.ok(!alertTexts.some(t=>t.includes('操作失败')||t.includes('结果未知')),JSON.stringify(alertTexts));
   assert.equal(await page.getByRole('button',{name:'模拟揽收',exact:true}).count(),0);
   await page.getByRole('button',{name:'模拟签收',exact:true}).waitFor();
   await page.unroute('**/tracking');
  });
  await check('v0.3.1 chain: deliver shows 3 ordered events; tracking network error warns on lookup',async()=>{
   await page.getByRole('button',{name:'模拟签收',exact:true}).click();
   await page.getByTestId('order-status').filter({hasText:'DELIVERED'}).waitFor();
   await page.getByTestId('tracking-number').waitFor();
   const t=await (await page.request.get(base+'/api/v1/orders/'+chainId+'/tracking')).json();
   assert.equal(t.events.length,3);assert.deepEqual(t.events.map(e=>e.location),['仓库','揽收网点','收件地址']);
   assert.ok((await page.getByTestId('tracking-events').textContent()).includes('3 条'));
   await shot('10-logistics-delivered');
   await page.route('**/tracking',route=>route.abort('failed'));
   await page.getByRole('button',{name:'查询订单',exact:true}).click();
   await page.getByTestId('order-status').filter({hasText:'DELIVERED'}).waitFor();
   await page.getByTestId('tracking-warning').waitFor();
   const warn=(await page.getByTestId('tracking-warning').textContent()).trim();
   assert.ok(warn.includes('网络错误'),warn);
   const alertTexts=await page.getByRole('alert').allTextContents();
   assert.ok(alertTexts.every(t=>t.trim()===""),JSON.stringify(alertTexts));
   await page.unroute('**/tracking');
   await shot('11-tracking-failure-notice');
  });
  await check('network-unknown state removes stale confirmation action',async()=>{
   const r=await page.request.post(base+'/api/v1/orders',{data:{email:'customer@demo.com',items:[{sku:'SKU001',quantity:1}]}});assert.equal(r.status(),201);const {order}=await r.json();await page.getByLabel('订单号',{exact:true}).fill(order.orderNumber);await page.getByRole('button',{name:'查询订单',exact:true}).click();await page.getByTestId('order-status').filter({hasText:'CREATED'}).waitFor();await page.route('**/api/v1/orders/*/status',route=>route.abort('failed'));await page.getByRole('button',{name:'确认订单',exact:true}).click();await page.getByRole('alert').filter({hasText:'确认结果未知'}).waitFor();assert.equal(await page.getByRole('button',{name:'确认订单',exact:true}).count(),0);await page.unroute('**/api/v1/orders/*/status');
  });
  await check('mobile dark scheme is usable / no page exceptions',async()=>{
   await page.emulateMedia({colorScheme:'dark'});await page.goto(base);await page.getByRole('heading',{name:'从一张订单开始'}).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot('08-mobile-dark');assert.deepEqual(consoleErrors,[]);
  });
  await fs.writeFile(dir+'/browser-results.json',JSON.stringify({passed,consoleErrors,orderNumber:number,internalId:id},null,2));
 } finally {await context.close();await browser.close();await db.$disconnect();}
})().then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)});
