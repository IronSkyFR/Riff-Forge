/* Riff Forge 2.4 Lab | local manual loop persistence. No external dependencies. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RiffManualLoops = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var KEY = 'riffforge.v2.manualLoops';
  var SCHEMA = 1;
  function fail(message) { throw new Error(message); }
  function finite(x) { return typeof x === 'number' && Number.isFinite(x); }
  function saneText(s, limit) { return String(s || '').trim().slice(0, limit); }
  function validateLoop(loop, duration) {
    if (!loop || !finite(loop.start) || !finite(loop.end)) fail('Points de boucle invalides.');
    if (loop.start < 0 || loop.end <= loop.start) fail('Le point de fin doit suivre le point de début.');
    if (duration !== undefined && duration !== null) {
      if (!finite(duration) || duration <= 0) fail('Durée du morceau invalide.');
      if (loop.end > duration + 0.01) fail('La boucle dépasse la durée du morceau.');
    }
    return true;
  }
  function trackKey(file) {
    if (!file || !file.name || !finite(file.size)) fail('Fichier audio invalide.');
    return [String(file.name).normalize('NFC'), file.size, Number(file.lastModified) || 0].join('::');
  }
  function makeStore(storage, clock) {
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') fail('Stockage indisponible.');
    clock = clock || function () { return Date.now(); };
    function read() {
      var raw = storage.getItem(KEY);
      if (!raw) return { schema: SCHEMA, tracks: {} };
      var data;
      try { data = JSON.parse(raw); } catch (_) { return fail('Sauvegarde illisible. Aucune donnée écrasée.'); }
      if (!data || data.schema !== SCHEMA || !data.tracks || Array.isArray(data.tracks) || typeof data.tracks !== 'object') {
        return fail('Format de sauvegarde inconnu. Aucune donnée écrasée.');
      }
      return data;
    }
    function write(data) {
      // localStorage.setItem is atomic; propagate QuotaExceededError to caller, never fake success.
      storage.setItem(KEY, JSON.stringify(data));
    }
    function list(key) {
      if (!key) fail('Morceau manquant.');
      var data = read();
      var entry = data.tracks[key];
      return entry && Array.isArray(entry.loops) ? entry.loops.map(function (x) { return Object.assign({}, x); }) : [];
    }
    function save(key, loop, duration) {
      if (!key) fail('Morceau manquant.');
      validateLoop(loop, duration);
      var data = read();
      var entry = data.tracks[key] || { loops: [] };
      if (!Array.isArray(entry.loops)) fail('Sauvegarde du morceau illisible.');
      var existingId = saneText(loop.id, 100);
      var idx = existingId ? entry.loops.findIndex(function (x) { return x.id === existingId; }) : -1;
      var id = idx >= 0 ? existingId : 'manual-' + String(clock()) + '-' + Math.random().toString(36).slice(2, 10);
      var now = clock();
      var item = {
        id: id,
        name: saneText(loop.name, 100) || 'Boucle manuelle',
        start: loop.start,
        end: loop.end,
        source: 'manual',
        role: ['rest', 'rise', 'effort'].includes(loop.role) ? loop.role : 'effort',
        createdAt: idx >= 0 ? entry.loops[idx].createdAt : now,
        updatedAt: now
      };
      if (idx >= 0) entry.loops[idx] = item;
      else entry.loops.push(item);
      data.tracks[key] = entry;
      write(data);
      return Object.assign({}, item);
    }
    function remove(key, id) {
      var data = read();
      if (!data.tracks[key]) return false;
      var old = data.tracks[key].loops;
      var newer = old.filter(function (x) { return x.id !== id; });
      if (newer.length === old.length) return false;
      data.tracks[key].loops = newer;
      write(data);
      return true;
    }
    function exportJson() { return JSON.stringify(read(), null, 2); }
    function importJson(json) {
      var parsed;
      try { parsed = JSON.parse(json); } catch (_) { return fail('JSON invalide.'); }
      if (!parsed || parsed.schema !== SCHEMA || !parsed.tracks || typeof parsed.tracks !== 'object' || Array.isArray(parsed.tracks)) fail('Schéma de sauvegarde incompatible.');
      var merged = read();
      Object.keys(parsed.tracks).forEach(function (k) {
        var loops = parsed.tracks[k] && parsed.tracks[k].loops;
        if (!Array.isArray(loops)) fail('Liste de boucles incorrecte.');
        loops.forEach(function (l) { validateLoop(l); });
      });
      Object.keys(parsed.tracks).forEach(function (k) {
        var target = merged.tracks[k] || { loops: [] };
        parsed.tracks[k].loops.forEach(function (l) {
          var idx = target.loops.findIndex(function (e) { return e.id === l.id; });
          var safe = { id: saneText(l.id, 100) || 'import-' + Math.random().toString(36).slice(2), name: saneText(l.name, 100), start: l.start, end: l.end, source: 'manual', role: ['rest', 'rise', 'effort'].includes(l.role) ? l.role : 'effort', createdAt: l.createdAt || clock(), updatedAt: clock() };
          if (idx < 0) target.loops.push(safe); else target.loops[idx] = safe;
        });
        merged.tracks[k] = target;
      });
      write(merged);
    }
    return { list: list, save: save, remove: remove, exportJson: exportJson, importJson: importJson };
  }
  return { makeStore: makeStore, validateLoop: validateLoop, trackKey: trackKey, KEY: KEY };
});
