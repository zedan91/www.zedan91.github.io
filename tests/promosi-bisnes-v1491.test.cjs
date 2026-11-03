const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
const nav=fs.readFileSync(path.join(root,'assets/js/azobss-more-nav.js'),'utf8');
const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
const hub=fs.readFileSync(path.join(root,'Promosi-Bisnes','index.html'),'utf8');
const seller=fs.readFileSync(path.join(root,'Tempahan-Makanan','index.html'),'utf8');

test('v1491 package exposes Promosi Bisnes instead of Food Brownies in More menu',()=>{
  assert.equal(pkg.version,'1.0.1501');
  assert.match(nav,/foodLink\.href = '\/Promosi-Bisnes\/'/);
  assert.match(nav,/<span>Promosi Bisnes<\/span>/);
  assert.doesNotMatch(nav,/Food - Brownies/);
  assert.match(home,/href="\/Promosi-Bisnes\/"/);
});

test('Promosi Bisnes hub clearly separates AZOBSS promotion from seller transaction',()=>{
  assert.match(hub,/Paid Business Listings/);
  assert.match(hub,/Seller: Lynn/);
  assert.match(hub,/AZOBSS tidak menerima bayaran produk/);
  assert.match(hub,/Customer berurusan terus dengan seller/);
  assert.match(hub,/Promosikan Bisnes Anda/);
  assert.match(hub,/wa\.me\/601135600723/);
});

test('Lynn Brownies is a promoted listing and customer order goes direct to seller',()=>{
  assert.match(seller,/Promoted Listing/);
  assert.match(seller,/AZOBSS menyediakan ruang promosi sahaja/);
  assert.match(seller,/AZOBSS tidak menerima bayaran atau mengurus penghantaran/);
  assert.match(seller,/wa\.me\/60178809488/);
  assert.doesNotMatch(seller,/azobss-food-orders\.js/);
  assert.doesNotMatch(seller,/AZOBSSFoodOrders/);
  assert.doesNotMatch(seller,/Rekod Tempahan Makanan/);
});
