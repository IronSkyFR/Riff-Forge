# Riff Forge historique 2.3.1 — Correctifs ciblés (code prêt à porter)

Ce dossier prépare **deux correctifs**, sans remplacement du moteur musical historique :
1. accepter et conserver des **boucles manuelles** sans veto de l'algorithme ;
2. placer les commandes Android au-dessus de la navigation système, y compris avec le clavier.

## Fichiers réalisés
- \`riff-manual-override.js\` : stockage JSON isolé, édition/création/suppression, export/import sécurisé et résolution explicite en mode manuel.
- \`riff-manual-ui.js\` : petit éditeur facultatif en français, avec pose des repères depuis la lecture et boutons « Nouvelle », « Écouter », « Enregistrer », « Utiliser ».
- \`android/LegacyInsets.java\` : helper Android autonome pour respecter les marges système et IME.
- \`../tests/legacy-manual-override.test.js\` : tests de non-régression (lancement par GitHub Actions).

## Garantie essentielle : moteur 2.3.1 intact

Par défaut, \`layer.resolve(trackId, originalAutomaticLoop)\` retourne **exactement le même objet** que \`originalAutomaticLoop\`. La création/sauvegarde de boucles ne change donc pas ce que joue le moteur automatique.

Une boucle manuelle ne devient active que lorsque l'utilisateur fait ce choix :

\`\`\`js
const manual = RiffLegacyManual.create(window.localStorage);
const saved = manual.save(stableTrackId, {
  name: 'Mon riff parfait', role: 'effort', start: 33.123, end: 46.781
}, playerDuration);

// Mode automatique (aucune altération)
const auto = manual.resolve(stableTrackId, originalAutomaticLoop);

// Mode manuel explicite
const selection = {mode: 'manual', id: saved.id};
const chosen = manual.resolve(stableTrackId, originalAutomaticLoop, selection);
\`\`\`

\`chosen\` est une structure de repères, **pas un lecteur audio**. Il faut l'injecter dans la fonction déjà utilisée par la 2.3.1 pour jouer une boucle. Ne pas remplacer cette fonction, sa planification, ses fondus, ses phases, ni son cycle A/B.

Si une sélection manuelle n'existe plus, \`resolve\` retourne \`null\` plutôt que substituer silencieusement une proposition automatique. Le sélecteur de mode de la 2.3.1 doit afficher une erreur compréhensible et revenir à « Auto » sur action explicite.

## Éditeur à raccorder

Dans l'HTML de la 2.3.1, ajouter un emplacement à proximité des repères historiques :

\`\`\`html
<section id="riff-manual-panel"></section>
<script src="riff-manual-override.js"></script>
<script src="riff-manual-ui.js"></script>
\`\`\`

Dans le contrôleur UI d'origine, après l'initialisation du lecteur :

\`\`\`js
const layer = RiffLegacyManual.create(localStorage);
RiffLegacyManualUI.mount(document.getElementById('riff-manual-panel'), {
  layer,
  trackId: () => originalTrackId,       // doit être stable entre sessions
  duration: () => originalAudioDuration,
  position: () => originalPlayerTime,
  preview: (loop) => originalPreviewLoop(loop.start, loop.end),
  onUse: (loop) => originalSelectManualLoop(loop)
});
\`\`\`

Les noms \`originalTrackId\`, \`originalPreviewLoop\`, etc. sont **des adaptateurs à remplacer par les fonctions réelles** une fois les sources 2.3.1 récupérées. Ce code d'intégration n'est pas exécutable tel quel sur l'application originale sans l'adapter.

Pour ne pas mélanger les anciennes sauvegardes, le module utilise la nouvelle clé \`riff-forge.heritage.manual.v1\`. Il n'écrase pas la base d'anciennes boucles. Il faut conserver leur import/export existant et envisager une migration explicite après avoir lu son format réel. L'export manuel produit un JSON ne contenant **pas les fichiers audio**.

## Correctif Android

Importer la classe \`LegacyInsets\` dans le projet Android historique (adapter son package si nécessaire) et appeler :

\`\`\`java
setContentView(root);
LegacyInsets.attach(this, root);
\`\`\`

- \`root\` est le conteneur de la WebView et des commandes.
- Sur API 30+, utilise \`systemBars\`, \`displayCutout\` et \`ime\`.
- Sur anciennes API, respecte les inset getters legacy.
- **Attention** : éviter de compter deux fois l'inset bas si l'ancien CSS inclut déjà \`env(safe-area-inset-bottom)\`.
- Tester en navigation 3 boutons et gestes, avec clavier ouvert, barres affichées et masquées, lecteur bas et paysage si pris en charge.

## Validation avant APK installable

1. Récupérer les **sources 2.3.1** exactes et identifier les hooks du moteur/audio, sa BDD et l'Activity.
2. Exporter les données utilisateur de la 2.3.1, conserver une copie de l'APK et vérifier la signature/ID avant tout remplacement.
3. Porter les deux correctifs seulement et exécuter la suite de tests historique complète.
4. Compiler avec **le même applicationId et certificat** si l'APK doit être une mise à jour.
5. Test réel sur OPPO : import, sélecteur A/B historique, lecture/repos/montée/effort, écoute/sauvegarde de boucles, fermeture/reprise, export/restauration, navigation 3 boutons et gestes.

**État actuel :** les fichiers de ce dossier sont préparés et testés en isolation. **Ils ne sont pas encore intégrés à la 2.3.1** ; ses sources ne figurent pas dans ce dépôt GitHub. Les exécutions GitHub Actions sur cette branche compilent encore l'APK **Lab séparée**, pas l'ancienne application.
