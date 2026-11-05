# Riff Forge Héritage 2.4.2 — APK de reconstruction expérimentale

**Origine :** version Lab 2.4.1 de Claude Opus, retravaillée pour privilégier le comportement demandé : boucles manuelles libres et utilisation musicale simple.

## Ce que cette reconstruction propose
- **Enregistrement manuel conservé sans veto de l'analyse** : début/fin, modifications, plusieurs boucles par piste, sauvegarde locale et export JSON (module original 2.4.1 conservé).
- **Choix des boucles utilisées en séance** : repos, montée, effort A et B éventuellement. Les choix sont conservés par morceau.
- **Cycle B désactivé par défaut** : l'effort A est seul tant que B n'est pas activé explicitement ; possible de revenir au cycle A sans reconfigurer les repères.
- **Remix dynamique désactivé par défaut** : lecture moins transformée, avec possibilité de réactiver les filtres/impacts de la Lab.
- **Chrono seul** : séance sans lecture musicale, sans avoir à importer de piste.
- **Navigation système correctement espacée** : réutilisation du traitement WindowInsets natifs de la Lab.
- **Lecture musicale locale** : aucun accès réseau, aucun compte.
- **Application séparée** : identifiant `fr.ironsky.riffforge.heritage`. La 2.3.1 d'origine **et** la Lab de Claude peuvent rester installées ; aucune de leurs données n'est effacée.

## Ce qui n'est pas garanti
La 2.3.1 historique n'a pas été retrouvée sous forme de sources ; cette version est une **reconstruction basée sur la Lab de Claude**, pas un clone binaire ou une mise à jour signée de la 2.3.1. Son traitement musical peut différer de l'ancienne application : compare les morceaux/séries à l'oreille. La présence d'une sauvegarde de repères ne dispense pas de leur **export JSON** avant toute désinstallation.

Les tests GitHub Actions vérifient le code JavaScript et compilent l'APK. Ils ne remplacent **pas un test audio sur l'OPPO** (latence, fondus, fluidité, veille, Bluetooth, interruption d'appel, réglage de volume).

## Télécharger et tester
1. Ouvrir les **Actions** du dépôt sur la branche `work/heritage-lab-apk-242`.
2. Choisir la dernière exécution verte « Build Riff Forge Heritage 2.4.2 APK ».
3. Dans **Artifacts**, télécharger `riff-forge-heritage-242-apk`. L'archive ZIP contient une APK debug Android.
4. Installer en parallèle de l'app originale ; importer un MP3 ; enregistrer deux boucles Effort A/B manuelles ; choisir A, puis activer B uniquement si souhaité.
5. Tester une séance avec et sans remix, puis « Chrono seul ». Vérifier les boutons de navigation Android (gestes et/ou 3 boutons).

Ne pas remplacer ou désinstaller la 2.3.1 d'origine avant comparaison.
