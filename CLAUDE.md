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
│   ├── config.ts             # Variables d'environnement et validation
│   ├── responseHelpers.ts    # Utilitaires pour les réponses HTTP
│   └── types.ts              # Types TypeScript partagés
├── services/                 # Couche service modulaire
│   ├── DatabaseService.ts    # Firebase Firestore operations
│   ├── AuthService.ts        # Firebase Auth + YouTube verification
│   ├── YouTubeService.ts     # YouTube Data API v3
│   └── FCMService.ts         # Firebase Cloud Messaging
├── netlify/functions/        # Fonctions serverless (extension .mts)
│   ├── verify/               # /api/auth/verify - Authentification
│   ├── poll-likes/           # /api/youtube/poll-likes - Polling
│   ├── health/               # /api/health - Health check
│   └── stats/                # /api/stats - Statistiques d'usage
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

# Tests (à implémenter)
npm test          # Placeholder - Tests à implémenter
npm run test:watch # Placeholder - Tests watch à implémenter

# Déploiement
netlify deploy
netlify deploy --prod
```

## Endpoints Implémentés

### 1. Authentication `/api/auth/verify`
```typescript
// POST /api/auth/verify
// Vérifier token Firebase et sauvegarder refresh token YouTube
{
  "firebaseToken": "string",
  "youtubeRefreshToken"?: "string", // Refresh token obtenu par l'app mobile
  "youtubeServerAuthCode"?: "string" // Alternative au refresh token
} 
→ {
  "success": boolean,
  "userId": "string", 
  "youtubeChannelId"?: "string"
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

### 3. Health Check `/api/health`
```typescript
// GET /api/health
// Vérification de l'état du service
→ {
  "status": "healthy" | "unhealthy",
  "timestamp": "string",
  "version": "string",
  "services": {
    "firebase": boolean,
    "youtube": boolean
  }
}
```

### 4. Statistiques `/api/stats`
```typescript
// GET /api/stats
// Statistiques d'utilisation du service
→ {
  "totalUsers": number,
  "activeUsers": number,
  "totalDownloads": number,
  "lastPollTime": "string"
}
```

### 5. Fonction Interne FCM
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

## Workflow d'Authentification

1. **App Android** → authentification Firebase avec scopes YouTube
2. **App Android** → obtient refresh token YouTube via OAuth
3. **App Android** → appelle `/api/auth/verify` avec tokens Firebase + YouTube  
4. **Backend** → vérifie le token Firebase et sauvegarde le refresh token
5. **Utilisateur** → maintenant éligible pour polling automatique

## Workflow de Polling

1. **Cron externe** (cron-job.org) → appelle `/api/youtube/poll-likes` toutes les 5 minutes
2. **Backend** récupère tous les utilisateurs actifs avec refresh token depuis Firestore
3. Pour chaque utilisateur :
   - Utilise le refresh token pour obtenir un access token
   - Appelle YouTube Data API : "myRating=like" pour récupérer likes
   - Filtre les vidéos selon `lastSyncTimestamp`
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

### Structure Fonction Netlify (fichiers .mts)
```typescript
import { validateConfig } from '../../../common/config';
import { ErrorResponse } from '../../../common/types';

// Validation de la configuration au démarrage
try {
  validateConfig();
} catch (error) {
  console.error('Configuration invalide:', error);
}

export default async (request: Request): Promise<Response> => {
  // Headers CORS standardisés
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  };

  // Gérer les requêtes OPTIONS (preflight CORS)
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }
  
  try {
    // Validation méthode HTTP + parsing body si nécessaire
    const body = request.method !== 'GET' ? await request.json() : null;
    
    // Logique métier avec services
    const result = await serviceMethod(body);
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers
    });
    
  } catch (error) {
    console.error('Erreur endpoint:', error);
    
    const errorResponse: ErrorResponse = {
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_SERVER_ERROR',
      details: process.env.NODE_ENV === 'development' ? 
        {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        } : undefined,
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers
    });
  }
};

export const config = {
  path: "/api/endpoint-name",
};
```

## Points d'Attention

- **Extensions de fichiers** : Les fonctions Netlify utilisent l'extension `.mts` (TypeScript modules)
- **CORS** : Toutes les fonctions incluent les headers CORS pour les requêtes cross-origin
- **Error handling** : Structure d'erreur standardisée avec types `ErrorResponse`
- **Rate limiting** : YouTube API a des quotas (10,000 units/jour)
- **Polling efficace** : Batch processing pour tous les utilisateurs en une seule exécution
- **Sécurité** : Valider tous les tokens Firebase côté serveur
- **Performance** : Optimiser pour exécution toutes les 5 minutes
- **Configuration** : Validation automatique des variables d'environnement au démarrage

## Configuration Cron Externe

Utiliser cron-job.org pour appeler `/api/youtube/poll-likes` toutes les 5 minutes.

**URL de production** : https://ytlikeslistener.netlify.app

Configuration cron-job.org :
- URL : `https://ytlikeslistener.netlify.app/api/youtube/poll-likes`
- Méthode : POST
- Fréquence : `*/5 * * * *` (toutes les 5 minutes)
- Headers : `Content-Type: application/json`

## État du Projet

L'application Android est 100% fonctionnelle avec FCM intégré. Elle attend uniquement ce backend pour l'automatisation du polling YouTube.

## Communication

- Toujours communiquer en français
- Ne jamais mettre "claude" dans les messages de commit
- Utiliser les termes "Ajouter", "Modifier", "Corriger" pour les commits
- to memorize  Souviens-toi de toujours discuter avec moi en français