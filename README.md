# IsoDiagramApp

IsoDiagramApp est une application web de création de diagrammes isométriques.
Le projet est structuré comme un **monorepo** regroupant une application web, une API backend optionnelle et une bibliothèque cœur partagée.

Ce dépôt correspond à une base technique nettoyée et restructurée à partir d’un projet open-source, afin de servir de fondation à un nouveau développement.

---

## Structure du projet

```
IsoDiagramApp/
  apps/
    web/            # Application web (frontend)
    api/            # Backend Node.js / Express (stockage persistant optionnel)
  packages/
    editor-core/    # Bibliothèque cœur de l’éditeur (TypeScript)
  package.json
  package-lock.json
  tsconfig.base.json
```

---

## Prérequis

* **Node.js** >= 18
* **npm** >= 9

---

## Installation

À la racine du dépôt :

```bash
npm install
```

---

## Développement

### Lancer l’API (backend)

```bash
npm run dev:api
```

L’API est un serveur Node.js / Express utilisé pour le stockage persistant (optionnel).

---

### Lancer l’application web (frontend)

```bash
npm run dev:web
```

L’application web consomme la bibliothèque `editor-core` et peut communiquer avec l’API si elle est activée.

---

## Build

Build de la bibliothèque cœur et de l’application web :

```bash
npm run build
```

> Le backend (`apps/api`) ne nécessite pas de phase de build (serveur Node.js pur).

---

## Scripts principaux (racine)

* `npm run dev:web` : lance le frontend
* `npm run dev:api` : lance le backend en mode développement
* `npm run build` : build de `editor-core` + `web`
* `npm run test` : exécute les tests des workspaces (si présents)
* `npm run lint` : lance le lint sur les workspaces (si configuré)

---

## Philosophie du dépôt

* Nettoyage progressif et contrôlé
* Un refactor = un commit
* Tests manuels à chaque étape (build + lancement web/api)
* Suppression des outils et fichiers non nécessaires (docs site, docker, artefacts, etc.)

Ce dépôt sert de **socle technique stable** avant l’ajout de nouvelles fonctionnalités.

---

## Licence

Voir le fichier `LICENSE` à la racine du dépôt ainsi que les licences incluses dans les sous-packages.
