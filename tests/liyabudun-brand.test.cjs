'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../Software-Tools/index.html'),'utf8');
test('old catalogue entries render Liyabudun copy without rewriting stored product data',()=>{
 const methods=['azIsSolatTimeCatalogItem','azSoftwareDisplayDescription'].map(name=>source.split('\n').find(line=>line.includes('function '+name+'('))).join('\n');
 const scope={};vm.runInNewContext(methods+';globalThis.match=azIsSolatTimeCatalogItem;globalThis.describe=azSoftwareDisplayDescription;',scope);
 for(const item of [{name:'AZOBSS SolatTime',desc:'Install AZOBSS SolatTime for Windows'},{productId:'AZSW-372165',name:'Liyabudun',desc:'SolatTime trial'},{licenseProduct:'solattime',name:'Old listing',desc:'SolatTime'}]){
  const before=JSON.stringify(item);assert.equal(scope.match(item),true);assert.ok(scope.describe(item).includes('Liyabudun'));assert.equal(JSON.stringify(item),before);
 }
 const other={name:'Other software',desc:'A SolatTime tutorial'};assert.equal(scope.match(other),false);assert.equal(scope.describe(other),other.desc);
});
test('brand page keeps canonical checkout, download identity and publisher attribution',()=>{
 const html=fs.readFileSync(require.resolve('../solattime/index.html'),'utf8');
 assert.match(html,/<title>Liyabudun/);assert.match(html,/Dahulu AZOBSS SolatTime/);
 assert.match(html,/p=AZSW-372165/);assert.match(html,/liyabudun\/releases\/1\.0\.46\/Liyabudun_Setup\.exe/);
 assert.match(html,/oleh AZOBSS/);assert.doesNotMatch(html,/zero competition|terjamin.*carian/i);
});
