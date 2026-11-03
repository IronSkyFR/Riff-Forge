const test = require('node:test');
const assert = require('node:assert/strict');
const {analyze} = require('../app/src/main/assets/auto-forge.js');
// Synthetic « song » at 120 BPM: 16 calm bars (soft pad, light kick) then 16 loud bars (accented kick, hi-hats, saturated saw).
function song(sr=16000, bpm=120, calmBars=16, loudBars=16) {
 const beat=60/bpm, total=(calmBars+loudBars)*4*beat, d=new Float32Array(Math.round(total*sr)); let seed=1; const noise=()=>((seed=(seed*16807)%2147483647)/2147483647)*2-1;
 for (let i=0;i<d.length;i++) {
  const t=i/sr, b=t/beat, inBeat=(b%1)*beat, loud=t>=calmBars*4*beat, down=Math.floor(b)%4===0;
  const kick=Math.exp(-inBeat*18)*Math.sin(2*Math.PI*(55+60*Math.exp(-inBeat*30))*inBeat)*(loud?(down?1:.75):.25);
  const hat=loud?noise()*Math.exp(-((b*2)%1)*beat/2*60)*.25:0;
  const saw=loud?Math.tanh(3*(((t*110)%1)*2-1))*.25:0, pad=loud?0:Math.sin(2*Math.PI*220*t)*.08;
  d[i]=kick+hat+saw+pad;
 }
 return {d,sr,split:calmBars*4*beat};
}
const s=song(), r=analyze(s.d,s.sr);
test('auto: tempo détecté à 120 BPM', () => assert.ok(Math.abs(r.bpm-120)<=2, String(r.bpm)));
test('auto: mesures de 2 s calées sur la grille', () => {assert.ok(Math.abs(r.bar-2)<0.05);assert.ok(r.bars.length>=30)});
test('auto: le temps fort tombe sur un début de mesure', () => {const k=(r.firstDownbeat%2+2)%2;assert.ok(k<0.08||k>1.92,String(r.firstDownbeat))});
test('auto: intensité plus forte dans la partie chargée', () => {const calm=r.bars.filter(b=>b.end<=s.split),loud=r.bars.filter(b=>b.start>=s.split),m=a=>a.reduce((x,b)=>x+b.intensity,0)/a.length;assert.ok(m(loud)>m(calm)+0.3)});
test('auto: repos proposé dans la partie calme', () => assert.ok(r.suggestions.rest[0].end<=s.split+0.1, JSON.stringify(r.suggestions.rest[0])));
test('auto: effort proposé dans la partie chargée', () => assert.ok(r.suggestions.effort[0].start>=s.split-0.1, JSON.stringify(r.suggestions.effort[0])));
test('auto: boucles en mesures entières', () => ['rest','effort','rise'].forEach(k=>r.suggestions[k].forEach(c=>{const n=(c.end-c.start)/r.bar;assert.ok(Math.abs(n-Math.round(n))<1e-6&&[2,4,8].includes(c.bars))})));
test('auto: deux efforts A/B distincts proposés', () => {const [a,b]=r.suggestions.effort;assert.ok(b&&(a.start!==b.start))});
test('auto: morceau trop court refusé proprement', () => assert.throws(()=>analyze(new Float32Array(16000),16000),/court/));
test('auto: autre tempo (140 BPM) et temps fort retrouvés', () => {const x=song(16000,140,8,12),q=analyze(x.d,x.sr),bar=4*60/140,k=((q.firstDownbeat%bar)+bar)%bar;assert.ok(Math.abs(q.bpm-140)<=2,String(q.bpm));assert.ok(k<0.08||k>bar-0.08,String(q.firstDownbeat))});
