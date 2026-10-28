import { test } from "node:test";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { runScenarios } from "./orders.scenarios";

// No client ever connects to the project's dev.db.
test("REAL Prisma 6 / isolated SQLite integration", { timeout: 180000 }, async(t)=>{
  const directory=await mkdtemp(join(tmpdir(),"order-confirm-integration-"));
  let db: PrismaClient | undefined;
  let peer: PrismaClient | undefined;
  try {
    const url="file:"+join(directory,"test.db").replaceAll("\\","/");
    const source=await readFile(resolve("prisma/schema.prisma"),"utf8");
    const matches=source.match(/url\s*=\s*"file:\.\/dev\.db"/g);
    if(matches?.length!==1) throw new Error("Expected uploaded SQLite schema URL; refusing to run against an unexpected schema.");
    const schema=source.replace(/url\s*=\s*"file:\.\/dev\.db"/,'url = env("ORDER_TEST_DATABASE_URL")');
    const schemaPath=join(directory,"schema.prisma");await writeFile(schemaPath,schema);
    const require=createRequire(resolve("package.json"));
    execFileSync(process.execPath,[require.resolve("prisma/build/index.js"),"db","push","--schema",schemaPath,"--skip-generate"],{
      env:{...process.env,ORDER_TEST_DATABASE_URL:url},stdio:"pipe",timeout:60000,
    });
    db=new PrismaClient({datasources:{db:{url}}});
    await db.$connect();
    peer=new PrismaClient({datasources:{db:{url}}});
    await peer.$connect();
    await runScenarios(db,t,peer);
  } finally {
    if(peer) await peer.$disconnect();
    if(db) await db.$disconnect();
    await rm(directory,{recursive:true,force:true});
  }
});
