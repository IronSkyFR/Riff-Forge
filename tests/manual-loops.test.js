const test = require('node:test');
const assert = require('node:assert/strict');
const {makeStore, validateLoop, trackKey, KEY} = require('../app/src/main/assets/manual-loops.js');
function memory() { const m = new Map(); return {getItem:k => m.get(k) || null, setItem:(k,v)=>m.set(k,v), raw:m}; }
function store(s=memory()) { return {s, db:makeStore(s,()=>123)}; }
test('manuel: une boucle sans analyse musicale est acceptée', () => {
 const {db}=store(); const x=db.save('song',{name:'mon riff',start:18.134,end:33.987},240); assert.equal(x.source,'manual'); assert.equal(db.list('song')[0].start,18.134);
});
test('manuel: durée courte acceptée, aucune heuristique BPM', () => {const {db}=store(); db.save('a',{start:0,end:0.001},200);assert.equal(db.list('a').length,1)});
test('manuel: point 0 valide',()=>assert.equal(validateLoop({start:0,end:12},12),true));
test('manuel: fin avant début rejetée',()=>assert.throws(()=>validateLoop({start:12,end:11},20)));
test('manuel: dépassement de fichier rejeté',()=>assert.throws(()=>validateLoop({start:1,end:21},20)));
test('manuel: négatif rejeté',()=>assert.throws(()=>validateLoop({start:-1,end:1},20)));
test('manuel: NaN rejeté',()=>assert.throws(()=>validateLoop({start:NaN,end:1},20)));
test('manuel: modifiable avec identifiant stable',()=>{const {db}=store();const x=db.save('a',{start:1,end:4},10);db.save('a',{id:x.id,start:2,end:8},10);assert.equal(db.list('a').length,1);assert.equal(db.list('a')[0].start,2)});
test('manuel: suppression n’affecte pas autre morceau',()=>{const {db}=store();let x=db.save('a',{start:1,end:4},10);db.save('b',{start:3,end:4},10);db.remove('a',x.id);assert.equal(db.list('b').length,1)});
test('manuel: persistant après redémarrage du store',()=>{const s=memory();makeStore(s,()=>1).save('a',{start:0,end:12},20);assert.equal(makeStore(s,()=>2).list('a').length,1)});
test('manuel: export/import restaure les données',()=>{const a=store();a.db.save('song',{start:3,end:12},20);let json=a.db.exportJson();const b=store();b.db.importJson(json);assert.equal(b.db.list('song').length,1)});
test('manuel: JSON corrompu ne doit pas être écrasé',()=>{const s=memory();s.setItem(KEY,'{bad');const db=makeStore(s);assert.throws(()=>db.save('a',{start:1,end:2},10));assert.equal(s.getItem(KEY),'{bad')});
test('manuel: erreur de quota ne donne pas un faux succès',()=>{const db=makeStore({getItem:()=>null,setItem:()=>{throw Error('quota')}});assert.throws(()=>db.save('a',{start:1,end:2},10),/quota/)});
test('identité du fichier stable',()=>assert.equal(trackKey({name:'A.mp3',size:500,lastModified:100}),trackKey({name:'A.mp3',size:500,lastModified:100})));
test('manuel: fichier sans taille refusé',()=>assert.throws(()=>trackKey({name:'A.mp3'})));
