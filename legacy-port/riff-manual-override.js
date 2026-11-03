/* Riff Forge — 2.3.1 heritage patch.
 * Standalone manual-loop persistence. NO music engine, automatic scoring or audio transitions.
 * Does not touch the original application's storage keys.
 * Usage: const m = RiffLegacyManual.create(localStorage);
 * m.save(trackStableId, {name:'Riff', start:1.25, end:15.75, role:'effort'}, duration);
 * m.resolve(trackStableId, existingAutomaticLoop, {mode:'manual', id:'manual-...'});
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RiffLegacyManual = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var SCHEMA = 1;
  var KEY = 'riff-forge.heritage.manual.v1';
  var ROLES = ['rest', 'rise', 'effort'];
  var own = function (o, k) { return Object.prototype.hasOwnProperty.call(o, k); };
  var counter = 0;
  function error(message) { throw new Error(message); }
  function clean(value, limit) { return String(value == null ? '' : value).trim().slice(0, limit); }
  function finite(x) { return typeof x === 'number' && Number.isFinite(x); }
  function validTrack(trackId) {
    var id = clean(trackId, 512);
    if (!id || ['__proto__', 'prototype', 'constructor'].includes(id)) error('Identifiant de morceau invalide.');
    return id;
  }
  function validate(loop, duration) {
    if (!loop || !finite(loop.start) || !finite(loop.end)) error('Repères numériques requis.');
    if (loop.start < 0 || loop.end <= loop.start) error('Le début doit précéder la fin dans le morceau.');
    if (duration !== undefined && duration !== null &&
        (!finite(duration) || duration <= 0 || loop.end > duration + 0.001))
      error('Repères hors de la durée audio.');
    return true; // musical suitability is deliberately NEVER inspected
  }
  function empty() { return {schema: SCHEMA, tracks: {}}; }
  function checkModel(data) {
    if (!data || data.schema !== SCHEMA || !data.tracks ||
        typeof data.tracks !== 'object' || Array.isArray(data.tracks)) error('Format de sauvegarde incompatible.');
    Object.keys(data.tracks).forEach(function (track) {
      validTrack(track);
      var t = data.tracks[track];
      if (!t || !Array.isArray(t.loops)) error('Données de morceau invalides.');
      t.loops.forEach(function (l) {
        validate(l);
        if (!clean(l.id, 128)) error('Identifiant de boucle absent.');
        if (!ROLES.includes(l.role)) error('Rôle de boucle invalide.');
      });
    });
    return data;
  }
  function create(storage, opts) {
    opts = opts || {};
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function')
      error('Stockage local absent.');
    var key = clean(opts.storageKey, 160) || KEY;
    var clock = typeof opts.now === 'function' ? opts.now : Date.now;
    function read() {
      var raw = storage.getItem(key);
      if (!raw) return empty();
      var obj;
      try { obj = JSON.parse(raw); } catch (_) { error('Sauvegarde corrompue : aucune donnée modifiée.'); }
      return checkModel(obj);
    }
    function write(model) { storage.setItem(key, JSON.stringify(model)); } // quota failures propagate
    function newId(used) {
      var id;
      do { counter++; id = 'manual-' + String(clock()) + '-' + String(counter); }
      while (used.some(function (x) { return x.id === id; }));
      return id;
    }
    function list(trackId) {
      var id = validTrack(trackId), model = read();
      return own(model.tracks, id) ? model.tracks[id].loops.map(function (x) { return Object.assign({}, x); }) : [];
    }
    function save(trackId, loop, duration) {
      var id = validTrack(trackId);
      validate(loop, duration);
      var data = read();
      var entry = own(data.tracks, id) ? data.tracks[id] : {loops: []};
      var editId = clean(loop.id, 128);
      var index = editId ? entry.loops.findIndex(function (l) { return l.id === editId; }) : -1;
      if (editId && index < 0) error('La boucle à modifier est introuvable. Utilise « Nouvelle ».');
      var stamp = clock();
      var item = {
        id: index < 0 ? newId(entry.loops) : editId,
        name: clean(loop.name, 100) || 'Ma boucle',
        role: ROLES.includes(loop.role) ? loop.role : 'effort',
        start: loop.start, end: loop.end,
        source: 'manual', createdAt: index < 0 ? stamp : entry.loops[index].createdAt,
        updatedAt: stamp
      };
      if (index < 0) entry.loops.push(item); else entry.loops[index] = item;
      data.tracks[id] = entry;
      write(data);
      return Object.assign({}, item);
    }
    function remove(trackId, id) {
      var track = validTrack(trackId), data = read();
      if (!own(data.tracks, track)) return false;
      var before = data.tracks[track].loops.length;
      data.tracks[track].loops = data.tracks[track].loops.filter(function (x) { return x.id !== id; });
      if (before === data.tracks[track].loops.length) return false;
      write(data);
      return true;
    }
    function exportBackup() { return JSON.stringify(read(), null, 2); }
    function importBackup(source) {
      var incoming;
      try { incoming = JSON.parse(source); } catch (_) { error('Archive JSON illisible.'); }
      checkModel(incoming); // all validation completed BEFORE any persistent write
      var data = read(), added = 0;
      Object.keys(incoming.tracks).forEach(function (id) {
        var existing = own(data.tracks, id) ? data.tracks[id] : {loops: []};
        incoming.tracks[id].loops.forEach(function (l) {
          var copy = Object.assign({}, l), same = existing.loops.find(function (x) { return x.id === copy.id; });
          if (same && same.start === copy.start && same.end === copy.end &&
              same.name === copy.name && same.role === copy.role) return; // idempotent
          if (same) copy.id = newId(existing.loops); // never destroy a conflicting local edit
          existing.loops.push(copy);
          added++;
        });
        data.tracks[id] = existing;
      });
      write(data);
      return added;
    }
    // The old algorithm stays untouched unless the caller EXPLICITLY opts into manual mode.
    function resolve(trackId, automaticChoice, selection) {
      if (!selection || selection.mode !== 'manual') return automaticChoice;
      var manual = list(trackId).find(function (l) { return l.id === selection.id; });
      return manual || null; // never silently substitute an automatic loop when manual selected
    }
    return {list: list, save: save, remove: remove, exportBackup: exportBackup,
      importBackup: importBackup, resolve: resolve, storageKey: key};
  }
  return {create: create, validate: validate, KEY: KEY, SCHEMA: SCHEMA};
});
