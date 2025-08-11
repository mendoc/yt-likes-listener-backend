/**
 * Endpoint de polling YouTube /api/youtube/poll-likes
 * Vérifie les nouveaux likes pour tous les utilisateurs actifs
 * Appelé par cron-job.org toutes les 5 minutes
 */

import { validateConfig } from '../../../common/config';
import { PollLikesResponse, ErrorResponse } from '../../../common/types';
import { YouTubeService } from '../../../services/YouTubeService';
import { FCMService } from '../../../services/FCMService';
import { DatabaseService } from '../../../services/DatabaseService';

// Validation de la configuration au démarrage
try {
  validateConfig();
} catch (error) {
  console.error('Configuration invalide:', error);
}

const youtubeService = YouTubeService.getInstance();
const fcmService = FCMService.getInstance();
const databaseService = DatabaseService.getInstance();

/**
 * Handler principal pour l'endpoint /api/youtube/poll-likes
 */
export default async (request: Request): Promise<Response> => {
  // Headers CORS
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  // Gérer les requêtes OPTIONS (preflight CORS)
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  // Vérifier la méthode HTTP
  if (request.method !== 'POST') {
    const error: ErrorResponse = {
      error: 'Méthode non autorisée. Utilisez POST.',
      code: 'METHOD_NOT_ALLOWED',
    };
    return new Response(JSON.stringify(error), {
      status: 405,
      headers,
    });
  }

  const startTime = Date.now();
  console.log('🚀 Début du polling YouTube:', new Date().toISOString());

  try {
    // Obtenir les statistiques avant le polling
    const statsBefore = await databaseService.getStats();
    console.log('📊 Stats avant polling:', statsBefore);

    // Étape 1: Vérifier tous les utilisateurs actifs pour de nouveaux likes
    console.log('🔍 Vérification des nouveaux likes YouTube...');
    const pollingResult = await youtubeService.checkAllUsersForNewLikes();

    console.log('📋 Résultats du polling:', {
      usersChecked: pollingResult.usersChecked,
      totalNewLikes: pollingResult.totalNewLikes,
      usersWithNewLikes: pollingResult.newLikesByUser.size,
    });

    // Étape 2: Envoyer les notifications FCM pour les nouveaux likes
    let fcmNotificationsSent = 0;
    let fcmResults: { userId: string; success: boolean; error?: unknown }[] = [];

    if (pollingResult.newLikesByUser.size > 0) {
      console.log('📲 Envoi des notifications FCM...');
      fcmResults = await fcmService.sendNotificationsToUsers(pollingResult.newLikesByUser);
      
      // Compter les notifications réussies
      fcmNotificationsSent = fcmResults.filter(result => result.success).length;
      
      console.log('✅ Notifications FCM:', {
        envoyées: fcmResults.length,
        réussies: fcmNotificationsSent,
        échouées: fcmResults.length - fcmNotificationsSent,
      });

      // Logger les échecs FCM
      fcmResults.filter(r => !r.success).forEach(result => {
        console.warn(`❌ Échec FCM pour ${result.userId}:`, result.error);
      });
    } else {
      console.log('ℹ️  Aucun nouveau like trouvé, pas de notifications à envoyer');
    }

    // Étape 3: Statistiques finales
    const statsAfter = await databaseService.getStats();
    const processingTime = Date.now() - startTime;

    console.log('📊 Stats après polling:', statsAfter);
    console.log(`⏱️  Temps de traitement: ${processingTime}ms`);

    // Construire la réponse
    const response: PollLikesResponse = {
      success: true,
      usersChecked: pollingResult.usersChecked,
      totalNewLikes: pollingResult.totalNewLikes,
      fcmNotificationsSent,
    };

    // Log détaillé pour monitoring
    console.log('🎯 Polling terminé avec succès:', {
      ...response,
      processingTimeMs: processingTime,
      timestamp: new Date().toISOString(),
    });

    return new Response(JSON.stringify(response), {
      status: 200,
      headers,
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error('💥 Erreur during polling YouTube:', error);
    console.error('⏱️  Temps avant échec:', processingTime + 'ms');

    // Tenter de récupérer des informations de debug
    let debugInfo: { activeUsers?: number; totalUsers?: number; processingTimeMs?: number } = {};
    try {
      const stats = await databaseService.getStats();
      debugInfo = {
        activeUsers: stats.activeUsers,
        totalUsers: stats.totalUsers,
        processingTimeMs: processingTime,
      };
    } catch (debugError) {
      console.error('Impossible de récupérer les stats de debug:', debugError);
    }

    const errorResponse: ErrorResponse = {
      error: 'Erreur lors du polling YouTube',
      code: 'POLLING_FAILED',
      details: {
        ...debugInfo,
        originalError: process.env.NODE_ENV === 'development' ? 
          (error instanceof Error ? error.message : String(error)) : undefined,
      },
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers,
    });
  }
};

export const config = {
  path: "/api/youtube/poll-likes",
};