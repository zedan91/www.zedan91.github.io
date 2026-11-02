#!/usr/bin/env node
'use strict';
const path=require('path');
const fs=require('fs');
const os=require('os');
const {createRetailerCatalogService}=require('../lib/azobss-retailer-json-catalog');
(async()=>{
  const rootDir=path.resolve(__dirname,'..');
  const args=process.argv.slice(2);const oi=args.indexOf('--output');
  const output=oi>=0&&args[oi+1]?path.resolve(args[oi+1]):path.join(os.tmpdir(),'azobss-retailer-catalog-v1496.json');
  const service=createRetailerCatalogService({rootDir,outputFile:output,perStoreDir:output.replace(/\.json$/i,'')+'-stores'});
  const catalog=await service.refresh({force:true,persist:true});
  fs.writeFileSync(output,JSON.stringify(catalog,null,2));
  console.log(JSON.stringify({ok:true,release:catalog.release,generatedAt:catalog.generatedAt,output,stats:catalog.stats,sources:catalog.sources},null,2));
})().catch(err=>{console.error(err&&err.stack||err);process.exit(1);});
