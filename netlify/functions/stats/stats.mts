/**
 * Endpoint de statistiques /api/stats
 * Fournit des statistiques sur l'utilisation du système
 */

import { DatabaseService } from '../../../services/DatabaseService';
import { FCMService } from '../../../services/FCMService';
import { YouTubeService } from '../../../services/YouTubeService';
import { corsHeaders, withErrorHandling, validateHttpMethod, handleOptionsRequest } from '../../../common/responseHelpers';

export default async (request: Request): Promise<Response> => {
  return withErrorHandling('stats', async () => {
    // Gérer les requêtes OPTIONS
    if (request.method === 'OPTIONS') {
      return handleOptionsRequest();
    }

    // Valider la méthode HTTP
    const methodError = validateHttpMethod(request, ['GET']);
    if (methodError) return methodError;

    console.log('📊 Récupération des statistiques système');

    const [databaseStats, fcmStats, youtubeStats] = await Promise.all([
      DatabaseService.getInstance().getStats(),
      FCMService.getInstance().getFCMStats(),
      YouTubeService.getInstance().getAPIQuotaStats(),
    ]);

    const stats = {
      timestamp: new Date().toISOString(),
      database: {
        totalUsers: databaseStats.totalUsers,
        activeUsers: databaseStats.activeUsers,
        totalDownloads: databaseStats.totalDownloads,
        inactiveUsers: databaseStats.totalUsers - databaseStats.activeUsers,
      },
      fcm: {
        totalSent: fcmStats.totalSent,
        successfulSent: fcmStats.successfulSent,
        failedSent: fcmStats.failedSent,
        activeTokens: fcmStats.activeTokens,
        successRate: fcmStats.totalSent > 0 ? 
          Math.round((fcmStats.successfulSent / fcmStats.totalSent) * 100) : 0,
      },
      youtube: {
        estimatedDailyUsage: youtubeStats.estimatedDailyUsage,
        remainingQuota: youtubeStats.remainingQuota,
        quotaUsagePercent: Math.round(
          (youtubeStats.estimatedDailyUsage / 10000) * 100
        ),
      },
      system: {
        uptime: process.uptime ? Math.floor(process.uptime()) : 'N/A',
        nodeVersion: process.version,
        platform: process.platform,
        environment: process.env.NODE_ENV || 'unknown',
      },
    };

    console.log('✅ Statistiques récupérées avec succès');

    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: corsHeaders,
    });
  });
};

export const config = {
  path: "/api/stats",
};