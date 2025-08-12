# YT-Likes-Listener Backend

Backend Netlify Functions pour automatiser le téléchargement d'audio des vidéos YouTube aimées.

YT Likes Listener est une application qui télécharge automatiquement l'audio des vidéos YouTube aimées par l'utilisateur.

## Installation

```bash
npm install
```

## Développement

```bash
npm run dev
```

## Structure

```
yt-likes-listener-backend/
├── common/                 # Configuration centralisée
├── services/              # Services modulaires (Firebase, YouTube, FCM)
├── netlify/functions/     # Fonctions serverless
│   ├── auth/             # Authentification
│   ├── youtube/          # Polling YouTube
│   └── utils/            # Utilitaires
└── ...
```

## Variables d'environnement

Créer un fichier `.env` :

```env
FIREBASE_PROJECT_ID=airtel-migration
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...
YOUTUBE_API_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

## Déploiement

```bash
npm run deploy:prod
```

## Endpoints

- `POST /api/auth/verify` - Vérification token Firebase
- `POST /api/youtube/poll-likes` - Polling des nouveaux likes YouTube