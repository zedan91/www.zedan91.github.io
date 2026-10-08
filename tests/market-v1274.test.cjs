const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');
const html=fs.readFileSync(path.join(root,'AZOBSS-Market','index.html'),'utf8');
const rules=fs.readFileSync(path.join(root,'FIREBASE-RULES-AZOBSS-v1274-MARKET-ADMIN-ONLY.txt'),'utf8');

test('Market publish UI is admin-only and Firestore writes are admin-only',()=>{
  assert.match(html,/id="azMarketSellBtn"[^>]*hidden/);
  assert.match(html,/function adminSession\(\)/);
  assert.match(html,/Only AZOBSS Administrator can publish or edit Market listings/);
  assert.match(rules,/match \/marketListings\/\{listingId\}/);
  assert.match(rules,/allow read: if true;/);
  assert.match(rules,/allow create, update, delete: if isAdmin\(\);/);
  assert.doesNotMatch(rules,/resource\.data\.sellerUid == request\.auth\.uid/);
});

test('Market supports multi-photo upload, edit, zoom gallery and direct sharing',()=>{
  assert.match(html,/name="photos"[^>]*multiple/);
  assert.match(html,/MAX_IMAGES=8/);
  assert.match(html,/imagesData:images/);
  assert.match(html,/updateDoc\(doc\(db,COLLECTION,editingListingId\)/);
  assert.match(html,/id="azMarketImageViewer"/);
  assert.match(html,/data-market-thumb-index/);
  assert.match(html,/data-market-share/);
  assert.match(html,/searchParams\.set\('listing',id\)/);
});

test('Firefox-safe image conversion flattens transparency before JPEG compression',()=>{
  assert.match(html,/ctx\.fillStyle='#ffffff'/);
  assert.match(html,/ctx\.fillRect\(0,0,w,h\)/);
  assert.match(html,/toDataURL\('image\/jpeg',q\)/);
});
