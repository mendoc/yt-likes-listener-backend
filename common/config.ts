/**
 * Configuration centralisée pour YT-Likes-Listener Backend
 */

export interface FirebaseConfig {
  projectId: string;
  privateKey: string;
  clientEmail: string;
}

export interface YouTubeConfig {
  apiKey: string;
  clientId: string;
  clientSecret: string;
}

export interface GoogleAuthConfig {
  clientId: string;
  clientSecret: string;
}

// Configuration Firebase
export const firebaseConfig: FirebaseConfig = {
  projectId: process.env.FIREBASE_PROJECT_ID || 'airtel-migration',
  privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || '',
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
};

// Configuration YouTube API
export const youtubeConfig: YouTubeConfig = {
  apiKey: process.env.YOUTUBE_API_KEY || '',
  clientId: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
};

// Configuration Google OAuth
export const googleAuthConfig: GoogleAuthConfig = {
  clientId: process.env.GOOGLE_CLIENT_ID || '',
  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
};

// Validation de la configuration
export function validateConfig(): void {
  const requiredVars = [
    { name: 'FIREBASE_PROJECT_ID', value: firebaseConfig.projectId },
    { name: 'FIREBASE_PRIVATE_KEY', value: firebaseConfig.privateKey },
    { name: 'FIREBASE_CLIENT_EMAIL', value: firebaseConfig.clientEmail },
    { name: 'YOUTUBE_API_KEY', value: youtubeConfig.apiKey },
    { name: 'GOOGLE_CLIENT_ID', value: googleAuthConfig.clientId },
    { name: 'GOOGLE_CLIENT_SECRET', value: googleAuthConfig.clientSecret },
  ];

  const missing = requiredVars.filter(v => !v.value);
  
  if (missing.length > 0) {
    const missingNames = missing.map(v => v.name).join(', ');
    throw new Error(`Variables d'environnement manquantes: ${missingNames}`);
  }
}

// Configuration pour les environnements
export const isDevelopment = process.env.NODE_ENV !== 'production';

// Limites de l'API YouTube
export const youtubeLimits = {
  maxVideosPerRequest: 50,
  dailyQuotaLimit: 10000,
  requestsPerSecond: 100,
};

// Configuration FCM
export const fcmConfig = {
  maxRetries: 3,
  retryDelay: 1000, // ms
};