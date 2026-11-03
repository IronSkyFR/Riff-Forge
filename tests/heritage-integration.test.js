const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const base=path.join(__dirname,'..');
const read=p=>fs.readFileSync(path.join(base,p),'utf8');
const html=read('app/src/main/assets/index.html');
const app=read('app/src/main/assets/app.js');
const activity=read('app/src/main/java/fr/ironsky/riffforge/lab/MainActivity.java');
const manifest=read('app/src/main/AndroidManifest.xml');
const build=read('app/build.gradle');
test('Héritage: module de préférence chargé avant le contrôleur',()=>{
  assert.ok(html.indexOf('src="session-choice.js"')>=0);
  assert.ok(html.indexOf('src="session-choice.js"')<html.indexOf('src="app.js"'));
});
test('Héritage: commandes manuelles branchées sur les boucles de la séance',()=>{
  assert.match(app,/Choice\.choose\(database\.list\(track\),Choice\.read\(localStorage,track\)\)/);
  assert.match(app,/renderSessionChoices\(\)/);
  for(const id of ['choice-rest','choice-rise','choice-effortA','choice-effortB','choice-useB','session-silent'])
    assert.ok(html.includes('id="'+id+'"'),'Element missing: '+id);
});
test('Héritage: B et remix désactivés par défaut',()=>{
 const flags=['choice-useB','remix-on'];
 for(const id of flags){
   const tag=html.match(new RegExp('<input[^>]*id="'+id+'"[^>]*>'));
   assert.ok(tag);
   assert.doesNotMatch(tag[0],/\bchecked\b/);
 }
});
test('Héritage: chrono seul et lecture normale mutuellement exclusifs',()=>{
 assert.match(app,/\$\('session-silent'\)\.checked\s*\|\|\s*!track/);
 assert.match(app,/\$\('player'\)\.pause\(\);if\(track/);
});
test('Héritage: nouvelle APK séparée de la 2.3.1 et de la Lab de Claude',()=>{
 assert.match(build,/applicationId 'fr\.ironsky\.riffforge\.heritage'/);
 assert.match(build,/versionName '2\.4\.2-heritage'/);
 assert.match(manifest,/android:name="fr\.ironsky\.riffforge\.lab\.MainActivity"/);
});
test('Héritage: navigation système Android prise en compte, pas de réseau',()=>{
 assert.match(activity,/WindowInsets\.Type\.systemBars\(\)/);
 assert.match(activity,/WindowInsets\.Type\.ime\(\)/);
 assert.doesNotMatch(manifest,/android\.permission\.INTERNET/);
});
