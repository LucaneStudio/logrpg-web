# Changelog

## [1.5.0] — 2026-06-14

### Nouveau
- Compteurs personnalisés côté joueur : ajout / modification / suppression dans l'onglet Compteurs, avec couleur au choix et bouton de réinitialisation. Types disponibles :
  - Simple / Jauge (valeur libre, ou bornée avec barre de progression)
  - Cases `●●○○` (pastilles cliquables, pour les utilisations limitées)
  - Repos (utilisations qui se rechargent au repos court ☀️ ou long 🌙)
  - Pas (boutons −/＋ par incrément choisi, ex. ±5)
- Mode MJ — widgets interactifs dans les scénarios, cliquables en mode Aperçu (état conservé dans le texte, donc exporté avec la campagne) :
  - `/switch{…}` interrupteur on/off
  - `/todo{…}` case à cocher (texte barré quand cochée)
  - `/combo{Label: a|b|c}` liste déroulante d'états
  - `/compteur{unité}` compteur −/+ (bornable avec `: min..max`)
  - `/jauge{Label: 6}` horloge de progression segmentée
  - `/details{Titre | contenu}` bloc repliable
- Autocomplétion des widgets en tapant `/` (comme `@` pour les tags)
- Mode MJ — menu « créer depuis un tag cassé » : cliquer un `@tag` inexistant propose de créer la ressource (scénario, combat, PNJ, image)

### Corrections
- Version mobile : refonte des correctifs pour Safari iOS
- Plus de zoom intempestif lors d'appuis rapides sur les boutons et onglets
- Appui long fiabilisé, et nouveau bouton « ⋯ » sur les cartes et la fiche pour accéder au menu (renommer, PDF, exporter, supprimer)
- Génération du PDF réparée sur mobile (impression native iOS → « Enregistrer dans Fichiers »)
- Contenu qui n'est plus coupé en bas de l'écran (encoche et barre d'adresse)

## [1.4.0] — 2026-06-14

### Nouveau
- Section « À propos » : note de version au lancement, historique des patchnotes, signalement de bug et proposition d'idées (vers Discord), liste des bugs connus et suppression des données locales
- Mode MJ — tags `@ref` dans les scénarios : liens cliquables vers les images, combats, PNJ et autres scénarios
- Autocomplétion des tags en tapant `@`, et aperçu au survol (image, participants d'un combat, fiche PNJ, extrait de scénario)

### Changements
- Mode MJ : sessions réorganisées en arborescence unique (dossiers dépliables avec leurs scénarios)
- Modales centrées sur desktop (bottom-sheet conservée sur mobile) et boutons d'action harmonisés

## [1.3.0] — 2026-06-04

### Nouveau
- Mode MJ — sessions, rencontres et répertoire PNJ avec portraits
- Bibliothèque d'assets (images) intégrée au Mode MJ
- Export / Import ZIP de campagne complet
- Lancement de combat depuis une rencontre

### Changements
- Refonte interne de l'organisation du code (séparation player / combat / MJ)
- Bouton Mode MJ ajouté dans la topbar

## [1.2.0] — 2026-06-01

### Nouveau
- Génération PDF de la fiche de personnage

## [1.1.0] — 2026-06-01

### Nouveau
- Drag & drop pour réorganiser les sections de caractéristiques
- Bascule rapide entre types de widgets
- Numéro de version affiché sur mobile

### Changements
- Mise en avant des modificateurs sur la vue desktop

## [1.0.0] — 2026-05-30

### Nouveau
- Première version de LogRPG Web
- Gestion des personnages (PV, mana, slots de sorts, monnaie)
- Onglets fiche, caractéristiques, capacités, inventaire et notes
- Mode combat avec bestiaire et conditions par round
