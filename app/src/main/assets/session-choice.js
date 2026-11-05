/* Riff Forge 2.4.2 Heritage Lab — manually selected loops, cycle B OFF unless requested.
 * Pure selection logic. Does NOT replace the existing audio engine or its transitions.
 */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.RiffSessionChoice=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  var KEY='riffforge.v2.heritage.sessionChoices';
  function defaults(){return {rest:'',rise:'',effortA:'',effortB:'',useB:false};}
  function sanitize(c){
    var d=defaults();c=c&&typeof c==='object'?c:{};
    ['rest','rise','effortA','effortB'].forEach(function(k){if(typeof c[k]==='string')d[k]=c[k].slice(0,150)});
    d.useB=c.useB===true;
    return d;
  }
  function choose(loops,prefs){
    var a=Array.isArray(loops)?loops:[],p=sanitize(prefs),chosen=[];
    function byRole(role,id,excluded){
      var options=a.filter(function(x){return x&&x.role===role&&x.end>x.start&&(!excluded||x.id!==excluded);});
      return options.find(function(x){return x.id===id})||options[0]||null;
    }
    var rest=byRole('rest',p.rest),rise=byRole('rise',p.rise),A=byRole('effort',p.effortA);
    if(rest)chosen.push(rest);
    if(rise)chosen.push(rise);
    if(A)chosen.push(A);
    if(p.useB&&A){var B=byRole('effort',p.effortB,A.id);if(B)chosen.push(B);}
    return chosen;
  }
  function read(storage,track){
    if(!track)return defaults();
    try {
      var all=JSON.parse(storage.getItem(KEY)||'{}');
      return sanitize(all&&Object.prototype.hasOwnProperty.call(all,track)?all[track]:null);
    }catch(_){return defaults();}
  }
  function write(storage,track,prefs){
    if(!track)throw new Error('Charge un morceau avant de sélectionner ses boucles.');
    var all;
    try {all=JSON.parse(storage.getItem(KEY)||'{}');} catch(_){all={};}
    if(!all||typeof all!=='object'||Array.isArray(all))all={};
    all[track]=sanitize(prefs);
    storage.setItem(KEY,JSON.stringify(all)); // quota errors propagate
    return all[track];
  }
  return {KEY:KEY,defaults:defaults,sanitize:sanitize,choose:choose,read:read,write:write};
});