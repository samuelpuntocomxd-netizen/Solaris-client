const test=require('node:test'); const assert=require('node:assert/strict'); const c=require('../lib/cosmetics');
test('crea borrador con autor y licencia',()=>{const x=c.create([],{name:'Solar Cape',author:'Samu',type:'cape',license:'CC-BY-4.0'}); assert.equal(x.status,'draft'); assert.equal(x.type,'cape');});
test('rechaza tipo desconocido',()=>assert.throws(()=>c.validateCosmetic({name:'X',author:'A',type:'hack'})));
test('exporta e importa formato Solaris',()=>{const x=c.create([],{name:'Alas',author:'A',type:'wings'}); const y=c.importPack(c.exportPack(x)); assert.equal(y.name,'Alas'); assert.equal(y.status,'imported');});
