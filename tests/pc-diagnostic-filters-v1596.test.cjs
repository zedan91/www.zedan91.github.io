const test=require('node:test'),assert=require('node:assert/strict');
const filters=require('../assets/js/azobss-pc-diagnostic-filters');
const rows=[
 {id:'c',manufacturer:'Micro-Star International Co., Ltd.',model:'GE66 Raider 10SFS',serial:'SN-123-ABC',batteries:[{name:'BIF0_9'}],receivedAt:'2026-11-18T08:00:00Z',status:{sent:false}},
 {id:'a',manufacturer:'ASUSTeK COMPUTER INC.',model:'Laptop 10',serial:'A2',batteries:[],receivedAt:'2026-11-17T08:00:00Z',status:{sent:true}},
 {id:'b',manufacturer:'Hewlett-Packard',model:'Laptop 2',serial:'A10',batteries:[{name:'Not available'}],receivedAt:'2026-11-16T08:00:00Z'},
];
test('diagnostic brands group manufacturer aliases under familiar brand names',()=>{
 assert.equal(filters.brand(rows[0]),'MSI');assert.equal(filters.brand(rows[1]),'ASUS');assert.equal(filters.brand(rows[2]),'HP');
 assert.equal(filters.brand({manufacturer:'MSI'}),'MSI');assert.equal(filters.brand({manufacturer:'System manufacturer'}),'Tidak diketahui');
 assert.equal(filters.brand({manufacturer:'<New Brand>'}),'<New Brand>');
 assert.deepEqual(filters.brands([...rows,{manufacturer:'MSI'}]),[['ASUS',1],['HP',1],['MSI',2]]);
});
test('diagnostic search matches joined model numbers, partial text, serial and battery punctuation',()=>{
 for(const query of ['ge6','GE66RAIDER','raider msi','sn123abc','BIF09','bif0 9'])assert.deepEqual(filters.select(rows,{query}).map(x=>x.id),['c'],query);
 assert.deepEqual(filters.select(rows,{query:'hewlett packard'}).map(x=>x.id),['b']);
 assert.equal(filters.select(rows,{query:'unmatched'}).length,0);assert.equal(filters.select(rows,{query:'   '}).length,3);
});
test('diagnostic search handles case and accents without treating markup as executable',()=>{
 const row={id:'x',manufacturer:'Example',model:'ÉliteBook <script>',serial:'TEST'};
 assert.equal(filters.select([row],{query:'ELITEbook script'}).length,1);
 assert.equal(filters.select([row],{query:'unrelated'}).length,0);
});
test('diagnostic sorting uses real dates and natural brand/model/serial order without mutating input',()=>{
 const ids=sort=>filters.select(rows,{sort}).map(x=>x.id);
 assert.deepEqual(ids('newest'),['c','a','b']);assert.deepEqual(ids('oldest'),['b','a','c']);
 assert.deepEqual(ids('brand-asc'),['a','b','c']);assert.deepEqual(ids('brand-desc'),['c','b','a']);
 assert.deepEqual(ids('model'),['c','b','a']);assert.deepEqual(ids('serial'),['a','b','c']);
 assert.deepEqual(ids('unsent-first'),['c','b','a']);assert.deepEqual(rows.map(x=>x.id),['c','a','b']);
});
test('brand, sent state, battery and search filters combine with old reports defaulting to unsent',()=>{
 assert.deepEqual(filters.select(rows,{status:'unsent'}).map(x=>x.id),['c','b']);
 assert.deepEqual(filters.select(rows,{status:'sent'}).map(x=>x.id),['a']);
 assert.deepEqual(filters.select(rows,{battery:'detected'}).map(x=>x.id),['c']);
 assert.equal(filters.select(rows,{battery:'missing'}).length,2);
 assert.equal(filters.select(rows,{brand:'MSI',query:'ge66',status:'unsent',battery:'detected'}).length,1);
 assert.equal(filters.select(rows,{brand:'MSI',status:'sent'}).length,0);
});
test('equal-value sort results have a stable identifier tie break',()=>{
 const sample=[{id:'b',manufacturer:'MSI',model:'Same'},{id:'a',manufacturer:'MSI',model:'Same'}];
 assert.deepEqual(filters.select(sample,{sort:'brand-asc'}).map(x=>x.id),['a','b']);
});
