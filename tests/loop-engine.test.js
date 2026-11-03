const test = require('node:test');
const assert = require('node:assert/strict');
const {loopOffset, pickLoop, rpmFor, peaks, refineLoop} = require('../app/src/main/assets/loop-engine.js');
test('compte-tours: ralenti à l’arrêt, zone rouge à l’effort', () => {assert.equal(rpmFor('idle',0,10),0.9);assert.equal(rpmFor('pause',5,10),0.9);assert.ok(rpmFor('effort',5,10)>=8)});
test('compte-tours: la Montée fait grimper le régime', () => {const a=rpmFor('rest',30,10),b=rpmFor('rest',10,10),c=rpmFor('rest',5,10),d=rpmFor('rest',0,10);assert.ok(a<b&&b<c&&c<d);assert.equal(d,8)});
const loops = [{id:'r',role:'rest'},{id:'m',role:'rise'},{id:'e',role:'effort'}];
function sine(sr, seconds, hz) { const d=new Float32Array(Math.round(sr*seconds)); for(let i=0;i<d.length;i++) d[i]=Math.sin(2*Math.PI*hz*i/sr+0.3); return d; }
test('moteur: position dans la boucle conservée', () => assert.equal(loopOffset(10,14,11.5),11.5));
test('moteur: position repliée après plusieurs tours', () => assert.ok(Math.abs(loopOffset(10,14,23)-11)<1e-9));
test('moteur: position avant le début repliée dans la boucle', () => assert.equal(loopOffset(10,14,9),13));
test('moteur: boucle vide ou position invalide → début', () => {assert.equal(loopOffset(5,5,7),5);assert.equal(loopOffset(2,4,NaN),2)});
test('séance: effort joue la boucle effort', () => assert.equal(pickLoop('effort',30,10,loops).id,'e'));
test('séance: repos joue la boucle repos', () => assert.equal(pickLoop('rest',60,10,loops).id,'r'));
test('séance: fin du repos joue la Montée', () => assert.equal(pickLoop('rest',10,10,loops).id,'m'));
test('séance: Montée désactivée à 0 s', () => assert.equal(pickLoop('rest',1,0,loops).id,'r'));
test('séance: sans Montée, le repos continue', () => assert.equal(pickLoop('rest',3,10,[loops[0]]).id,'r'));
test('séance: rôle absent → silence, pause → rien', () => {assert.equal(pickLoop('effort',5,0,[loops[0]]),null);assert.equal(pickLoop('pause',5,0,loops),null)});
test('onde: crêtes par colonne', () => assert.deepEqual(peaks(Float32Array.from([0,.5,-1,.2]),2),[.5,1]));
test('raccord: début calé sur un passage à zéro montant', () => {
 const sr=8000,d=sine(sr,3,100),r=refineLoop(d,sr,1.0013,2.0),i=Math.round(r.start*sr);
 assert.ok(Math.abs(r.start-1.0013)<=0.01); assert.ok(d[i-1]<0.05 && Math.abs(d[i])<0.1 && d[i+1]>d[i-1]);
});
test('raccord: fin ajustée sur une période entière (raccord sans saut)', () => {
 const sr=8000,d=sine(sr,3,100),r=refineLoop(d,sr,1.0,2.0037);
 assert.ok(r.matched); const periods=(r.end-r.start)*100; assert.ok(Math.abs(periods-Math.round(periods))<0.02,String(periods));
});
test('raccord: proposition limitée à ±40 ms autour du choix manuel', () => {
 const sr=8000,d=sine(sr,3,100),r=refineLoop(d,sr,0.5,1.7); assert.ok(Math.abs(r.end-1.7)<=0.04);
});
test('raccord: silence → points manuels conservés', () => {
 const r=refineLoop(new Float32Array(8000*3),8000,1.234,2.5); assert.equal(r.start,1.234); assert.equal(r.end,2.5); assert.equal(r.matched,false);
});
const {waitToGrid, remixFor} = require('../app/src/main/assets/loop-engine.js');
test('A/B: deux boucles effort alternent', () => {const L=[...loops,{id:'e2',role:'effort'}];assert.equal(pickLoop('effort',5,0,L,0).id,'e');assert.equal(pickLoop('effort',5,0,L,1).id,'e2');assert.equal(pickLoop('effort',5,0,L,2).id,'e')});
test('calage: attente jusqu’à la prochaine mesure', () => assert.ok(Math.abs(waitToGrid(10.5,{end:20},0.25,2)-1.75)<1e-9));
test('calage: déjà sur la grille → pas d’attente', () => assert.equal(waitToGrid(4.25,{end:20},0.25,2),0));
test('calage: jamais au-delà de la fin de boucle', () => assert.ok(Math.abs(waitToGrid(9.5,{end:10},0,4)-0.5)<1e-9));
test('calage: sans grille → immédiat', () => assert.equal(waitToGrid(3,{end:9},0,0),0));
test('remix: repos étouffé, effort plein, montée qui s’ouvre', () => {const r=remixFor('rest'),e=remixFor('effort'),a=remixFor('rise',0),b=remixFor('rise',.5),c=remixFor('rise',1);assert.ok(r.cutoff<e.cutoff&&r.gain<e.gain&&e.drive);assert.ok(a.cutoff<b.cutoff&&b.cutoff<c.cutoff&&c.cutoff>=17000);assert.equal(a.cutoff,r.cutoff)});
