# Changelog

## [1.7.1] — 2026-10-04

### Nouveau
- À propos : nouvelle section « Version locale » pour télécharger l'application installable (Windows, Android) quand elle est disponible
- À propos → Données : **Exporter toutes mes données** (personnages avec photos et PDF + campagne MJ complète dans un seul fichier .zip) et **Importer une sauvegarde complète** pour tout retrouver dans un autre navigateur
- Transfert en un clic vers l'application LogRPG installée : quand l'application le demande, le site propose d'envoyer toutes les données (rien n'est envoyé sans confirmation)

### Corrections
- Version mobile : impossible d'écrire ou de modifier une note (l'éditeur ne s'ouvrait pas)

## [1.7.0] — 2026-09-19

### Nouveau
- Mode Combat : saisie libre du montant de dégâts/soins (en plus des boutons ±1/±5)
- **PV temporaires** qui absorbent les dégâts en premier, avant de toucher les PV réels (Mode Combat + fiche perso)
- Mode MJ — nouvel écran **Bestiaire** (liste+détail) : stats personnalisées, notes riches, comme les autres ressources. Stockage migré vers une base plus robuste (fini les pertes de données de l'ancien format).
- Mode Combat : le lien vers la fiche bestiaire d'origine d'un participant est conservé — bouton **Fiche** pour la consulter sans quitter le combat
- Mode MJ — PNJ : lien optionnel vers une fiche bestiaire (lier une fiche existante, ou en créer une liée directement)
- Mode MJ — nouvelle ressource **Carte** : image de fond + pins cliquables (titre, texte, lien optionnel vers PNJ, lieu, objet, rencontre, scénario, image, bestiaire ou une autre carte)
- Cartes — mode présentation : masquer temporairement tous les pins pour montrer la carte aux joueurs sans spoiler
- Export / Import ZIP : cartes et bestiaire personnalisé inclus dans la sauvegarde de campagne, avec leurs liens préservés

### Corrections
- Mode Combat / fiche perso : les PV pouvaient dépasser le maximum avec les PV temporaires et le rester après mise à jour
- Zoom intempestif sur les champs de dégâts/soin en Mode Combat (iOS Safari)
- Menu contextuel du combat qui pouvait déborder de l'écran sur une fenêtre basse
- Suppression totale des données : plusieurs tables oubliées (objets, lieux, bestiaire, cartes) sont désormais bien vidées
- Sécurité : plusieurs identifiants (bestiaire, carte, pin) insuffisamment protégés pouvaient permettre l'exécution de code via un fichier ZIP de campagne importé malveillant
- Cartes : l'image de fond ne clignote plus à chaque interaction sur un pin
- Mode MJ : limite de taille des images relevée à 25 Mo (les captures d'écran de jeu détaillées dépassaient souvent l'ancienne limite de 10 Mo)
- Mode MJ / Combat : plusieurs fonds, bordures et survols de l'interface qui étaient invisibles depuis longtemps (boutons, séparateurs, barre de PV) sont maintenant bien visibles
- Import ZIP : une image qui échoue à se réimporter ne fait plus pointer silencieusement vers une image différente de la campagne

## [1.6.0] — 2026-06-17

### Nouveau
- Mode MJ — **éditeur de scénario WYSIWYG** : on écrit sans voir le Markdown, qui reste le format de stockage.
  - Paragraphes, titres et citations édités en direct (gras / italique / souligné / barré sur la sélection).
  - Tags `@` insérés comme des pastilles cliquables ; autocomplétion `@` et `/`.
  - Widgets `/switch /todo /combo /compteur /jauge` : insertion par **formulaire**, utilisables au clic (combo : liste déroulante), **clic droit** pour Modifier / Supprimer.
  - Bloc repliable `/details` géré par une fenêtre **Titre + Contenu**.
  - **Listes à puces et numérotées multi-niveaux** (Entrée / Tab / Maj+Tab, comme un traitement de texte), affichées en retrait en lecture.
  - Tableaux : **clic droit** pour Modifier (grille) ou Supprimer.
  - **Copier** le scénario en Markdown ; collage nettoyé (pas de styles externes importés).
- Mode MJ — **clic droit → Supprimer** sur tout élément (session, scénario, PNJ, objet, lieu, combat, image), avec fenêtre de confirmation.
- Mode MJ — Objets : raretés **personnalisables** (couleur + nom, adaptées à ton univers)
- Mode MJ — Objets : propriétaire en **texte libre** où l'on peut taguer un PNJ avec `@` (comme dans les scénarios)
- Mode MJ — Lieux : vignette conservée + image **ouvrable en plein écran** (idéal pour une carte)

### Corrections
- Mode MJ : style des tags Objet/Lieu (fond et contour) aligné sur les autres tags
- Suppressions (PNJ, combat, image) via la **fenêtre de confirmation** intégrée au lieu de la boîte du navigateur

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
- Mode MJ — nouvelles ressources **Objets** (type, rareté, propriétaire) et **Lieux** (type, région), avec image, taggables via `@` comme les PNJ
- Mode MJ — menu « créer depuis un tag cassé » : cliquer un `@tag` inexistant propose de créer la ressource (scénario, combat, PNJ, objet, lieu, image)

### Corrections
- Version mobile : refonte des correctifs pour Safari iOS
- Mode MJ : modale de confirmation lors de la suppression d'un scénario ou d'une session
- Mode MJ : l'aperçu d'un tag ne reste plus affiché après avoir cliqué dessus
- Les mises à jour de l'application sont désormais appliquées sans avoir à vider le cache du navigateur
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
