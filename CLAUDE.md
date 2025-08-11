# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Contexte du Projet

**YT-Likes-Listener Backend** - Backend Netlify Functions pour automatiser le téléchargement d'audio des vidéos YouTube aimées. L'application Android est déjà fonctionnelle et attend ce backend pour l'automatisation complète.

Firebase Project ID: `airtel-migration`

## Architecture du Système

```
[YouTube API] ←→ [Backend Netlify] ←→ [Firebase] ←→ [App Android]
        ↑                                               ↓
    [Polling toutes           [FCM interne]      [Téléchargement auto]
     les 5 min]
```

## Structure du Code

Inspirée de `mendoc/clara-speaker-backend`, utilise une architecture modulaire :

```
yt-likes-listener-backend/
├── common/                    # Configuration centralisée
│   └── config.ts             # Variables d'environnement
├── services/                 # Couche service modulaire
│   ├── DatabaseService.ts    # Firebase Firestore operations
│   ├── AuthService.ts        # Firebase Auth + YouTube verification
│   ├── YouTubeService.ts     # YouTube Data API v3
│   └── FCMService.ts         # Firebase Cloud Messaging
├── netlify/functions/        # Fonctions serverless
│   ├── auth/                 # /api/auth/verify endpoint
│   ├── youtube/              # /api/youtube/poll-likes endpoint
│   └── utils/                # Utilitaires partagés
├── package.json
├── tsconfig.json
└── netlify.toml
```

## Commandes de Développement

```bash
# Installation
npm install

# Développement local
npm run dev
# ou
netlify dev

# Build et lint
npm run build
npm run lint

# Tests
npm test
npm run test:watch

# Déploiement
netlify deploy
netlify deploy --prod
```

## Endpoints à Implémenter

### 1. Authentication `/api/auth/verify`
```typescript
// POST /api/auth/verify
// Vérifier token Firebase et synchroniser avec YouTube
{
  "firebaseToken": "string"
} 
→ {
  "success": boolean,
  "userId": "string", 
  "youtubeChannelId": "string"
}
```

### 2. Polling YouTube `/api/youtube/poll-likes`
```typescript
// POST /api/youtube/poll-likes
// Appelé par cron-job.org toutes les 5 minutes
// Vérifie TOUS les utilisateurs actifs pour nouveaux likes
→ {
  "success": boolean,
  "usersChecked": number,
  "totalNewLikes": number,
  "fcmNotificationsSent": number
}
```

### 3. Fonction Interne FCM
```typescript
// sendFCMNotification(userId: string, videoIds: string[])
// Envoie les videoId via FCM à l'app Android
// L'app reçoit les IDs et déclenche téléchargements automatiquement
```

## Variables d'Environnement Requises

```env
FIREBASE_PROJECT_ID=airtel-migration
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...
YOUTUBE_API_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

## Workflow de Polling

1. **Cron externe** (cron-job.org) → appelle `/api/youtube/poll-likes` toutes les 5 minutes
2. **Backend** récupère tous les utilisateurs actifs depuis Firestore
3. Pour chaque utilisateur :
   - Récupère `lastSyncTimestamp` 
   - Appelle YouTube Data API : "likes depuis timestamp X"
   - Si nouveaux likes → met à jour Firestore + appelle fonction FCM interne
4. **FCM interne** envoie les `videoId` à l'app Android
5. **App Android** reçoit FCM → déclenche téléchargements automatiquement

## Structure Firestore

```javascript
users/{userId}/
├── profile: { 
    email: string,
    displayName: string,
    fcmToken: string,
    lastSyncTimestamp: timestamp,
    isActive: boolean
}
└── downloads/{videoId}: { 
    userId: string,
    videoId: string,
    title: string,
    status: "pending" | "downloading" | "completed" | "error",
    downloadPath: string,
    timestamp: timestamp
}
```

## Patterns de Code Importants

### Initialisation Firebase Admin
```typescript
if (!admin.apps.length) {
  const serviceAccount = process.env.GOOGLE_SERVICE_ACCOUNT;
  if (!serviceAccount) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT environment variable is not set.");
  }
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(serviceAccount))
  });
}
```

### Structure Fonction Netlify
```typescript
import type { Context } from "@netlify/functions";

export default async (request: Request, context: Context): Promise<Response> => {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  
  try {
    const body = await request.json();
    // Validation + logique métier
    
    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Erreur:', error);
    return new Response(JSON.stringify({ error: 'Erreur interne' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
```

## Points d'Attention

- **Rate limiting** : YouTube API a des quotas (10,000 units/jour)
- **Polling efficace** : Batch processing pour tous les utilisateurs en une seule exécution
- **Error handling** : Gérer timeouts et erreurs API gracefully
- **Sécurité** : Valider tous les tokens Firebase côté serveur
- **Performance** : Optimiser pour exécution toutes les 5 minutes

## Configuration Cron Externe

Utiliser cron-job.org pour appeler `/api/youtube/poll-likes` toutes les 5 minutes.

## État du Projet

L'application Android est 100% fonctionnelle avec FCM intégré. Elle attend uniquement ce backend pour l'automatisation du polling YouTube.

## Communication

- Toujours communiquer en français
- Ne jamais mettre "claude" dans les messages de commit
- Utiliser les termes "Ajouter", "Modifier", "Corriger" pour les commits