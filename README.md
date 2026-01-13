# 🌐 IsoDiagramApp - Créez des Diagrammes Isométriques Premium

**IsoDiagramApp** est une plateforme moderne et puissante pour concevoir des diagrammes d'architecture et de flux avec une esthétique isométrique élégante. Conçu comme un monorepo robuste, il allie une interface utilisateur fluide, un moteur de rendu performant et un stockage backend flexible.

---

## ✨ Points Forts

- **🎨 Esthétique Premium** : Rendu isométrique soigné avec transparence et ombres douces.
- **🚀 Performance** : Moteur de rendu optimisé pour une manipulation fluide des objets.
- **🖼️ Export Haute Définition** : Génération d'images PNG via Puppeteer côté serveur (avec support Retina/4K).
- **📦 Packs d'Icônes Dynamiques** : Chargement paresseux des icônes (AWS, GCP, Azure, Kubernetes, etc.).
- **☁️ Gestion des Assets** : Import d'images personnalisées stockées sur le serveur.
- **💾 Stockage Hybride** : Session locale ou persistence sur serveur.
- **🌍 Internationalisation** : Entièrement traduit en Français.

---

## 🏗️ Structure du Monorepo

```bash
IsoDiagramApp/
├── apps/
│   ├── web/        # Application Frontend (Vite/Rsbuild + React)
│   └── api/        # Serveur Backend (Node.js/Express + Puppeteer)
├── packages/
│   └── editor-core/# Bibliothèque Cœur (FossFLOW) - Logique de rendu & Store
├── data/
│   ├── diagrams/   # Stockage local des diagrammes JSON (côté API)
│   └── assets/     # Stockage des icônes uploadées et de base
└── package.json    # Gestion globale des dépendances & scripts
```

---

## 🚀 Démarrage Rapide

### 1. Prérequis
- **Node.js** >= 18
- **npm** >= 9

### 2. Installation
À la racine du projet :
```bash
npm install
```

### 3. Lancer en Développement
Une seule commande pour tout lancer (Frontend + API) :

```bash
npm run dev
```
> Accès : `http://localhost:3000`

Le frontend (3000) et l'API (3001) démarrent simultanément.

---

## 🛰️ API Documentation

Le serveur API fournit des points d'entrée pour la gestion et l'exportation des diagrammes.

### Point d'entrée de base : `http://localhost:3001` (ou via proxy frontend)

| Méthode | Endpoint | Description |
| :--- | :--- | :--- |
| **GET** | `/api/diagrams` | Liste tous les diagrammes stockés. |
| **GET** | `/api/diagrams/:id` | Récupère les données JSON d'un diagramme spécifique. |
| **POST** | `/api/diagrams` | Crée un nouveau diagramme. |
| **PUT** | `/api/diagrams/:id` | Met à jour ou sauvegarde un diagramme existant. |
| **DELETE** | `/api/diagrams/:id` | Supprime un diagramme du serveur. |
| **POST** | `/api/upload` | **Nouveau** : Upload d'une image/icône (stockage dans `data/assets/download`). |
| **GET** | `/api/export/:id` | **Export Image** : Capture le diagramme en PNG. |

#### Focus sur l'Export Image (`GET /api/export/:id`)
Utilise Puppeteer en arrière-plan pour un rendu identique à celui de l'éditeur.
- **Paramètre optionnel** : `scale` (ex: `?scale=2`) pour doubler la résolution.
- **Exemple** : `http://localhost:3000/api/export/diagram2?scale=2`

---

## ⚙️ Configuration (.env)

Créez un fichier `.env` dans `apps/api/` (optionnel, valeurs par défaut fournies) :

```env
BACKEND_PORT=3001
ENABLE_SERVER_STORAGE=true
STORAGE_PATH=./data/diagrams
WEB_APP_URL=http://localhost:3000
```

---

## 🛠️ Développement de la Bibliothèque

Si vous modifiez `packages/editor-core`, vous devez recompiler la bibliothèque pour voir les changements dans le web :

```bash
npm run build:lib
```

---

## 🐳 Docker

Vous pouvez lancer l'application complète (Frontend + API) en utilisant Docker.

### 1. Utilisation de Docker Compose (Recommandé)
Cela lancera l'application et configurera un volume persistant pour vos diagrammes et images.

```bash
docker-compose up -d
```
> Accès : `http://localhost:3001`

### 2. Construction manuelle de l'image
```bash
docker build -t isodiagram-app .
sudo docker run -p 3001:3001   -v $(pwd)/apps/api/data/diagrams:/app/apps/api/data/diagrams   -v $(pwd)/apps/api/data/download:/app/apps/api/data/assets/download   isodiagram_app
```

### Notes sur Docker :
- L'image inclut toutes les dépendances nécessaires pour **Puppeteer** (export image).
- Le serveur API à l'intérieur du container s'occupe de servir les fichiers statiques du Frontend.
- Les diagrammes sont persistés dans le dossier `/app/data/diagrams` (mappé via le volume).
- Les images uploadées sont persistées dans `/app/data/assets/download`.

---

## 📜 Licence

© 2026 IsoDiagramApp Team. Tous droits réservés.
Fondé sur la technologie FossFLOW.
