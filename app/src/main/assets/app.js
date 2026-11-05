(function () {
'use strict';
const $ = id => document.getElementById(id), E = RiffLoopEngine, AF = RiffAutoForge, GRID_KEY = 'riffforge.v2.analysis';
const database = RiffManualLoops.makeStore(window.localStorage);
const Choice = RiffSessionChoice, SILENT_KEY = 'riffforge.v2.heritage.chronoSeul';
let track = null, objectUrl = null, duration = 0, editingId = null, loopPreview = null, previewing = false;
let volume = (()=>{try{const v=Number(localStorage.getItem('riffforge.v2.volume'));return Number.isFinite(v)&&localStorage.getItem('riffforge.v2.volume')!==null?v:1}catch(_){return 1}})();
let ac = null, buffer = null, mono = null, wavePeaks = null, voice = null, wakeLock = null, fx = null, analysis = null, suggestionPreview = null;
let workout = { timer:null, stage:'idle', round:1, remaining:120, count:4, lastTick:0 };
function say(text,type=''){const el=$('message');el.className='status '+type;el.textContent=text;el.classList.remove('hidden')}
function fmt(seconds){if(!Number.isFinite(seconds))return '00:00.00';let m=Math.floor(seconds/60),s=seconds%60;return String(m).padStart(2,'0')+':'+s.toFixed(2).padStart(5,'0')}
function fmtClock(secs){const n=Math.max(0,Math.ceil(secs));return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0')}
function requireTrack(){if(!track){say('Importe d’abord un fichier audio.','error');return false}return true}
function activePage(key){['edit','work','data'].forEach(s=>{$('page-'+s).classList.toggle('hidden',s!==key);$('nav-'+s).classList.toggle('active',s===key)});$('crumb').textContent={edit:'Atelier',work:'Ta séance',data:'Mes boucles'}[key];[$('hero-a').textContent,$('hero-b').textContent,$('hero-c').textContent]={edit:['Forge ton riff.','C’est toi qui décides.','Pose tes boucles à la main, au millième. Aucune analyse ne peut les refuser.'],work:['Récupère.','Déchaîne le riff.','Récupère. Arme ton riff. Fais rugir la prochaine série.'],data:['Chaque riff compte.','Ta banque de boucles.','Tes repères restent sur cet appareil. Exporte-les avant une désinstallation.']}[key];if(key==='data')renderList();window.scrollTo(0,0)}
['edit','work','data'].forEach(s=>$('nav-'+s).addEventListener('click',()=>activePage(s)));
// Android Back button: return to the Atelier first, quit only from there (called by MainActivity).
window.RiffBack=()=>{if($('page-edit').classList.contains('hidden')){activePage('edit');return true}return false};
function keepAwake(on){try{if(window.RiffAndroid)window.RiffAndroid.keepScreenOn(on)}catch(_){}if(!navigator.wakeLock)return;if(on&&!wakeLock)navigator.wakeLock.request('screen').then(l=>{wakeLock=l}).catch(()=>{});else if(!on&&wakeLock){wakeLock.release().catch(()=>{});wakeLock=null}}
function audioCtx(){if(!ac)ac=new (window.AudioContext||window.webkitAudioContext)();if(ac.state==='suspended')ac.resume().catch(()=>{});return ac}
// Seamless loops: the decoded buffer plays through an AudioBufferSourceNode looping natively between loopStart/loopEnd.
// Falls back to the <audio> element (currentTime jump) only if the file could not be decoded.
// Remix bus shared by every voice: low-pass filter + gain + compressor (imitates game « vertical layering » without stems).
function fxBus(){const c=audioCtx();if(fx)return fx;const input=c.createGain(),filter=c.createBiquadFilter(),comp=c.createDynamicsCompressor(),out=c.createGain(),master=c.createGain();filter.type='lowpass';filter.frequency.value=20000;filter.Q.value=0.7;comp.threshold.value=0;comp.ratio.value=1;master.gain.value=volume;input.connect(filter).connect(comp).connect(out).connect(master).connect(c.destination);return fx={input,filter,comp,out,master}}
function setRemix(role,progress,delay=0,smooth=.08,base){const f=fxBus(),t=(base??ac.currentTime)+delay,r=role?E.remixFor(role,progress):{cutoff:20000,gain:1,drive:false};f.filter.frequency.setTargetAtTime(r.cutoff,t,smooth);f.out.gain.setTargetAtTime(r.gain*(r.drive?1.12:1),t,smooth);f.comp.threshold.setTargetAtTime(r.drive?-20:0,t,smooth);f.comp.ratio.setTargetAtTime(r.drive?4:1,t,smooth)}
// Game-style impact on effort entry, synthesized (no sample): pitch-dropping sub hit + short filtered noise burst.
function impact(delay,base){const c=audioCtx(),t=(base??c.currentTime)+delay,o=c.createOscillator(),g=c.createGain();o.frequency.setValueAtTime(95,t);o.frequency.exponentialRampToValueAtTime(30,t+.5);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.9,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+.6);o.connect(g).connect(fxBus().master);o.start(t);o.stop(t+.65);
 const n=c.createBuffer(1,Math.round(c.sampleRate*.25),c.sampleRate),d=n.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/d.length,3);const ns=c.createBufferSource(),bp=c.createBiquadFilter(),ng=c.createGain();ns.buffer=n;bp.type='bandpass';bp.frequency.value=1800;ng.gain.value=.35;ns.connect(bp).connect(ng).connect(fxBus().master);ns.start(t)}
// opts.delay: start on a future beat/bar (the old voice fades out at that moment); opts.fade: crossfade length.
// opts.base: one audio-clock reference shared by the impact, the remix and both voices so they land on the same sample.
function playMusic(loop,from,opts={}){const delay=opts.delay||0,fade=opts.fade||.015;stopMusic(true,delay,fade,opts.base);if(buffer){const c=audioCtx(),src=c.createBufferSource(),g=c.createGain(),l={start:loop.start,end:Math.min(loop.end,buffer.duration)},off=E.loopOffset(l.start,l.end,from),t=(opts.base??c.currentTime)+delay;src.buffer=buffer;src.loop=true;src.loopStart=l.start;src.loopEnd=l.end;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(1,t+fade);src.connect(g).connect(fxBus().input);src.start(t,off);voice={src,g,loop:l,startedAt:t,offset:off}}else{loopPreview={start:loop.start,end:loop.end};$('player').currentTime=E.loopOffset(loop.start,loop.end,from);$('player').play().catch(e=>say(e.message,'error'))}}
function loopPosition(){if(voice&&voice.outroAt!=null)return Math.min(buffer.duration,voice.outroFrom+ac.currentTime-voice.outroAt);return voice?E.loopOffset(voice.loop.start,voice.loop.end,voice.offset+Math.max(0,ac.currentTime-voice.startedAt)):null}
function stopMusic(keepPreview,delay=0,fade=.015,base){let pos=null;if(voice){pos=loopPosition();const v=voice,now=ac.currentTime,t=(base??now)+delay;voice=null;v.g.gain.cancelScheduledValues(now);v.g.gain.setValueAtTime(v.g.gain.value,now);v.g.gain.setValueAtTime(v.g.gain.value,t);v.g.gain.linearRampToValueAtTime(0,t+fade);v.src.stop(t+fade+.02)}else if(loopPreview){pos=$('player').currentTime;loopPreview=null;$('player').pause()}if(!keepPreview){setPreviewing(false);if(suggestionPreview){suggestionPreview=null;renderSuggestions()}}return pos}
function setPreviewing(on){previewing=on;$('preview-loop').textContent=on?'■ Arrêter':'▶ Tester la boucle'}
function nowPos(){return voice?loopPosition():$('player').currentTime}
// Library: several tracks picked anywhere (folders, Drive…) through the system picker; kept for the session, loops stay attached to each track.
let library=[],current=-1;
$('audio-file').addEventListener('change',e=>{const files=[...(e.target.files||[])];e.target.value='';if(!files.length)return;let first=-1;
 files.forEach(f=>{let k;try{k=RiffManualLoops.trackKey(f)}catch(_){return}let i=library.findIndex(x=>x.key===k);if(i<0){library.push({file:f,key:k});i=library.length-1}if(first<0)first=i});if(first<0)return;
 if(sessionBusy()){renderLibrary();say(files.length+(files.length>1?' morceaux ajoutés':' morceau ajouté')+'. Termine ou réinitialise la séance pour changer de morceau.','ok');return}loadTrack(first,false)});
function sessionBusy(){return ['rest','effort','pause','outro'].includes(workout.stage)}
async function loadTrack(i,autoplay){const f=library[i].file;current=i;
 stopMusic();if(objectUrl)URL.revokeObjectURL(objectUrl);
 objectUrl=URL.createObjectURL(f);track=RiffManualLoops.trackKey(f);$('player').src=objectUrl;duration=0;setEditing(null);buffer=null;mono=null;wavePeaks=null;analysis=null;$('auto-result').classList.add('hidden');
 $('track-info').classList.remove('hidden');$('track-name').textContent=f.name; say('Morceau chargé. Tes anciens repères manuels sont conservés.','ok');
 try{await new Promise((resolve,reject)=>{const el=$('player');el.onloadedmetadata=resolve;el.onerror=()=>reject(Error('Décodage audio impossible.'));el.load();}); duration=$('player').duration;if(!Number.isFinite(duration))throw Error('Durée du fichier audio inconnue.');$('loop-end').value=Math.min(10,duration).toFixed(2);$('play-duration').textContent=fmt(duration);drawWave();renderList();decodeTrack(f,track);renderLibrary();updateMini();if(autoplay)$('player').play().catch(()=>{})}catch(e){say(e.message,'error')}
}
async function decodeTrack(file,key){try{if(file.size>150*1024*1024)throw Error('trop gros');const b=await audioCtx().decodeAudioData(await file.arrayBuffer());if(track!==key)return;buffer=b;wavePeaks=E.peaks(b.getChannelData(0),160)}catch(_){if(track===key)say('Audio non décodable en mémoire : lecture des boucles en mode simple (petite coupure possible).','error')}drawWave()}
function monoData(){if(mono)return mono;const a=buffer.getChannelData(0);if(buffer.numberOfChannels<2)return mono=a;const b=buffer.getChannelData(1),m=new Float32Array(a.length);for(let i=0;i<a.length;i++)m[i]=(a[i]+b[i])/2;return mono=m}
function drawWave(){const c=$('wave'),ctx=c.getContext('2d'),W=c.width,H=c.height;ctx.clearRect(0,0,W,H);ctx.fillStyle='#ff6a00';
 if(wavePeaks)wavePeaks.forEach((v,n)=>{let h=Math.max(2,v*H*.87);ctx.fillRect(n*W/wavePeaks.length,(H-h)/2,2,h)});else for(let x=4;x<W;x+=7){let h=6+14*Math.sin(x*.09)**2;ctx.fillRect(x,(H-h)/2,3,h)}
 if(!(duration>0))return;const X=t=>Math.max(0,Math.min(W,t/duration*W)),s=Number($('loop-start').value),e=Number($('loop-end').value);
 const gr=loadGrid();if(gr&&gr.intensity)gr.intensity.forEach((v,i)=>{const t=gr.firstDownbeat+i*gr.bar;ctx.fillStyle='rgba(255,'+Math.round(190-160*v)+',40,'+(.25+.65*v).toFixed(2)+')';ctx.fillRect(X(t),H-7,Math.max(1,X(t+gr.bar)-X(t)-1),7)});
 if($('loop-start').value!==''&&$('loop-end').value!==''&&e>s){ctx.fillStyle='rgba(255,255,255,.12)';ctx.fillRect(X(s),0,X(e)-X(s),H)}
 ctx.font='bold 12px system-ui';[[$('loop-start').value,'#5fe39a','D'],[$('loop-end').value,'#ff5a4f','F']].forEach(([v,col,l])=>{if(v==='')return;const x=X(Number(v));ctx.fillStyle=col;ctx.fillRect(x-1.5,0,3,H);ctx.fillText(l,Math.min(W-11,x+4),13)});
 ctx.fillStyle='#fff';ctx.fillRect(X(nowPos())-1,0,2,H)}
$('wave').addEventListener('click',ev=>{if(!requireTrack()||!(duration>0))return;const r=ev.currentTarget.getBoundingClientRect();$('player').currentTime=Math.max(0,Math.min(duration,(ev.clientX-r.left)/r.width*duration));drawWave()});
$('player').addEventListener('timeupdate',()=>{if(!voice)$('play-now').textContent=fmt($('player').currentTime);drawWave();updateMini()});
['play','pause'].forEach(ev=>$('player').addEventListener(ev,()=>updateMini()));
$('player').addEventListener('ended',()=>{if(!loopPreview&&!sessionBusy()&&library.length>1)stepTrack(1)});
$('player').addEventListener('play',()=>{if(voice)stopMusic()});
$('mark-start').addEventListener('click',()=>{if(requireTrack()){$('loop-start').value=nowPos().toFixed(3);drawWave()}});
$('mark-end').addEventListener('click',()=>{if(requireTrack()){$('loop-end').value=nowPos().toFixed(3);drawWave()}});
['loop-start','loop-end'].forEach(id=>{$(id).addEventListener('input',drawWave);$(id).addEventListener('change',()=>{if(!previewing)return;try{const l=fields();RiffManualLoops.validateLoop(l,duration);playMusic(l,l.start)}catch(_){}})});
function setEditing(id){editingId=id;$('edit-state').textContent=id?'· modification':'· nouvelle'}
$('new-loop').addEventListener('click',()=>{setEditing(null);$('loop-name').value='Nouvelle boucle';say('Nouvelle boucle : l’enregistrement ne remplacera pas les précédentes.','ok')});
function fields(){return {id:editingId,name:$('loop-name').value,start:Number($('loop-start').value),end:Number($('loop-end').value),role:$('loop-role').value}}
$('save-loop').addEventListener('click',()=>{if(!requireTrack())return;try{let x=fields();if($('loop-start').value===''||$('loop-end').value==='')throw Error('Indique les points de début et de fin.');const item=database.save(track,x,duration);
 const prefs=Choice.read(localStorage,track),slot=item.role==='effort'?'effortA':item.role;
 // The first user-made loop becomes the selected phase only if no explicit selection existed.
 if(!prefs[slot]){prefs[slot]=item.id;try{Choice.write(localStorage,track,prefs)}catch(_){/* loop itself is already saved */}}
 setEditing(item.id);say('Boucle enregistrée ! Choisis son rôle dans l’onglet Séance. Aucune analyse ne peut la refuser.','ok');renderList()}catch(e){say('Enregistrement impossible : '+e.message,'error')}});
$('preview-loop').addEventListener('click',()=>{if(!requireTrack())return;if(previewing){stopMusic();return}if(workout.stage==='rest'||workout.stage==='effort'){say('Mets la séance en pause pour tester une boucle.','error');return}try{const l=fields();RiffManualLoops.validateLoop(l,duration);$('player').pause();setRemix(null);playMusic(l,l.start);setPreviewing(true);say(buffer?'Lecture en boucle sans coupure du raccord manuel.':'Lecture en boucle du raccord manuel (mode simple).','ok')}catch(e){say(e.message,'error')}});
// Optional: proposes cleaner seam points around the user's choice. Nothing is saved or forced.
$('refine-loop').addEventListener('click',()=>{if(!requireTrack())return;if(!buffer){say('Affinage indisponible : l’audio n’est pas décodé sur cet appareil. Tes points restent valables.','error');return}try{const l=fields();RiffManualLoops.validateLoop(l,duration);const r=E.refineLoop(monoData(),buffer.sampleRate,l.start,l.end),ms=(a,b)=>((b-a)*1000>=0?'+':'')+((b-a)*1000).toFixed(1)+' ms';$('loop-start').value=r.start;$('loop-end').value=r.end;drawWave();if(previewing)playMusic({start:r.start,end:r.end},r.start);say((r.matched?'Raccord affiné':'Début calé, fin gardée telle quelle')+' : début '+ms(l.start,r.start)+', fin '+ms(l.end,r.end)+'. Proposition non enregistrée : écoute, retouche à la main ou enregistre.','ok')}catch(e){say(e.message,'error')}});
function frame(){let p=$('player');if(!voice&&!p.paused&&loopPreview&&p.currentTime>=loopPreview.end-0.035)p.currentTime=loopPreview.start;if(voice){$('play-now').textContent=fmt(loopPosition());drawWave();updateMini()}moveNeedle();drawFlames();requestAnimationFrame(frame)}requestAnimationFrame(frame);
function renderList(){renderLibrary();renderSessionChoices();const el=$('loop-list');if(!track){el.textContent='Charge un morceau dans l’atelier pour voir ses boucles.';return}let loops;try{loops=database.list(track)}catch(e){say(e.message,'error');return}if(!loops.length){el.textContent='Aucune boucle pour ce morceau. Tes montages apparaîtront ici.';return}el.textContent='';loops.forEach(l=>{let div=document.createElement('div');div.className='segment';let info=document.createElement('div'),name=document.createElement('strong'),details=document.createElement('small');name.textContent=l.name;details.textContent={rest:'RÉCUPÉRATION',rise:'MONTÉE',effort:'EFFORT'}[l.role]+' · '+fmt(l.start)+' → '+fmt(l.end);info.append(name,document.createElement('br'),details);let btns=document.createElement('div');btns.className='row';const edit=document.createElement('button');edit.textContent='Éditer';edit.onclick=()=>{setEditing(l.id);$('loop-name').value=l.name;$('loop-start').value=l.start;$('loop-end').value=l.end;$('loop-role').value=l.role;activePage('edit');drawWave()};const del=document.createElement('button');del.textContent='×';del.setAttribute('aria-label','Supprimer '+l.name);del.onclick=()=>{if(confirm('Supprimer la boucle « '+l.name+' » ?')){try{database.remove(track,l.id);if(editingId===l.id)setEditing(null);renderList();say('Boucle supprimée.','ok')}catch(e){say(e.message,'error')}}};btns.append(edit,del);div.append(info,btns);el.append(div)})}
$('export-data').addEventListener('click',()=>{try{const blob=new Blob([database.exportJson()],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='RiffForge-boucles-manuelles.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),20000);say('Sauvegarde JSON prête.','ok')}catch(e){say(e.message,'error')}});
$('import-data').addEventListener('change',async(e)=>{const file=e.target.files?.[0];if(!file)return;try{database.importJson(await file.text());renderList();say('Repères restaurés sans effacer les autres morceaux.','ok')}catch(err){say(err.message,'error')}e.target.value=''});
function settings(){return {rest:Math.max(1,Number($('rest-seconds').value)||120),effort:Math.max(1,Number($('effort-seconds').value)||40),count:Math.max(1,Math.min(50,Number($('round-count').value)||4)),rise:Math.max(0,Number($('rise-seconds').value)||0)}}
// Tachometer (DA 2.3.1): ticks drawn once, needle eased toward the phase's reading every frame.
const G={cx:150,cy:150,r:118},SVGNS='http://www.w3.org/2000/svg';let rpm=0.9;
function gp(v,r){const a=(-135+27*v)*Math.PI/180;return [G.cx+r*Math.sin(a),G.cy-r*Math.cos(a)]}
function buildGauge(){const svg=$('gauge'),el=(n,a)=>{const e=document.createElementNS(SVGNS,n);Object.entries(a).forEach(([k,v])=>e.setAttribute(k,v));svg.append(e);return e};const arc=(v1,v2,r)=>{const [x1,y1]=gp(v1,r),[x2,y2]=gp(v2,r);return 'M'+x1+' '+y1+'A'+r+' '+r+' 0 '+(27*(v2-v1)>180?1:0)+' 1 '+x2+' '+y2};
 el('circle',{cx:G.cx,cy:G.cy,r:G.r+16,fill:'#140d0b',stroke:'#3a2820','stroke-width':2});el('path',{d:arc(0,10,G.r+8),stroke:'#2a1d18','stroke-width':10,fill:'none'});el('path',{d:arc(8,10,G.r+8),stroke:'#c8372d','stroke-width':10,fill:'none'});el('path',{id:'g-trail',d:arc(0,0.9,G.r-30),stroke:'#ff6a2b','stroke-width':4,fill:'none','stroke-linecap':'round',opacity:.85});
 for(let i=0;i<=40;i++){const v=i/4,major=i%4===0,[x1,y1]=gp(v,G.r-(major?16:8)),[x2,y2]=gp(v,G.r);el('line',{x1,y1,x2,y2,class:'g-tick'+(major?' major':'')+(v>=8?' hot':'')});if(major){const [x,y]=gp(v,G.r-30);el('text',{x,y,class:'g-num'+(v>=9?' hot':'')}).textContent=v}}
 el('path',{id:'needle',d:'M'+(G.cx-3)+' '+(G.cy-G.r+4)+'L'+(G.cx+3)+' '+(G.cy-G.r+4)+'L'+(G.cx+1.2)+' '+(G.cy-G.r+46)+'L'+(G.cx-1.2)+' '+(G.cy-G.r+46)+'Z',fill:'#ff6a2b'});
 G.arc=arc;moveNeedle(true)}
function moveNeedle(force){const target=E.rpmFor(workout.stage,workout.remaining,workout.rise||0)+(workout.stage==='effort'?Math.sin(performance.now()/90)*.12:0),next=rpm+(target-rpm)*.08;if(!force&&Math.abs(next-rpm)<.0005)return;rpm=next;$('needle').setAttribute('transform','rotate('+(-135+27*rpm)+' '+G.cx+' '+G.cy+')');$('g-trail').setAttribute('d',G.arc(0,Math.max(.01,rpm),G.r-30));$('rpm').textContent=String(Math.round(rpm*1000/10)*10).padStart(4,'0')}
function updateClock(){if(workout.stage==='idle')$('phase').textContent='PRÊT À DÉMARRER';else $('phase').textContent=workout.stage==='rest'?(workout.musicRole==='rise'?'RÉCUPÉRATION · MONTÉE':'RÉCUPÉRATION'):workout.stage==='effort'?'EFFORT':workout.stage==='done'?'SÉANCE TERMINÉE':workout.stage==='outro'?'SORTIE MUSICALE':'PAUSE';$('clock').textContent=fmtClock(workout.remaining);$('round').textContent='SÉRIE '+String(workout.round).padStart(2,'0')+' / '+String(workout.count).padStart(2,'0');
 const done=workout.stage==='done'||workout.stage==='outro'?workout.count:workout.round-1,left=workout.count-done;$('series-left').textContent=$('g-left').textContent=left;$('series-done').textContent=done+(done>1?' terminées':' terminée')+' sur '+workout.count;
 const bar=$('series-bar');if(bar.children.length!==workout.count){bar.textContent='';for(let i=0;i<workout.count;i++)bar.append(document.createElement('i'))}[...bar.children].forEach((b,i)=>b.className=i<done?'on':i===done&&workout.stage!=='idle'?'now':'');
 const role=workout.stage==='effort'?'effort':workout.stage==='rest'?(workout.musicRole==='rise'||(workout.rise>0&&workout.remaining<=workout.rise)?'rise':'rest'):null;['rest','rise','effort'].forEach(r=>$('dot-'+r).classList.toggle('on',r===role));
 $('g-sub').textContent={idle:'Place-toi, puis lance la séance.',rest:role==='rise'?'Ça monte. Prépare-toi à pousser.':'Récupère. Respire.',effort:'Déchaîne le riff !',pause:'En pause. La boucle reprendra au même endroit.',done:'Chaque série compte. Bravo.',outro:'Le morceau se termine tout seul. ↺ pour couper.'}[workout.stage]||''}
let gridFor=null,gridCache=null;
function loadGrid(){if(analysis)return analysis;if(gridFor!==track){gridFor=track;try{gridCache=JSON.parse(localStorage.getItem(GRID_KEY)||'{}')[track]||null}catch(_){gridCache=null}}return gridCache}
function renderSessionChoices(){
 const opts=$('choice-options'),empty=$('choice-empty');
 if(!track){opts.classList.add('hidden');empty.classList.remove('hidden');return}
 opts.classList.remove('hidden');empty.classList.add('hidden');
 let loops=[];try{loops=database.list(track)}catch(e){say('Lecture des boucles impossible : '+e.message,'error')}
 const prefs=Choice.read(localStorage,track);
 const slots=[['rest','rest','Première boucle de repos'],['rise','rise','Première boucle de montée'],
             ['effortA','effort','Première boucle d’effort'],['effortB','effort','Autre boucle d’effort']];
 slots.forEach(([slot,role,defaultText])=>{
   const select=$('choice-'+slot);
   select.textContent='';
   const first=document.createElement('option');first.value='';first.textContent=defaultText;select.append(first);
   loops.filter(l=>l.role===role).forEach(l=>{
     const o=document.createElement('option');o.value=l.id;
     o.textContent=l.name+' · '+fmt(l.start)+'–'+fmt(l.end);select.append(o);
   });
   select.value=prefs[slot]||'';
   if(select.selectedIndex<0)select.value='';
 });
 $('choice-useB').checked=prefs.useB;
 $('choice-b-wrap').classList.toggle('hidden',!prefs.useB);
}
function saveSessionChoices(){
 if(!track)return say('Charge un morceau avant de choisir ses boucles.','error');
 try{
   const p={rest:$('choice-rest').value,rise:$('choice-rise').value,
     effortA:$('choice-effortA').value,effortB:$('choice-effortB').value,
     useB:$('choice-useB').checked};
   Choice.write(localStorage,track,p);
   $('choice-b-wrap').classList.toggle('hidden',!p.useB);
   say('Réglages musicaux enregistrés pour ce morceau.','ok');
 }catch(e){say('Enregistrement des préférences impossible : '+e.message,'error')}
}
['rest','rise','effortA','effortB'].forEach(slot=>
  $('choice-'+slot).addEventListener('change',saveSessionChoices));
$('choice-useB').addEventListener('change',saveSessionChoices);
$('session-silent').addEventListener('change',()=>{
 try{localStorage.setItem(SILENT_KEY,String($('session-silent').checked));
   say($('session-silent').checked?'Mode Chrono seul activé pour la prochaine séance.':'Musique réactivée pour la prochaine séance.','ok');
 }catch(e){say('Réglage non enregistré : '+e.message,'error')}
});
function loadLoops(){
 if($('session-silent').checked || !track)return [];
 try{return Choice.choose(database.list(track),Choice.read(localStorage,track))}
 catch(e){say('Choix des boucles impossible : '+e.message,'error');return []}
}
// Called every tick: switches loop only when the wanted one changes (phase change or start of the « Montée »).
// On resume after a pause, the same loop continues from where it stopped instead of restarting.
// Transitions land on the music's grid like game « horizontal re-sequencing »: effort hits on the next beat with an impact,
// the Montée and A/B switches wait for the next bar, the return to rest crossfades over one beat.
function applyMusic(resume){const choice=E.pickLoop(workout.stage,workout.remaining,workout.rise,workout.loops,workout.variant),id=choice?choice.id:null;if(!resume&&id===workout.musicId)return;
 const prevRole=workout.musicRole,role=choice?choice.role:null,g=workout.grid,remix=$('remix-on').checked;workout.musicId=id;workout.musicRole=role;if(!choice){stopMusic();return}
 let delay=0,fade=.015;if(voice&&g&&!resume){const unit=role==='rise'||(role==='effort'&&prevRole==='effort')?g.bar:g.beat;delay=E.waitToGrid(loopPosition(),voice.loop,g.firstDownbeat,unit);fade=role==='rest'?g.beat:role==='rise'?g.beat/2:.03}
 const base=audioCtx().currentTime;if(remix){setRemix(role,role==='rise'?riseProgress():0,delay,role==='effort'?.02:.12,base);if(role==='effort'&&prevRole!=='effort'&&!resume)impact(delay,base)}else setRemix(null);
 playMusic(choice,resume&&id===workout.resumeId&&workout.resumePos!=null?workout.resumePos:choice.start,{delay,fade,base})}
function riseProgress(){return workout.rise>0?1-Math.max(0,workout.remaining)/workout.rise:0}
function abSwitch(){if(workout.stage!=='effort'||!voice||workout.musicRole!=='effort'||workout.loops.filter(l=>l.role==='effort').length<2)return;const len=voice.loop.end-voice.loop.start,min=Math.max(len,workout.grid?8*workout.grid.bar:16);if(ac.currentTime-voice.startedAt>=min-.6)workout.variant=(workout.variant||0)+1}
function tick(){if(workout.stage!=='rest'&&workout.stage!=='effort')return;let now=performance.now(),elapsed=Math.max(0,(now-workout.lastTick)/1000);workout.lastTick=now;workout.remaining=Math.max(0,workout.remaining-elapsed);if(workout.remaining<=0){let s=settings();if(workout.stage==='rest'){workout.stage='effort';workout.remaining=s.effort}else if(workout.round<workout.count){workout.round++;workout.stage='rest';workout.remaining=s.rest}else{clearInterval(workout.timer);workout.timer=null;finishSession()}}if(workout.stage==='rest'||workout.stage==='effort'){abSwitch();applyMusic(false);if(workout.musicRole==='rise'&&$('remix-on').checked&&voice&&ac.currentTime>=voice.startedAt)setRemix('rise',riseProgress())}updateClock()}
$('work-start').addEventListener('click',()=>{if(workout.timer)return;let s=settings();stopMusic();$('player').pause();if(track && !$('session-silent').checked)audioCtx();if(workout.stage==='idle'||workout.stage==='done'||workout.stage==='outro'){workout={timer:null,stage:'rest',round:1,remaining:s.rest,count:s.count,lastTick:0,loops:loadLoops(),rise:s.rise,musicId:null,variant:0,grid:loadGrid()};applyMusic(false)}else if(workout.stage==='pause'){workout.stage=workout.pausedStage||'rest';workout.loops=loadLoops();workout.rise=s.rise;workout.grid=loadGrid();applyMusic(true)}workout.lastTick=performance.now();workout.timer=setInterval(tick,100);keepAwake(true);updateClock()});
$('work-pause').addEventListener('click',()=>{if(workout.stage==='rest'||workout.stage==='effort'){workout.pausedStage=workout.stage;workout.stage='pause';clearInterval(workout.timer);workout.timer=null;workout.resumeId=workout.musicId;workout.resumePos=stopMusic();workout.musicId=null;updateClock()}});
$('work-reset').addEventListener('click',()=>{clearInterval(workout.timer);stopMusic();keepAwake(false);workout={timer:null,stage:'idle',round:1,remaining:settings().rest,count:settings().count,lastTick:0};updateClock()});
// The browser releases a Wake Lock when the page is hidden: take it again on return during a session.
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&workout.timer){wakeLock=null;keepAwake(true)}});
// Auto-Forge: on-demand analysis, ranked suggestions per role. Nothing is saved until the user taps « ＋ ».
const ROLE_FR={rest:'Repos',rise:'Montée',effort:'Effort'};
function sName(c,i){return 'Auto · '+ROLE_FR[c.role]+(c.role==='effort'?' '+'ABC'[i]:i?' '+(i+1):'')}
function refined(c){const r=E.refineLoop(monoData(),buffer.sampleRate,c.start,Math.min(c.end,duration));return {start:r.start,end:Math.min(r.end,duration)}}
$('auto-analyze').addEventListener('click',()=>{if(!requireTrack())return;if(!buffer){say('Analyse impossible : l’audio n’est pas encore décodé (ou trop lourd pour cet appareil).','error');return}const btn=$('auto-analyze'),key=track;btn.disabled=true;btn.textContent='⚙ Analyse en cours…';
 setTimeout(()=>{try{const r=AF.analyze(monoData(),buffer.sampleRate);if(track!==key)return;analysis={bpm:r.bpm,beat:r.beat,bar:r.bar,firstBeat:r.firstBeat,firstDownbeat:r.firstDownbeat,intensity:r.bars.map(b=>Math.round(b.intensity*100)/100),suggestions:r.suggestions};
  try{const all=JSON.parse(localStorage.getItem(GRID_KEY)||'{}'),{suggestions,...grid}=analysis;all[key]=grid;localStorage.setItem(GRID_KEY,JSON.stringify(all));gridFor=null}catch(_){}
  $('auto-result').classList.remove('hidden');renderSuggestions();drawWave();say('Analyse terminée : '+Math.round(r.bpm)+' BPM, '+r.bars.length+' mesures. Écoute les propositions et garde celles qui te plaisent.','ok')}catch(e){say('Analyse impossible : '+e.message,'error')}finally{btn.disabled=false;btn.textContent='⚙ Relancer l’analyse'}},30)});
function renderSuggestions(){const el=$('auto-list');if(!analysis||!analysis.suggestions)return;$('auto-bpm').textContent=Math.round(analysis.bpm)+' BPM · '+analysis.intensity.length+' MESURES';el.textContent='';
 ['rest','rise','effort'].forEach(role=>analysis.suggestions[role].forEach((c,i)=>{const best=i===0||(role==='effort'&&i===1),div=document.createElement('div');div.className='segment';const info=document.createElement('div'),name=document.createElement('strong'),det=document.createElement('small');name.textContent=sName(c,i)+(best?' ★':'');det.textContent=c.bars+' MESURES · '+fmt(c.start)+' → '+fmt(c.end)+' · INTENSITÉ '+Math.round(c.intensity*100)+' %';info.append(name,document.createElement('br'),det);
  const btns=document.createElement('div');btns.className='row';const key=role+i;const play=document.createElement('button');play.textContent=suggestionPreview===key?'■':'▶';play.setAttribute('aria-label','Écouter '+sName(c,i));
  play.onclick=()=>{if(suggestionPreview===key){stopMusic();return}if(workout.stage==='rest'||workout.stage==='effort'){say('Mets la séance en pause pour écouter une proposition.','error');return}$('player').pause();setPreviewing(false);const r=refined(c);setRemix($('remix-on').checked?role:null,role==='rise'?.5:0);playMusic({start:r.start,end:r.end},r.start);suggestionPreview=key;renderSuggestions()};
  const edit=document.createElement('button');edit.textContent='Éditer';edit.onclick=()=>{const r=refined(c);setEditing(null);$('loop-name').value=sName(c,i);$('loop-role').value=role;$('loop-start').value=r.start;$('loop-end').value=r.end;drawWave();$('loop-name').scrollIntoView({block:'center'});say('Proposition copiée dans « Ta boucle » : ajuste-la puis enregistre.','ok')};
  const add=document.createElement('button');add.textContent='＋';add.setAttribute('aria-label','Enregistrer '+sName(c,i));add.onclick=()=>saveSuggestions([[c,i]]);btns.append(play,edit,add);div.append(info,btns);el.append(div)}))}
function saveSuggestions(list){try{const existing=database.list(track);let n=0;list.forEach(([c,i])=>{const r=refined(c);if(existing.some(l=>l.role===c.role&&Math.abs(l.start-r.start)<.005&&Math.abs(l.end-r.end)<.005))return;database.save(track,{name:sName(c,i),start:r.start,end:r.end,role:c.role},duration);n++});renderList();say(n?n+(n>1?' boucles enregistrées':' boucle enregistrée')+'. Elles restent modifiables comme les tiennes.':'Déjà enregistré.','ok')}catch(e){say('Enregistrement impossible : '+e.message,'error')}}
$('auto-apply').addEventListener('click',()=>{if(!analysis||!analysis.suggestions)return;const s=analysis.suggestions,list=[];if(s.rest[0])list.push([s.rest[0],0]);if(s.rise[0])list.push([s.rise[0],0]);s.effort.slice(0,2).forEach((c,i)=>list.push([c,i]));saveSuggestions(list)});
// End of the last series: the loop is released and the track plays to its real end (or fades over 4 bars, or stops).
function finishSession(){const mode=$('outro-mode').value;say('Séance terminée ! Chaque série compte.','ok');if(!voice||!buffer||mode==='cut'){stopMusic();workout.stage='done';keepAwake(false);return}
 const v=voice,pos=loopPosition(),t=ac.currentTime;workout.stage='outro';setRemix(null,0,0,.4);
 if(mode==='fade'){const len=workout.grid?4*workout.grid.bar:8;v.g.gain.cancelScheduledValues(t);v.g.gain.setValueAtTime(v.g.gain.value,t);v.g.gain.linearRampToValueAtTime(0,t+len);v.src.stop(t+len+.05)}
 else{v.src.loop=false;v.outroFrom=pos;v.outroAt=t}
 v.src.onended=()=>{if(voice===v)voice=null;if(workout.stage==='outro'){workout.stage='done';keepAwake(false);updateClock();updateMini()}}}
// Mini player (all tabs): play/pause, previous/next in the library, seek, master volume.
let seeking=false;
function updateMini(){$('mini').classList.toggle('hidden',!track);if(!track)return;$('mp-title').textContent=$('track-name').textContent||'—';const p=$('player'),playing=!p.paused||!!voice,pos=nowPos()||0;$('mp-play').textContent=playing?'❚❚':'▶';$('mp-play').setAttribute('aria-label',playing?'Pause':'Lecture');$('mp-time').textContent=fmtClock(pos)+' / '+fmtClock(duration);if(!seeking)$('mp-seek').value=duration>0?Math.round(pos/duration*1000):0}
function stepTrack(d){if(!library.length)return;if(sessionBusy()){say('Termine ou réinitialise la séance pour changer de morceau.','error');return}if(d<0&&$('player').currentTime>3&&current>=0){$('player').currentTime=0;return}loadTrack(((current<0?0:current+d)%library.length+library.length)%library.length,true)}
$('mp-prev').addEventListener('click',()=>stepTrack(-1));$('mp-next').addEventListener('click',()=>stepTrack(1));
$('mp-play').addEventListener('click',()=>{if(!track)return;const p=$('player');if(voice||loopPreview){if(workout.stage==='rest'||workout.stage==='effort'){say('Mets la séance en pause pour écouter le morceau en entier.','error');return}stopMusic();updateMini();return}if(p.paused)p.play().catch(e=>say(e.message,'error'));else p.pause()});
$('mp-seek').addEventListener('input',()=>{seeking=true});$('mp-seek').addEventListener('change',()=>{seeking=false;if(duration>0&&!voice){$('player').currentTime=$('mp-seek').value/1000*duration;drawWave()}updateMini()});
function setVolume(v){volume=Math.max(0,Math.min(1,v));$('player').volume=volume;if(fx)fx.master.gain.setTargetAtTime(volume,ac.currentTime,.03);$('mp-vol-n').textContent=Math.round(volume*100)+' %';try{localStorage.setItem('riffforge.v2.volume',String(volume))}catch(_){}}
$('mp-vol').addEventListener('input',()=>setVolume($('mp-vol').value/100));$('mp-vol').value=Math.round(volume*100);setVolume(volume);
function renderLibrary(){const el=$('library');el.textContent='';library.forEach((x,i)=>{let n=0;try{n=database.list(x.key).length}catch(_){}const div=document.createElement('div');div.className='segment'+(i===current?' current':'');const info=document.createElement('div'),name=document.createElement('strong'),det=document.createElement('small');name.textContent=x.file.name.replace(/\.[^.]+$/,'');det.textContent=(i===current?'EN COURS · ':'')+n+(n>1?' BOUCLES':' BOUCLE');info.append(name,document.createElement('br'),det);info.style.cssText='flex:1;cursor:pointer;min-width:0;overflow-wrap:anywhere';
 info.onclick=()=>{if(i===current)return;if(sessionBusy()){say('Termine ou réinitialise la séance pour changer de morceau.','error');return}loadTrack(i,false)};const del=document.createElement('button');del.textContent='×';del.setAttribute('aria-label','Retirer '+x.file.name+' de la liste');del.onclick=()=>{library.splice(i,1);if(i<current)current--;else if(i===current)current=-1;renderLibrary()};div.append(info,del);el.append(div)})}
// Flames under the tachometer while the effort riff plays: additive particles from pre-rendered glow sprites (cheap on phones).
const flames=[],flameSprites=['255,226,140','255,124,32','205,44,18'].map(rgb=>{const s=document.createElement('canvas');s.width=s.height=64;const x=s.getContext('2d'),g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'rgba('+rgb+',1)');g.addColorStop(.45,'rgba('+rgb+',.45)');g.addColorStop(1,'rgba('+rgb+',0)');x.fillStyle=g;x.fillRect(0,0,64,64);return s});let flameLevel=0;
function drawFlames(){const c=$('flames'),ctx=c.getContext('2d'),W=c.width,H=c.height;flameLevel+=((workout.stage==='effort'?1:0)-flameLevel)*.04;if(flameLevel<.01&&!flames.length){if(c.dataset.lit){ctx.clearRect(0,0,W,H);delete c.dataset.lit}return}c.dataset.lit=1;
 for(let i=0,n=Math.round(flameLevel*6);i<n;i++){const u=Math.random()*2-1,x=W/2+u*W*.42,tall=1-Math.abs(u)*.55;flames.push({x,y:H+6,vx:(Math.random()-.5)*.5,vy:-(1.8+Math.random()*2.4)*tall*(.6+.5*flameLevel),r:14+Math.random()*16,life:0,max:(30+Math.random()*28)*tall,ph:Math.random()*6})}
 ctx.globalCompositeOperation='source-over';ctx.clearRect(0,0,W,H);ctx.globalCompositeOperation='lighter';
 for(let i=flames.length-1;i>=0;i--){const p=flames[i],k=++p.life/p.max;if(k>=1){flames.splice(i,1);continue}p.x+=p.vx+Math.sin(p.life*.18+p.ph)*.5;p.y+=p.vy;const r=p.r*(1-k*.65);ctx.globalAlpha=Math.min(1,(1-k)*1.4)*.8;ctx.drawImage(flameSprites[k<.28?0:k<.6?1:2],p.x-r,p.y-r,2*r,2*r)}ctx.globalAlpha=1}
try{$('session-silent').checked=localStorage.getItem(SILENT_KEY)==='true'}catch(_){}
renderSessionChoices();
buildGauge();updateClock();drawWave();
})();
