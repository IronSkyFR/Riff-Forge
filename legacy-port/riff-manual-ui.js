/* Optional UI adapter for Riff Forge 2.3.1: a self-contained manual-loop editor.
 * This file does not start, stop, replace or patch the legacy music engine.
 * Wire callbacks to the EXISTING 2.3.1 player and loop selector:
 *
 * RiffLegacyManualUI.mount(document.getElementById('legacy-loop-panel'), {
 *   layer: RiffLegacyManual.create(localStorage),
 *   trackId: () => legacyPlayer.trackId,
 *   duration: () => legacyPlayer.duration,
 *   position: () => legacyPlayer.currentTime,
 *   preview: (loop) => legacyPlayer.previewLoop(loop.start, loop.end),
 *   onUse: (loop) => legacyPlayer.selectManualLoop(loop), // manual mode only
 * });
 *
 * Do not mount until the original 2.3.1 source integration points are identified.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RiffLegacyManualUI = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function mount(host, opts) {
    if (!host || !opts || !opts.layer || typeof opts.trackId !== 'function' ||
        typeof opts.duration !== 'function') throw new Error('Adaptateur UI incomplet.');
    var editingId = null, nodes = {}, destroyed = false;
    function add(tag, text, parent) {
      var e = document.createElement(tag);
      if (text !== undefined && text !== null) e.textContent = text;
      (parent || host).appendChild(e);
      return e;
    }
    function line(label, type, value, step) {
      var wrapper=add('label',null,host),title=add('span',label,wrapper),input=add('input',null,wrapper);
      wrapper.style.cssText='display:flex;flex-direction:column;gap:4px;margin:9px 0;color:#e4c5b0';
      input.type=type; if(step) input.step=step;
      if (value !== undefined) input.value=value;
      input.style.cssText='width:100%;min-height:42px;padding:8px;background:#160f0b;color:#fff;border:1px solid #aa6642;border-radius:4px;box-sizing:border-box';
      return input;
    }
    host.textContent='';
    host.style.cssText='background:#1c120e;padding:16px;border:1px solid #82472a;color:#fff;border-radius:6px';
    add('h3','Mes boucles manuelles',host).style.margin='0 0 8px';
    add('p','Tes points restent prioritaires. Aucun détecteur musical ne peut refuser un enregistrement.',host)
      .style.cssText='font-size:13px;color:#d8bca6';
    nodes.name=line('Nom','text','Ma boucle');
    nodes.role=add('select',null,host);
    [['rest','Récupération'],['rise','Montée'],['effort','Effort']].forEach(function (pair) {
      var o=add('option',pair[1],nodes.role);o.value=pair[0];
    });
    nodes.role.value='effort';
    nodes.role.style.cssText='display:block;width:100%;min-height:42px;background:#160f0b;color:#fff;border:1px solid #aa6642;margin:10px 0';
    nodes.start=line('Début en secondes','number','0','0.001');
    nodes.end=line('Fin en secondes','number','10','0.001');
    nodes.start.min='0'; nodes.end.min='0';
    var actions=add('div',null,host);
    actions.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin:12px 0';
    function button(label,fn) {
      var b=add('button',label,actions);
      b.type='button';
      b.style.cssText='flex:1 1 110px;min-height:43px;background:#cf6a38;color:#180b07;border:0;border-radius:4px;font-weight:bold';
      b.addEventListener('click',fn);return b;
    }
    nodes.message=add('p','',host);nodes.message.setAttribute('role','status');
    nodes.message.style.cssText='min-height:1em;color:#ffca95;font-size:13px';
    nodes.list=add('div',null,host);
    function message(s) { nodes.message.textContent=String(s); }
    function context() {
      var track=opts.trackId(), duration=opts.duration();
      if (!track || !Number.isFinite(duration) || duration<=0) throw new Error('Charge un morceau avant de modifier ses boucles.');
      return {track:track,duration:duration};
    }
    function fields() {
      if (nodes.start.value.trim()==='' || nodes.end.value.trim()==='') throw new Error('Renseigne les deux points.');
      return {id:editingId,name:nodes.name.value,role:nodes.role.value,
        start:Number(nodes.start.value),end:Number(nodes.end.value)};
    }
    function newLoop() {
      editingId=null;nodes.name.value='Ma boucle';nodes.role.value='effort';
      message('Nouvelle boucle : les autres ne seront pas modifiées.');
    }
    button('＋ Nouvelle',newLoop);
    button('Début = lecture',function(){
      if(typeof opts.position !== 'function')return message('Position de lecture indisponible.');
      nodes.start.value=Number(opts.position()).toFixed(3);
    });
    button('Fin = lecture',function(){
      if(typeof opts.position !== 'function')return message('Position de lecture indisponible.');
      nodes.end.value=Number(opts.position()).toFixed(3);
    });
    button('▶ Écouter',function(){
      try {var x=context(),l=fields();RiffLegacyManual.validate(l,x.duration);
        if(typeof opts.preview==='function')opts.preview(l);
        else message('Branche la préécoute au moteur musical historique.');
      } catch(e){message(e.message);}
    });
    button('✓ Enregistrer',function(){
      try {var x=context(),l=opts.layer.save(x.track,fields(),x.duration);
        editingId=l.id;message('Boucle conservée, sans validation musicale.');refresh();
      } catch(e){message('Enregistrement impossible : '+e.message);}
    });
    function refresh() {
      if(destroyed)return;nodes.list.textContent='';
      var track,loops;try {track=context().track;loops=opts.layer.list(track);}
      catch(e){message(e.message);return;}
      if(!loops.length){add('p','Aucune boucle manuelle pour ce morceau.',nodes.list);return;}
      loops.forEach(function(l){
        var div=add('div',null,nodes.list);
        div.style.cssText='border-top:1px solid #65402c;padding:10px 0';
        add('strong',l.name+' · '+l.start.toFixed(3)+' — '+l.end.toFixed(3)+' s',div);
        var row=add('div',null,div);row.style.cssText='display:flex;gap:6px;flex-wrap:wrap;margin-top:6px';
        function action(label,cb) {
          var b=add('button',label,row);b.type='button';
          b.style.cssText='padding:8px;background:#39251b;color:#fff;border:1px solid #aa6642;border-radius:3px;flex:1';
          b.addEventListener('click',cb);
        }
        action('Modifier',function(){
          editingId=l.id;nodes.name.value=l.name;nodes.role.value=l.role;
          nodes.start.value=l.start;nodes.end.value=l.end;message('Modification de '+l.name);
        });
        action('Utiliser',function(){
          if(typeof opts.onUse==='function') {opts.onUse(l);message('Boucle manuelle choisie pour le moteur historique.');}
          else message('Branche « Utiliser » au sélecteur musical historique.');
        });
        action('Supprimer',function(){
          if(!confirm('Supprimer '+l.name+' ?'))return;
          try{opts.layer.remove(track,l.id);if(editingId===l.id)editingId=null;refresh();}
          catch(e){message(e.message);}
        });
      });
    }
    refresh();
    return {refresh:refresh,destroy:function(){destroyed=true;host.textContent='';}};
  }
  return {mount:mount};
});
