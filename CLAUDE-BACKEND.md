# CLAUDE-BACKEND.md

Ce fichier contient le contexte complet pour Claude Code lors du développement du backend YTLikesListener.

## Vue d'ensemble du projet

**YTLikesListener** est une application Android qui télécharge automatiquement l'audio des vidéos YouTube aimées par l'utilisateur. Le backend gère l'authentification, la détection des nouveaux likes via polling, et déclenche les téléchargements via FCM.

## Architecture système complète

```
[YouTube API] ←→ [Backend Netlify] ←→ [Firebase] ←→ [App Android]
        ↑                                               ↓
    [Polling toutes           [FCM interne]      [Téléchargement auto]
     les 5 min]
```

### Backend à développer (Netlify Functions)
- **Authentification** : Vérification tokens Google/Firebase
- **Polling YouTube** : Vérification périodique (toutes les 5min) des nouveaux likes via YouTube Data API
- **FCM interne** : Fonction interne qui envoie les videoId via FCM à l'app Android
- **Webhooks** : Endpoints pour déclencher vérifications depuis cron-job.org

## État actuel du projet Android

### ✅ Fonctionnalités complètes dans l'app Android :
1. **Authentification Google** avec scope YouTube (`https://www.googleapis.com/auth/youtube.readonly`)
2. **Téléchargement youtubedl-android réel** (pas de simulation)
3. **Notifications système** avec service foreground
4. **Gestion permissions** (stockage + notifications + Android 13+)
5. **Interface utilisateur** avec statuts FCM et permissions  
6. **Miniatures YouTube** intégrées comme cover art MP3
7. **Architecture MVVM** avec Repository pattern et singleton
8. **Firebase intégration** : Auth + Firestore + FCM
9. **FCM Token** : Déjà envoyé vers Firebase/Firestore par l'app

### Configuration Firebase actuelle :
```json
{
  "project_id": "airtel-migration",
  "collections": {
    "users": {
      "fields": {
        "email": "string",
        "displayName": "string", 
        "fcmToken": "string",
        "lastSyncTimestamp": "timestamp",
        "isActive": "boolean"
      }
    },
    "downloads": {
      "fields": {
        "userId": "string",
        "videoId": "string", 
        "title": "string",
        "status": "string", // "pending", "downloading", "completed", "error"
        "downloadPath": "string",
        "timestamp": "timestamp"
      }
    }
  }
}
```

## Backend à implémenter (Netlify Functions)

**Architecture inspirée de :** `mendoc/clara-speaker-backend` (GitHub)
- Analyser ce dépôt pour comprendre la structure, patterns et bonnes pratiques
- Adapter l'architecture aux besoins YTLikesListener

### Structure des fonctions requises :

#### 1. **Authentification (`/api/auth/verify`)**
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

#### 2. **Polling likes YouTube (`/api/youtube/poll-likes`)**
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

#### 3. **Fonction interne FCM**
```typescript
// Fonction interne (pas d'endpoint exposé)
// sendFCMNotification(userId: string, videoIds: string[])
// Envoie les videoId via FCM à l'app Android
// L'app reçoit les IDs et déclenche téléchargements automatiquement
```

### Workflow détaillé du Polling :

1. **Cron externe** (cron-job.org) → appelle `/api/youtube/poll-likes` toutes les 5 minutes
2. **Backend** récupère tous les utilisateurs actifs depuis Firestore
3. Pour chaque utilisateur :
   - Récupère `lastSyncTimestamp` 
   - Appelle YouTube Data API : "likes depuis timestamp X"
   - Si nouveaux likes → met à jour Firestore + appelle fonction FCM interne
4. **FCM interne** envoie les `videoId` à l'app Android
5. **App Android** reçoit FCM → déclenche téléchargements automatiquement

### Technologies backend requises :
- **Netlify Functions** (Node.js/TypeScript)
- **Firebase Admin SDK** (authentification + Firestore + FCM)
- **Google YouTube Data API v3** 
- **Cron externe** : https://cron-job.org (toutes les 5 minutes)

### Variables d'environnement nécessaires :
```env
FIREBASE_PROJECT_ID=airtel-migration
FIREBASE_PRIVATE_KEY=...
FIREBASE_CLIENT_EMAIL=...
YOUTUBE_API_KEY=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

## Workflow utilisateur cible

1. **Installation** : Utilisateur installe l'app Android
2. **Authentification** : Login Google avec scope YouTube
3. **Enregistrement** : App envoie FCM token à Firebase/Firestore (✅ déjà fait)
4. **Polling automatique** : Backend vérifie les likes toutes les 5 minutes
5. **Notification FCM** : Nouveau like → FCM avec videoId → app → téléchargement auto
6. **Stockage** : Audio MP3 avec miniature téléchargé (app ne gère PAS la lecture)

## Code Android pertinent

### Firebase Configuration (MainActivity.kt) :
```kotlin
private lateinit var authRepository: AuthRepository
private lateinit var downloadRepository: DownloadRepository

authRepository = AuthRepository() // Google Sign-In + YouTube scope
downloadRepository = DownloadRepository.getInstance(this) // Singleton pattern
```

### FCM Token Management (✅ Déjà implémenté) :
```kotlin
// MainScreen.kt - Statut FCM et token envoyé à Firestore
FirebaseMessaging.getInstance().token.addOnCompleteListener { task ->
    if (task.isSuccessful) {
        fcmToken = task.result
        isTokenValid = !task.result.isNullOrEmpty()
        // Token déjà sauvegardé dans Firestore
    }
}
```

### Download Service Integration :
```kotlin  
// DownloadService.kt - Service foreground pour téléchargements
// Reçoit FCM avec videoId → déclenche téléchargement automatique
class DownloadService : Service() {
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val videoId = intent?.getStringExtra("VIDEO_ID") // Depuis FCM
        if (videoId != null) {
            startDownload(videoId) // youtubedl-android + miniature embed
        }
    }
}
```

## Instructions pour la nouvelle session Claude Code

1. **Contexte** : Tu développes le backend Netlify Functions pour YTLikesListener
2. **Inspiration** : Analyser et s'inspirer de `mendoc/clara-speaker-backend` (GitHub)
3. **Structure** : Créer `netlify/functions/` avec architecture similaire à clara-speaker
4. **Priorité** : 
   - Setup Firebase Admin SDK (projet: airtel-migration)
   - Endpoint auth/verify 
   - Fonction polling YouTube toutes les 5min
   - FCM interne pour envoi videoId
5. **Cron** : Configuration pour cron-job.org (externe)

## Points d'attention

- **Sécurité** : Valider tous les tokens Firebase côté serveur
- **Rate limiting** : YouTube API a des quotas (10,000 units/jour)
- **Polling efficace** : Batch processing pour tous les utilisateurs en une seule exécution
- **Error handling** : Gérer timeouts et erreurs API gracefully
- **Logging** : Traçabilité pour debug (sans exposer tokens)
- **Performance** : Optimiser pour exécution toutes les 5 minutes

## Prochaines étapes backend

1. ✅ Analyser mendoc/clara-speaker-backend pour architecture
2. ✅ Setup projet Netlify Functions avec TypeScript
3. ✅ Configuration Firebase Admin SDK (airtel-migration)
4. ✅ Endpoint authentification `/api/auth/verify`
5. ✅ Integration YouTube Data API v3
6. ✅ Fonction polling `/api/youtube/poll-likes` (toutes les 5min)
7. ✅ FCM interne pour envoi videoId vers app Android
8. ✅ Configuration cron-job.org
9. ✅ Tests d'intégration avec app Android
10. ✅ Déploiement production

**L'app Android est 100% fonctionnelle avec FCM intégré. Elle attend uniquement le backend pour l'automatisation du polling YouTube.**