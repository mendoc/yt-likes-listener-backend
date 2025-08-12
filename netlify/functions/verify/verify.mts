/**
 * Endpoint d'authentification /api/auth/verify
 * Vérification des tokens Firebase et synchronisation utilisateur
 */

import { validateConfig } from '../../../common/config';
import { AuthVerifyRequest, AuthVerifyResponse, ErrorResponse } from '../../../common/types';
import { AuthService } from '../../../services/AuthService';

// Validation de la configuration au démarrage
try {
  validateConfig();
} catch (error) {
  console.error('Configuration invalide:', error);
}

const authService = AuthService.getInstance();

/**
 * Handler principal pour l'endpoint /api/auth/verify
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

  try {
    // Parser le body de la requête
    let body: AuthVerifyRequest;
    try {
      body = await request.json() as AuthVerifyRequest;
    } catch (parseError) {
      const error: ErrorResponse = {
        error: 'Corps de requête JSON invalide',
        code: 'INVALID_JSON',
      };
      return new Response(JSON.stringify(error), {
        status: 400,
        headers,
      });
    }

    // Valider les paramètres requis
    if (!body.firebaseToken) {
      const error: ErrorResponse = {
        error: 'Token Firebase manquant dans la requête',
        code: 'MISSING_FIREBASE_TOKEN',
      };
      return new Response(JSON.stringify(error), {
        status: 400,
        headers,
      });
    }

    // Log de la requête (sans exposer le token)
    console.log('Requête auth/verify reçue:', {
      hasToken: !!body.firebaseToken,
      tokenLength: body.firebaseToken.length,
      timestamp: new Date().toISOString(),
    });

    // Processus de vérification et synchronisation
    const verificationResult = await authService.verifyAndSyncUser(
      body.firebaseToken, 
      undefined, // fcmToken sera dans un endpoint séparé
      body.youtubeRefreshToken
    );

    if (!verificationResult.success) {
      let statusCode = 401; // Unauthorized par défaut
      let errorCode = 'AUTH_FAILED';

      // Déterminer le code de statut approprié
      if (verificationResult.hasYouTubePermissions === false) {
        statusCode = 403; // Forbidden
        errorCode = 'YOUTUBE_PERMISSIONS_MISSING';
      } else if (verificationResult.error?.includes('expiré')) {
        statusCode = 401;
        errorCode = 'TOKEN_EXPIRED';
      } else if (verificationResult.error?.includes('invalide')) {
        statusCode = 401;
        errorCode = 'INVALID_TOKEN';
      }

      const error: ErrorResponse = {
        error: verificationResult.error || 'Échec de l\'authentification',
        code: errorCode,
      };

      console.warn('Échec authentification:', {
        error: verificationResult.error,
        hasYouTubePermissions: verificationResult.hasYouTubePermissions,
      });

      return new Response(JSON.stringify(error), {
        status: statusCode,
        headers,
      });
    }

    // Succès - construire la réponse
    const user = verificationResult.user!;
    const response: AuthVerifyResponse = {
      success: true,
      userId: user.userId,
      youtubeChannelId: undefined, // À implémenter si nécessaire
    };

    console.log('Authentification réussie:', {
      userId: user.userId,
      email: user.email,
      isActive: user.isActive,
      hasFCMToken: !!user.fcmToken,
    });

    return new Response(JSON.stringify(response), {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error('Erreur interne auth/verify:', error);

    const errorResponse: ErrorResponse = {
      error: 'Erreur interne du serveur',
      code: 'INTERNAL_SERVER_ERROR',
      details: process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : String(error)) : undefined,
    };

    return new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers,
    });
  }
};

export const config = {
  path: "/api/auth/verify",
};