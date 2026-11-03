# Riff Forge 2.4 Lab — prototype Android, indépendant de la 2.3.1

## Nouveautés 2.4.1 Lab

- **Boucles sans coupure** : lecture Web Audio (`AudioBufferSourceNode`, `loopStart`/`loopEnd`) au lieu du saut de `currentTime` ; continue même si l'onglet n'est plus affiché. Repli automatique sur l'ancien mode si le fichier ne peut pas être décodé (plus de 150 Mo ou format non géré).
- **« ✨ Affiner » facultatif** : propose un début calé sur un passage à zéro et une fin, à ±40 ms de la tienne, dont l'onde se raccorde au mieux avec le début. Rien n'est appliqué automatiquement ni enregistré sans toi ; aucune boucle n'est jamais refusée pour raison musicale.
- **Montée** : la boucle « Montée » remplace la récupération sur ses N dernières secondes (réglable, 0 = jamais).
- **Reprise après pause** : la boucle reprend là où elle s'était arrêtée.
- **Écran allumé pendant la séance** : pont JS `RiffAndroid.keepScreenOn` → `FLAG_KEEP_SCREEN_ON` (Wake Lock API dans un navigateur).
- **Repères D/F sur la forme d'onde**, zone de boucle surlignée, tête de lecture ; toucher l'onde pour se positionner. Points au millième.
- **Bouton « ＋ Nouvelle »** : un nouvel enregistrement ne remplace plus la boucle précédente.
- **Thème Android sombre** (plus de flash blanc) et **Retour** qui ramène à l'Atelier avant de quitter.

## Statut vérifié le 3 novembre 2026

- Tests Node.js : **30/30 OK** (persistance des boucles manuelles + moteur de boucle).
- Interface vérifiée dans un navigateur (WAV de synthèse) : affinage, Repos → Montée → Effort, reprise après pause, fin de séance, Retour.
- Compilation Android : **non exécutée** (SDK/Gradle absents du runtime ; accès réseau impossible).
- APK : **pas encore compilée**. Le workflow GitHub Actions ci-joint est prévu pour produire un APK de debug.
- Application existante 2.3.1 : **non modifiée**. Le code source original est absent : ce laboratoire ne reprend PAS le moteur avancé de cycle A/B ni le lecteur de la 2.3.1.

## Fonctions incluses

- Import audio local avec sélecteur de documents Android, sans permission stockage ni Internet.
- Repères de boucle manuels au centième, pose des points depuis la lecture, écoute répétée.
- Enregistrement et modification des boucles par morceau dans le stockage local du WebView ; aucune validation de BPM, énergie, tempo, raccord ou classification IA.
- Sauvegarde et restauration JSON des repères, sans effacer les autres morceaux.
- Mode séance repos/montée/effort, durées configurables, première boucle enregistrée pour chaque rôle.
- Démonstration de l'évitement de la barre de navigation Android via WindowInsets natifs et marges CSS.

## Construire l'APK avec GitHub (nouveau dépôt privé conseillé)

1. Créer un dépôt GitHub **privé** `Riff-Forge` (ne pas toucher à HasselNote).
2. Extraire le ZIP puis envoyer la totalité des fichiers à la racine du nouveau dépôt ; respecter le dossier `.github/workflows`.
3. Onglet **Actions** → **Build Riff Forge 2.4 Lab APK** → **Run workflow**.
4. Une fois le job terminé, télécharger l'artifact `riff-forge-2.4-lab-apk` et installer l'APK de debug sur Android.
5. Garder l'ancienne APK Riff Forge 2.3.1 installée : la Lab a l'identifiant **fr.ironsky.riffforge.lab** et s'installe **à côté**, sans remplacement.

## À intégrer dans les sources originales

Pour créer une *véritable mise à jour 2.4* : retrouver les sources 2.3.1, identifier la logique de rejet des boucles et sa base de données, y transposer `manual-loops.js` ou ses invariants, puis corriger les insets de l'activité. Pour mettre à jour une APK signée existante il faut **la même clé de signature et le même applicationId**. Ne pas désinstaller l'ancienne application avant d'avoir exporté toutes les données.

## Tests locaux

`node --test tests/*.test.js`

## Limites et points de QA obligatoires

- Les repères sont persistants ; les fichiers MP3 importés sont à sélectionner de nouveau après redémarrage (pas de stockage de copie audio).
- La clé de morceau utilise `(nom, taille, date de modification)` pour retrouver les boucles ; si la date change, les boucles ne sont pas appariées automatiquement. Un hash audio serait préférable dans la version de production.
- Aucun test Android réel, d'arrière-plan, Bluetooth, audio focus, batterie, permissions de fichiers ou fluidité de boucle milliseconde n'a été effectué. Les boucles passent par la Web Audio API du WebView (pas un moteur natif) ; la lecture écran éteint ou application en arrière-plan reste à tester sur l'appareil.
- L'import/export JSON doit être retesté sur l'appareil et sa WebView. La sauvegarde interne dépend de la conservation des données applicatives Android.
- Workflow CI et versions de dépendances fournis à titre de base : vérifier la compilation effective sur GitHub Actions, ajuster en cas d'évolution des outils.
