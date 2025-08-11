**YT-Likes-Listener**  
Une application permettant de télécharger les vidéos de musique YouTube que l’on a likées au format audio.

**User flow**

- L'utilisateur s'authentifie via Google avec les scopes YouTube API (depuis l'application mobile)
- Le token d'authentification est sauvegardé dans Firestore
- L'utilisateur like une vidéo YouTube (depuis l'application mobile ou web)  
  - Un cron job lance une fonction serverless chaque minute  
  - La fonction récupère le token depuis Firestore et appelle l'API YouTube  
  - La fonction vérifie dans Firestore si les vidéos ont déjà été téléchargées  
  - La fonction envoie les ID des nouvelles vidéos à l'application mobile via FCM  
  - L'application mobile reçoit la notification push et lance le téléchargement de l'audio  
  - L'application mobile met à jour le statut dans Firestore ("downloading")
  - L'application mobile crée une liste de téléchargement des audio s'il y a plusieurs liens  
  - L'application mobile télécharge un audio à la fois  
  - La liste d'attente des audio à télécharger est consultable depuis l'application mobile  
- L'audio de la vidéo est enregistré dans le dossier *Musique* du téléphone  
- L'application met à jour le statut dans Firestore ("completed")
- Une notification informe l'utilisateur que l'audio a été téléchargé  
- En appuyant sur la notification, l'audio se lit avec le lecteur de musique par défaut

**Règle de gestion**

- Un audio doit être téléchargé qu'une seule fois (vérification via Firestore)
- Ne sont considérées que :   
  - Les vidéos likées  
  - Les vidéos de moins de 6 minutes  
- C'est la version audio de la vidéo qui est téléchargée sur le téléphone  
- Les shorts YouTube sont ignorés
- Si le token Google expire, l'utilisateur doit s'authentifier à nouveau
- Pas d'historique des téléchargements sauvegardé dans l'application mobile
- Les notifications de téléchargement terminé sont dismissibles par l'utilisateur

**Outils et technos**

- Application mobile Android/Kotlin avec Jetpack Compose
- Fonction serverless Netlify avec cron job (1 minute)
- Authentification Google avec scopes YouTube API
- Firebase Cloud Messaging (FCM) pour les notifications push
- Cloud Firestore pour :
  - Stockage des tokens d'authentification
  - Suivi des statuts de téléchargement ("pending", "downloading", "completed")
  - Éviter les doublons
- Pour le téléchargement des audio :
  - youtubedl-android (https://github.com/yausername/youtubedl-android)

**Architecture Firestore**
```
users/{userId}/
├── profile: { token, fcmToken, tokenExpiry }
└── downloads/{videoId}: { status: "pending" | "downloading" | "completed" }
```