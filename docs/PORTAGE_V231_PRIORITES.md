# Riff Forge — portage ciblé vers l'application historique 2.3.1

**Décision de produit (3 novembre 2026)** : l'utilisateur préfère le fonctionnement musical, les transitions et l'ergonomie de **notre application Riff Forge 2.3.1**. **Ne pas remplacer** ce moteur par Auto-Forge ou par le laboratoire Android 2.4.1 créé avec Claude.

## Objectif : deux corrections uniquement

### 1) Liberté totale de réglage et de sauvegarde manuelle des boucles
- Conserver le moteur musical de 2.3.1, ses cycles et le comportement actuel de ses transitions.
- Permettre de régler à la main, tester, renommer et **enregistrer sans rejet musical** les repères de début/fin de chaque boucle, même si le détecteur automatique recommande autre chose.
- Une boucle manuelle doit être acceptée si, et seulement si, les coordonnées sont numériques, **0 <= début < fin <= durée du morceau** (prévoir la petite tolérance existante aux métadonnées audio, si nécessaire).
- Ne pas imposer d'heuristique BPM, de raccord, de longueur, d'énergie ni d'accord de l'IA lors de l'enregistrement manuel.
- Ajouter une action explicite **Nouvelle boucle** distincte de **Modifier** pour que l'ajout n'écrase pas les précédentes. Préserver plusieurs boucles par morceau et l'association à leur piste.
- Conserver les boucles après fermeture et redémarrage, autoriser la correction et la suppression, et garantir un export/restauration avant migration.
- Les réglages manuels ont priorité sur l'analyse automatique **dans le mode manuel**, sans désactiver les fonctions automatiques historiques.
- Réutiliser les principes et tests de `app/src/main/assets/manual-loops.js` de la Lab, **pas son moteur musical**.
- Contrôles de non-régression : créations courtes et longues ; points à 0 s ; édition d'une boucle existante ; plusieurs boucles indépendantes ; remise en route de l'APK ; import/export ; aucune altération du cycle historique A/B.

### 2) Respect de la navigation système Android
- Porter **uniquement** la gestion des `WindowInsets` de `app/src/main/java/fr/ironsky/riffforge/lab/MainActivity.java`, adaptée à l'Activity native de la 2.3.1.
- Laisser les boutons de l'application entièrement visibles et cliquables au-dessus de la barre de navigation 3 boutons, de la navigation par gestes, de la zone de découpe écran et du clavier.
- Éviter le cumul de `WindowInsets` natifs et de `env(safe-area-inset-bottom)` CSS qui donnerait un double espace inutile.
- Tester portrait sur le téléphone Android réel, après rotation si autorisée, en présence du clavier, avec mini-lecteur et navigation basse.

## À conserver de 2.3.1
- Analyse musicale actuelle et déroulé sonore préférés par l'utilisateur.
- Cycle A comme référence, cycle B **seulement** dans son fonctionnement historique, facultatif.
- Mode chrono seul, compte-tours, flammes, lecteur et journal de séances, là où ces fonctions sont présentes.
- Identifiant d'application et signature si l'objectif est une mise à jour installable par-dessus la 2.3.1.

## Ce qu'il ne faut pas faire
- Ne pas fusionner la Lab dans la version historique.
- Ne pas remplacer l'automatisation musicale existante par Auto-Forge.
- Ne pas changer le package ou la signature d'une véritable mise à jour.
- Ne pas déclarer une APK 2.3.1 corrigée sans compilation et vérification sur appareil.
- Ne pas supprimer/désinstaller l'ancienne application ni exposer ses données.

## État des sources
- Le dépôt `IronSkyFR/Riff-Forge` comporte actuellement le prototype indépendant `fr.ironsky.riffforge.lab`, pas les sources originales de la version installée 2.3.1.
- Sources anciennes mentionnées dans l'historique : `Riff-Forge-Android-source-v2.2.zip`, signature 2.2, APK 2.3.1 ; **non accessibles dans le dépôt à la date de cette note**.
- **Blocage** : récupérer le projet original 2.3.1 (idéalement sources) pour appliquer et compiler ces deux corrections sans perdre les comportements éprouvés.
- Si l'archive source n'est plus accessible, une APK 2.3.1 extraite du téléphone peut servir à examiner le comportement, mais **n'est pas équivalente à un projet source maintenable**.

## Critère de livraison
Une APK basée sur l'application historique, acceptant les réglages manuels sans validation musicale automatique, avec commandes jamais masquées par la navigation Android, et comportement sonore équivalent à la 2.3.1 pour les mêmes morceaux/séries.
