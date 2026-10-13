const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const runtime=fs.readFileSync(path.join(root,'deploy-server.js'),'utf8');
const backend=fs.readFileSync(path.join(root,'backend','server.js'),'utf8');
const html=fs.readFileSync(path.join(root,'affiliate-shop','index.html'),'utf8');
const pkg=require(path.join(root,'package.json'));

test('v1302 behavior remains in current package',()=>assert.ok(['1.0.1302','1.0.1303','1.0.1304','1.0.1305','1.0.1306'].includes(pkg.version)));
test('Shopee openapp identity is recognized and canonicalized',()=>{
  for(const src of [runtime,backend]){
    assert.match(src,/\\\/openapp\\\//);
    assert.match(src,/function azShopeeHasCanonicalProductPath/);
    assert.match(src,/!azShopeeHasCanonicalProductPath\(productUrl,ids\)/);
  }
});
test('internal Shopee config tokens cannot count as product metadata',()=>{
  for(const src of [runtime,backend]){
    assert.match(src,/function azShopeeLooksLikeInternalToken/);
    assert.match(src,/shopee_language/);
    assert.match(src,/shopee_mart/);
  }
  assert.match(runtime,/if\(!ids\?\.itemId\) return empty/);
});
test('affiliate short link remains Buy Now',()=>assert.match(html,/link:check\.link/));
