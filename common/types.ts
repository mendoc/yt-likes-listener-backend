/**
 * Types partagés pour YT-Likes-Listener Backend
 */

// Types utilisateur
export interface User {
  userId: string;
  email: string;
  displayName: string;
  fcmToken: string;
  lastSyncTimestamp: Date;
  isActive: boolean;
  youtubeRefreshToken?: string;  // OAuth refresh token pour YouTube API
  isInitialized?: boolean;  // Indique si les 50 premiers likes ont été initialisés comme baseline
  baselineVideoIds?: string[];  // IDs des vidéos de la baseline initiale
}

// Types de téléchargement
export type DownloadStatus = 'pending' | 'downloading' | 'completed' | 'error';

export interface Download {
  userId: string;
  videoId: string;
  title: string;
  status: DownloadStatus;
  downloadPath?: string;
  timestamp: Date;
}

// Types YouTube API
export interface YouTubeVideo {
  id: string;
  title: string;
  duration?: string;
  thumbnailUrl?: string;
  channelTitle?: string;
}

// Types réponse API
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AuthVerifyRequest {
  firebaseToken: string;
  youtubeRefreshToken?: string; // Refresh token YouTube (ancien format)
  youtubeServerAuthCode?: string; // Server auth code à échanger (nouveau format)
}

export interface AuthVerifyResponse {
  success: boolean;
  userId: string;
  youtubeChannelId?: string;
}

export interface PollLikesResponse {
  success: boolean;
  usersChecked: number;
  totalNewLikes: number;
  fcmNotificationsSent: number;
}

// Types FCM
export interface FCMNotificationData {
  videoIds: string[];
  userId: string;
}

// Types erreur
export interface ErrorResponse {
  error: string;
  code?: string;
  details?: unknown;
}