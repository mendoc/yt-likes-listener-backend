/**
 * Endpoint de santé /api/health
 * Vérification du bon fonctionnement des services
 */

import { DatabaseService } from '../../../services/DatabaseService';
import { corsHeaders, withErrorHandling } from '../../../common/responseHelpers';

export default async (request: Request): Promise<Response> => {
  return withErrorHandling('health', async () => {
    // Gérer les requêtes OPTIONS
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    // Vérifier la méthode HTTP
    if (request.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Méthode non autorisée' }), {
        status: 405,
        headers: corsHeaders,
      });
    }

    const startTime = Date.now();
    
    // Vérifications de santé
    const healthChecks = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime ? Math.floor(process.uptime()) : 'N/A',
      environment: process.env.NODE_ENV || 'unknown',
      services: {} as {
        database?: {
          status: string;
          stats?: unknown;
          error?: string;
        };
        environment?: {
          status: string;
          missingVariables: string[];
        };
        responseTime?: {
          status: string;
          milliseconds: number;
        };
      },
    };

    // Test de la base de données
    try {
      const databaseService = DatabaseService.getInstance();
      const stats = await databaseService.getStats();
      healthChecks.services.database = {
        status: 'healthy',
        stats,
      };
    } catch (error) {
      healthChecks.services.database = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }

    // Test des variables d'environnement critiques
    const requiredEnvVars = [
      'FIREBASE_PROJECT_ID',
      'FIREBASE_CLIENT_EMAIL',
      'YOUTUBE_API_KEY',
    ];
    
    const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);
    healthChecks.services.environment = {
      status: missingEnvVars.length === 0 ? 'healthy' : 'unhealthy',
      missingVariables: missingEnvVars,
    };

    // Temps de réponse
    const responseTime = Date.now() - startTime;
    healthChecks.services.responseTime = {
      status: responseTime < 2000 ? 'healthy' : 'slow',
      milliseconds: responseTime,
    };

    // Déterminer le statut global
    type ServiceStatus = {
      status: string;
      [key: string]: unknown;
    };

    const allServicesHealthy = Object.values(healthChecks.services).every(
      (service: ServiceStatus) => service.status === 'healthy'
    );

    const overallStatus = allServicesHealthy ? 'healthy' : 'degraded';
    const statusCode = allServicesHealthy ? 200 : 503;

    const response = {
      status: overallStatus,
      ...healthChecks,
    };

    console.log('🏥 Health check:', { status: overallStatus, responseTime });

    return new Response(JSON.stringify(response), {
      status: statusCode,
      headers: corsHeaders,
    });
  });
};

export const config = {
  path: "/api/health",
};