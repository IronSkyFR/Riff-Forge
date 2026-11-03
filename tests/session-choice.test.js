const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../app/src/main/assets/session-choice.js');
const loops=[
 {id:'r',role:'rest',start:0,end:10},
 {id:'m',role:'rise',start:11,end:14},
 {id:'a1',role:'effort',start:20,end:30},
 {id:'a2',role:'effort',start:31,end:40},
 {id:'a3',role:'effort',start:41,end:50}
];
function storage(){const m=new Map();return {getItem:k=>m.has(k)?m.get(k):null,setItem:(k,v)=>m.set(k,v)}}
test('par défaut: repos puis montée puis un seul effort A',()=>{
 assert.deepEqual(C.choose(loops,{}).map(l=>l.id),['r','m','a1']);
});
test('B désactivé même avec trois efforts disponibles',()=>{
 assert.equal(C.choose(loops,{useB:false,effortB:'a2'}).filter(l=>l.role==='effort').length,1);
});
test('effort A manuel choisi explicitement',()=>{
 assert.deepEqual(C.choose(loops,{effortA:'a3'}).map(l=>l.id),['r','m','a3']);
});
test('repos et montée manuels choisis explicitement',()=>{
 const all=[...loops,{id:'r2',role:'rest',start:51,end:60},{id:'m2',role:'rise',start:61,end:65}];
 assert.deepEqual(C.choose(all,{rest:'r2',rise:'m2'}).slice(0,2).map(l=>l.id),['r2','m2']);
});
test('B volontairement activé et sélectionné',()=>{
 assert.deepEqual(C.choose(loops,{useB:true,effortA:'a1',effortB:'a3'}).filter(x=>x.role==='effort').map(x=>x.id),['a1','a3']);
});
test('B activé sans sélection: prend deuxième effort distinct',()=>{
 assert.deepEqual(C.choose(loops,{useB:true}).filter(x=>x.role==='effort').map(x=>x.id),['a1','a2']);
});
test('B choisi égal à A: ne rejoue pas même riff deux fois',()=>{
 assert.deepEqual(C.choose(loops,{useB:true,effortA:'a2',effortB:'a2'}).filter(x=>x.role==='effort').map(x=>x.id),['a2','a1']);
});
test('un seul effort: B facultatif omis sans erreur',()=>{
 assert.deepEqual(C.choose(loops.slice(0,3),{useB:true}).map(x=>x.id),['r','m','a1']);
});
test('pas de musique possible: aucune boucle disponible',()=>{
 assert.deepEqual(C.choose([],{}),[]);
});
test('préférences persistées par morceau, sans contamination',()=>{
 const db=storage();
 C.write(db,'morceau1',{useB:true,effortA:'a3'});
 C.write(db,'morceau2',{effortA:'a2'});
 assert.equal(C.read(db,'morceau1').effortA,'a3');
 assert.equal(C.read(db,'morceau1').useB,true);
 assert.equal(C.read(db,'morceau2').useB,false);
 assert.equal(C.read(db,'morceau2').effortA,'a2');
});
test('config corrompue: valeurs par défaut, pas de plantage',()=>{
 const db=storage();db.setItem(C.KEY,'{bad json');
 assert.deepEqual(C.read(db,'m'),C.defaults());
});
test('échec de quota remonté',()=>{
 const db={getItem:()=>null,setItem:()=>{throw Error('quota')}};
 assert.throws(()=>C.write(db,'m',{}),/quota/);
});
test('préférences ne modifient pas les objets source',()=>{
 const orig=JSON.stringify(loops);
 C.choose(loops,{useB:true,effortA:'a3'});
 assert.equal(JSON.stringify(loops),orig);
});
test('entrée non valide ignorée dans les propositions',()=>{
 const a=[null,{id:'bad',role:'rest',start:9,end:3},loops[0]];
 assert.deepEqual(C.choose(a,{}).map(x=>x.id),['r']);
});
