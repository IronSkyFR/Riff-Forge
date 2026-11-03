const test = require('node:test');
const assert = require('node:assert/strict');
const manual = require('../legacy-port/riff-manual-override.js');
function memory() {
  const m = new Map();
  return {getItem:k => m.has(k) ? m.get(k) : null, setItem:(k,v) => m.set(k,v), raw:m};
}
function api(storage=memory()) {return manual.create(storage, {now:()=>1234})}
const song='artist::song.mp3::1234';
test('ancien moteur: automatique inchangé par défaut',()=>{
 const m=api(), previous={id:'auto-a',start:8,end:14};
 m.save(song,{name:'Ma création',start:2,end:4},60);
 assert.strictEqual(m.resolve(song,previous),previous);
 assert.strictEqual(m.resolve(song,previous,{mode:'auto'}),previous);
});
test('mode manuel choisi explicitement, conserve mes points',()=>{
 const m=api(), saved=m.save(song,{name:'Coup de poing',role:'effort',start:17.123,end:33.987},80);
 assert.deepEqual(m.resolve(song,{id:'auto'},{mode:'manual',id:saved.id}),saved);
});
test('absence de choix manuel ne relance PAS le détecteur',()=>{
 const m=api();
 assert.strictEqual(m.resolve(song,{id:'auto'},{mode:'manual',id:'missing'}),null);
});
test('aucune validation BPM, tonalité, raccord ou énergie',()=>{
 const m=api();
 assert.equal(m.save(song,{start:0,end:0.001},60).end,0.001);
 assert.equal(m.save(song,{start:9.731,end:19.003},60).start,9.731);
});
test('les repères hors bornes sont refusés',()=>{
 const m=api();
 for(const l of [{start:-1,end:2},{start:2,end:2},{start:2,end:1},{start:2,end:500},{start:NaN,end:3},{start:1,end:Infinity}])
   assert.throws(()=>m.save(song,l,60));
});
test('une nouvelle boucle ne remplace pas les précédentes',()=>{
 const m=api();
 const a=m.save(song,{name:'A',start:1,end:3},60),b=m.save(song,{name:'B',start:8,end:14},60);
 assert.notEqual(a.id,b.id);assert.equal(m.list(song).length,2);
});
test('modification explicite met à jour une seule boucle',()=>{
 const m=api();
 const a=m.save(song,{start:1,end:3},60),b=m.save(song,{start:8,end:14},60);
 m.save(song,{id:a.id,start:1.2,end:3.4},60);
 assert.equal(m.list(song).length,2);assert.equal(m.list(song)[0].start,1.2);assert.equal(m.list(song)[1].id,b.id);
});
test('édition avec identifiant inconnu: ne crée pas à la place',()=>{
 const m=api();assert.throws(()=>m.save(song,{id:'old',start:1,end:2},60));
});
test('plusieurs morceaux indépendants',()=>{
 const m=api();m.save(song,{start:1,end:3},10);m.save('song-2',{start:4,end:5},10);
 assert.equal(m.list(song).length,1);assert.equal(m.list('song-2').length,1);
});
test('les données survivent à une nouvelle instance',()=>{
 const s=memory();api(s).save(song,{start:1,end:3},10);assert.equal(api(s).list(song).length,1);
});
test('sauvegarde JSON et restauration sans effacer les autres',()=>{
 const one=api(),two=api();
 one.save(song,{start:1,end:4},10);two.save('track2',{start:2,end:3},10);
 assert.equal(two.importBackup(one.exportBackup()),1);assert.equal(two.list('track2').length,1);assert.equal(two.list(song).length,1);
 assert.equal(two.importBackup(one.exportBackup()),0);
});
test('conflit à import : ne détruit pas les modifications locales',()=>{
 const x=api(),y=api(), a=x.save(song,{name:'Original',start:1,end:2},10);
 y.importBackup(x.exportBackup());
 y.save(song,{id:a.id,name:'Retouchée',start:1.5,end:2.5},10);
 assert.equal(y.importBackup(x.exportBackup()),1);
 assert.equal(y.list(song).length,2);
 assert.equal(y.list(song)[0].name,'Retouchée');
});
test('JSON invalide : zéro mutation',()=>{
 const s=memory(),m=api(s);m.save(song,{start:1,end:2},5);const before=s.getItem(m.storageKey);
 assert.throws(()=>m.importBackup('{"tracks":{"wrong":{"loops":[{"start":9}]}}}'));
 assert.equal(s.getItem(m.storageKey),before);
});
test('quota rempli: ne prétend pas enregistrer',()=>{
 const m=manual.create({getItem:()=>null,setItem:()=>{throw new Error('quota')}});assert.throws(()=>m.save(song,{start:1,end:2},8),/quota/);
});
test('suppression: n’efface pas les autres morceaux',()=>{
 const m=api(),l=m.save(song,{start:1,end:3},5);m.save('b',{start:2,end:3},5);
 assert.equal(m.remove(song,l.id),true);assert.equal(m.list('b').length,1);
});
