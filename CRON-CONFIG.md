# Configuration Cron Job pour YT-Likes-Listener

## Vue d'ensemble

Le backend YT-Likes-Listener nécessite un appel régulier à l'endpoint `/api/youtube/poll-likes` toutes les 5 minutes pour vérifier les nouveaux likes YouTube.

## Option 1: cron-job.org (Recommandé)

### Avantages
- ✅ Gratuit jusqu'à 50 tâches
- ✅ Interface web simple
- ✅ Monitoring intégré
- ✅ Notifications d'échec
- ✅ Historique des exécutions

### Configuration

1. **Créer un compte** sur [cron-job.org](https://cron-job.org)

2. **Ajouter un nouveau cron job** avec les paramètres :
   - **Title**: `YT-Likes-Listener Polling`
   - **URL**: `https://votre-site.netlify.app/api/youtube/poll-likes`
   - **Schedule**: `*/5 * * * *` (toutes les 5 minutes)
   - **Request method**: `POST`
   - **Request headers**: 
     ```
     Content-Type: application/json
     ```
   - **Request body**: `{}` (objet JSON vide)

3. **Options avancées** :
   - **Timeout**: 30 secondes
   - **Retry**: 3 fois en cas d'échec
   - **Email notifications**: Activé pour les échecs

4. **Sauvegarder et activer**

### Monitoring cron-job.org

- Dashboard affiche les exécutions récentes
- Codes de réponse et temps d'exécution
- Notifications email en cas d'échec
- Logs détaillés disponibles

## Option 2: GitHub Actions (Alternative)

Créer `.github/workflows/polling.yml` :

```yaml
name: YouTube Likes Polling

on:
  schedule:
    - cron: '*/5 * * * *'  # Toutes les 5 minutes
  workflow_dispatch:  # Déclenchement manuel

jobs:
  poll-likes:
    runs-on: ubuntu-latest
    steps:
      - name: Call Polling Endpoint
        run: |
          curl -X POST https://votre-site.netlify.app/api/youtube/poll-likes \\
            -H "Content-Type: application/json" \\
            -d '{}'
```

## Option 3: Netlify Scheduled Functions

⚠️ **Attention**: Netlify Scheduled Functions sont une fonctionnalité payante

Créer `netlify/functions/scheduled-polling.mts` :

```typescript
import type { ScheduleHandler } from "@netlify/functions"

const handler: ScheduleHandler = async (event, context) => {
  // Appeler directement le service de polling
  const { YouTubeService } = await import('../../services/YouTubeService');
  const { FCMService } = await import('../../services/FCMService');
  
  const youtubeService = YouTubeService.getInstance();
  const fcmService = FCMService.getInstance();
  
  const result = await youtubeService.checkAllUsersForNewLikes();
  
  if (result.newLikesByUser.size > 0) {
    await fcmService.sendNotificationsToUsers(result.newLikesByUser);
  }
  
  console.log('Polling scheduled:', result);
}

export { handler }
```

Ajouter dans `netlify.toml` :

```toml
[[functions]]
  schedule = "*/5 * * * *"
  path = "netlify/functions/scheduled-polling.mts"
```

## Option 4: EasyCron (Alternative gratuite)

1. **S'inscrire** sur [easycron.com](https://www.easycron.com)
2. **Créer un cron job** :
   - **URL**: `https://votre-site.netlify.app/api/youtube/poll-likes`
   - **Cron expression**: `*/5 * * * *`
   - **HTTP Method**: POST
   - **HTTP Header**: `Content-Type: application/json`

## Validation de la Configuration

### 1. Test manuel de l'endpoint

```bash
curl -X POST https://votre-site.netlify.app/api/youtube/poll-likes \\
  -H "Content-Type: application/json" \\
  -d '{}'
```

**Réponse attendue** :
```json
{
  "success": true,
  "usersChecked": 2,
  "totalNewLikes": 0,
  "fcmNotificationsSent": 0
}
```

### 2. Vérifier les logs Netlify

- Aller dans **Netlify Dashboard** > **Functions**
- Vérifier les logs de `poll-likes`
- Rechercher les messages de debug avec émojis

### 3. Monitoring avec /api/stats

```bash
curl https://votre-site.netlify.app/api/stats
```

## Fréquence Recommandée

### 🎯 **5 minutes** (recommandé)
- Équilibre entre réactivité et usage de quotas
- 288 appels/jour = ~2880 units YouTube API/jour (30% du quota)

### Alternative: **3 minutes**
- Plus réactif
- 480 appels/jour = ~4800 units YouTube API/jour (48% du quota)

### Alternative: **10 minutes**
- Économise le quota API
- Moins réactif pour l'utilisateur
- 144 appels/jour = ~1440 units YouTube API/jour (14% du quota)

## Calcul du Quota YouTube API

**Estimation par appel** :
- 1 appel `checkAllUsersForNewLikes` = ~10 units par utilisateur actif
- Pour 10 utilisateurs = ~100 units par appel
- Toutes les 5 minutes = 288 appels/jour = ~28,800 units/jour

⚠️ **Limite quotidienne**: 10,000 units/jour par défaut

## Troubleshooting Cron

### Cron ne s'exécute pas
1. Vérifier l'URL de l'endpoint
2. Vérifier que le site Netlify est bien déployé
3. Tester l'endpoint manuellement

### Timeout du cron
1. Augmenter le timeout à 60 secondes
2. Optimiser le code pour réduire le temps d'exécution
3. Réduire le nombre d'utilisateurs traités par batch

### Erreur 500 pendant l'exécution
1. Vérifier les variables d'environnement
2. Consulter les logs Netlify Functions
3. Tester l'endpoint `/api/health`

## Monitoring Recommandé

1. **Health check quotidien** :
   ```bash
   curl https://votre-site.netlify.app/api/health
   ```

2. **Statistiques hebdomadaires** :
   ```bash
   curl https://votre-site.netlify.app/api/stats
   ```

3. **Alertes à configurer** :
   - Cron job en échec pendant >1 heure
   - Taux d'erreur >10%
   - Quota YouTube >80%

La configuration avec **cron-job.org** est recommandée pour sa simplicité et ses fonctionnalités de monitoring intégrées.