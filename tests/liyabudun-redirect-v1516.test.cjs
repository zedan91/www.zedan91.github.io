'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('legacy product URL preserves query and fragment without modifying commerce routes',()=>{
 const html=fs.readFileSync(require.resolve('../solattime/index.html'),'utf8');
 const script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 for(const [search,hash] of [['',''],['?campaign=email&order=fixture','#lesen'],['?x=%26%3F','#paparan']]){
  let target;vm.runInNewContext(script,{location:{search,hash,replace:value=>target=value}});assert.equal(target,'/liyabudun/'+search+hash);
 }
 assert.match(html,/canonical" href="https:\/\/www.azobss.com\/liyabudun\//);
});
