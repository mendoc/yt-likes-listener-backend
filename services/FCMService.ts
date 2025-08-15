/**
 * Service Firebase Cloud Messaging pour YT-Likes-Listener
 */

import admin from 'firebase-admin';
import { fcmConfig } from '../common/config';
// Types removed from import - can be imported if needed later
import { DatabaseService } from './DatabaseService';
import { YouTubeLikedVideo } from './YouTubeService';

export interface FCMSendResult {
  success: boolean;
  userId: string;
  videoIds: string[];
  messageId?: string;
  error?: string;
}

export class FCMService {
  private static instance: FCMService;
  private databaseService: DatabaseService;

  private constructor() {
    this.databaseService = DatabaseService.getInstance();
  }

  public static getInstance(): FCMService {
    if (!FCMService.instance) {
      FCMService.instance = new FCMService();
    }
    return FCMService.instance;
  }

  /**
   * Envoyer une notification FCM à un utilisateur spécifique
   */
  async sendNotificationToUser(
    userId: string, 
    videos: YouTubeLikedVideo[]
  ): Promise<FCMSendResult> {
    try {
      // Récupérer les informations de l'utilisateur
      const user = await this.databaseService.getUser(userId);
      if (!user || !user.fcmToken || !user.isActive) {
        return {
          success: false,
          userId,
          videoIds: videos.map(v => v.videoId),
          error: 'Utilisateur introuvable ou token FCM manquant',
        };
      }

      const videoIds = videos.map(v => v.videoId);
      
      // Construire le message FCM (data-only pour déclenchement automatique)
      const message: admin.messaging.Message = {
        token: user.fcmToken,
        data: {
          type: 'new_likes',
          videoIds: JSON.stringify(videoIds),
          count: videos.length.toString(),
          // Notification dans data pour Android
          title: 'Nouvelles musiques disponibles !',
          body: videos.length === 1 
            ? `"${videos[0].title}" est prêt à télécharger`
            : `${videos.length} nouvelles musiques à télécharger`,
        },
      };

      // Envoyer la notification avec timeout
      const response = await Promise.race([
        admin.messaging().send(message),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout FCM après 10s')), 10000)
        )
      ]);
      
      console.log(`Notification FCM envoyée à ${user.email}: ${response}`);
      
      return {
        success: true,
        userId,
        videoIds,
        messageId: response,
      };

    } catch (error) {
      console.error(`Erreur envoi FCM à ${userId}:`, error);
      
      // Si le token FCM est invalide, marquer l'utilisateur comme inactif
      if (error instanceof Error && 
          (error.message.includes('registration-token-not-registered') ||
           error.message.includes('invalid-registration-token'))) {
        console.warn(`Token FCM invalide pour ${userId}, désactivation de l'utilisateur`);
        await this.markUserAsInactive(userId);
      }

      return {
        success: false,
        userId,
        videoIds: videos.map(v => v.videoId),
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Envoyer des notifications FCM à plusieurs utilisateurs
   */
  async sendNotificationsToUsers(
    userVideosMap: Map<string, YouTubeLikedVideo[]>
  ): Promise<FCMSendResult[]> {
    const results: FCMSendResult[] = [];

    for (const [userId, videos] of userVideosMap.entries()) {
      try {
        const result = await this.sendNotificationToUser(userId, videos);
        results.push(result);

        // Petite pause entre les envois pour éviter le rate limiting
        await this.delay(100);
      } catch (error) {
        console.error(`Erreur envoi notification à ${userId}:`, error);
        results.push({
          success: false,
          userId,
          videoIds: videos.map(v => v.videoId),
          error: error instanceof Error ? error.message : 'Erreur inconnue',
        });
      }
    }

    return results;
  }

  /**
   * Envoyer une notification de test à un utilisateur
   */
  async sendTestNotification(userId: string): Promise<FCMSendResult> {
    try {
      const user = await this.databaseService.getUser(userId);
      if (!user || !user.fcmToken) {
        return {
          success: false,
          userId,
          videoIds: [],
          error: 'Utilisateur ou token FCM introuvable',
        };
      }

      const message: admin.messaging.Message = {
        token: user.fcmToken,
        notification: {
          title: 'Test YT-Likes-Listener',
          body: 'Le backend fonctionne correctement !',
        },
        data: {
          type: 'test',
          timestamp: new Date().toISOString(),
        },
      };

      const response = await admin.messaging().send(message);
      
      return {
        success: true,
        userId,
        videoIds: [],
        messageId: response,
      };
    } catch (error) {
      console.error(`Erreur notification test pour ${userId}:`, error);
      return {
        success: false,
        userId,
        videoIds: [],
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }

  /**
   * Marquer un utilisateur comme inactif suite à un token FCM invalide
   */
  private async markUserAsInactive(userId: string): Promise<void> {
    try {
      await this.databaseService.createOrUpdateUser({
        userId,
        isActive: false,
      });
      console.log(`Utilisateur ${userId} marqué comme inactif`);
    } catch (error) {
      console.error(`Erreur marquage utilisateur inactif ${userId}:`, error);
    }
  }

  /**
   * Valider un token FCM
   */
  async validateFCMToken(token: string): Promise<boolean> {
    try {
      // Envoyer un message de test vide (dry run)
      await admin.messaging().send({
        token,
        data: { test: 'validation' },
      }, true); // dry run = true
      
      return true;
    } catch (error) {
      console.error('Validation token FCM échouée:', error);
      return false;
    }
  }

  /**
   * Obtenir les statistiques des notifications FCM
   */
  async getFCMStats(): Promise<{
    totalSent: number;
    successfulSent: number;
    failedSent: number;
    activeTokens: number;
  }> {
    try {
      // Dans un environnement réel, ces statistiques seraient stockées en base
      // Pour l'instant, on simule avec des données de base
      const activeUsers = await this.databaseService.getAllActiveUsers();
      const activeTokens = activeUsers.filter(user => user.fcmToken.length > 0).length;

      return {
        totalSent: 0,
        successfulSent: 0,
        failedSent: 0,
        activeTokens,
      };
    } catch (error) {
      console.error('Erreur récupération stats FCM:', error);
      return {
        totalSent: 0,
        successfulSent: 0,
        failedSent: 0,
        activeTokens: 0,
      };
    }
  }

  /**
   * Nettoyer les tokens FCM invalides
   */
  async cleanupInvalidTokens(): Promise<number> {
    try {
      const activeUsers = await this.databaseService.getAllActiveUsers();
      let cleanedCount = 0;

      for (const user of activeUsers) {
        if (user.fcmToken) {
          const isValid = await this.validateFCMToken(user.fcmToken);
          if (!isValid) {
            await this.markUserAsInactive(user.userId);
            cleanedCount++;
          }
        }

        // Pause pour éviter le rate limiting
        await this.delay(200);
      }

      console.log(`${cleanedCount} tokens FCM invalides nettoyés`);
      return cleanedCount;
    } catch (error) {
      console.error('Erreur nettoyage tokens FCM:', error);
      return 0;
    }
  }

  /**
   * Utilitaire pour ajouter un délai
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Retry logic pour les envois FCM
   */
  private async sendWithRetry(
    message: admin.messaging.Message,
    maxRetries: number = fcmConfig.maxRetries
  ): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await admin.messaging().send(message);
        console.log(`Message FCM envoyé avec succès (tentative ${attempt})`);
        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Erreur inconnue');
        console.warn(`Tentative ${attempt}/${maxRetries} échouée:`, lastError.message);
        
        if (attempt < maxRetries) {
          await this.delay(fcmConfig.retryDelay * attempt);
        }
      }
    }

    throw lastError || new Error('Échec après toutes les tentatives');
  }
}