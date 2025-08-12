# Guide de Déploiement YT-Likes-Listener Backend

## Prérequis

1. **Compte Netlify** - [netlify.com](https://netlify.com)
2. **Netlify CLI** - `npm install -g netlify-cli`
3. **Variables d'environnement** configurées

## Configuration Variables d'environnement

### Sur Netlify Dashboard

1. Aller dans **Site Settings** > **Environment variables**
2. Ajouter les variables suivantes :

```bash
FIREBASE_PROJECT_ID=airtel-migration
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nVOTRE_CLE_PRIVEE_ICI\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@airtel-migration.iam.gserviceaccount.com
YOUTUBE_API_KEY=votre_cle_api_youtube_ici
GOOGLE_CLIENT_ID=votre_client_id_google.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=votre_client_secret_google
NODE_ENV=production
```

### Obtenir les Clés Firebase

1. Aller dans [Firebase Console](https://console.firebase.google.com)
2. Sélectionner le projet `airtel-migration`
3. **Project Settings** > **Service accounts** 
4. **Generate new private key**
5. Copier le contenu du fichier JSON dans les variables d'environnement

### Obtenir la Clé YouTube API

1. Aller dans [Google Cloud Console](https://console.cloud.google.com)
2. **APIs & Services** > **Credentials**
3. **Create Credentials** > **API key**
4. Activer **YouTube Data API v3**

## Déploiement

### Déploiement automatique (recommandé)

1. **Connecter le repository Git à Netlify**
   - Dans Netlify Dashboard: **New site from Git**
   - Sélectionner GitHub/GitLab/Bitbucket
   - Choisir le repository `yt-likes-listener-backend`

2. **Configuration build**
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Functions directory**: `netlify/functions`

3. **Variables d'environnement**
   - Ajouter toutes les variables listées ci-dessus

### Déploiement manuel

```bash
# Installation
npm install

# Build
npm run build

# Login Netlify CLI
netlify login

# Déploiement
netlify deploy --prod
```

## Endpoints Disponibles

Une fois déployé, les endpoints suivants seront disponibles :

- `POST /api/auth/verify` - Authentification Firebase
- `POST /api/youtube/poll-likes` - Polling des likes YouTube
- `GET /api/health` - Vérification santé du service
- `GET /api/stats` - Statistiques d'utilisation

## Configuration Cron Job

### Utiliser cron-job.org

1. Aller sur [cron-job.org](https://cron-job.org)
2. Créer un nouveau cron job :
   - **URL**: `https://votre-site.netlify.app/api/youtube/poll-likes`
   - **Méthode**: POST
   - **Fréquence**: Toutes les 5 minutes
   - **Headers**: `Content-Type: application/json`

## Vérification Post-Déploiement

### Test Health Check

```bash
curl https://votre-site.netlify.app/api/health
```

### Test d'Authentification

```bash
curl -X POST https://votre-site.netlify.app/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{"firebaseToken":"VOTRE_TOKEN_FIREBASE"}'
```

### Test Polling (déclenché par cron)

```bash
curl -X POST https://votre-site.netlify.app/api/youtube/poll-likes
```

## Monitoring

### Logs Netlify

- **Netlify Dashboard** > **Functions** > Voir les logs
- Les logs incluent les infos de debugging et erreurs

### Statistiques

```bash
curl https://votre-site.netlify.app/api/stats
```

## Troubleshooting

### Erreur "Configuration invalide"

- Vérifier que toutes les variables d'environnement sont définies
- Vérifier le format de `FIREBASE_PRIVATE_KEY` (avec \\n)

### Erreur "Token Firebase invalide"

- Vérifier que le projet Firebase est `airtel-migration`
- Vérifier les permissions du service account

### Erreur "Quota YouTube dépassé"

- Vérifier l'utilisation dans Google Cloud Console
- YouTube API a une limite de 10,000 units/jour

## Sécurité

- ✅ Tous les tokens sont vérifiés côté serveur
- ✅ Variables d'environnement sécurisées
- ✅ CORS configuré pour l'app Android
- ✅ Validation des entrées
- ✅ Rate limiting intégré

## Support

Pour toute question, vérifier :

1. Les logs Netlify Functions
2. L'endpoint `/api/health`
3. Les statistiques via `/api/stats`