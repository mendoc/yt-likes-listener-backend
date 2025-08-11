/**
 * Utilitaires pour les réponses HTTP des fonctions Netlify
 */

import { ErrorResponse, ApiResponse } from './types';

/**
 * Headers CORS standard
 */
export const corsHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
};

/**
 * Créer une réponse de succès
 */
export function createSuccessResponse<T>(
  data: T,
  status: number = 200
): Response {
  const response: ApiResponse<T> = {
    success: true,
    data,
  };
  
  return new Response(JSON.stringify(response), {
    status,
    headers: corsHeaders,
  });
}

/**
 * Créer une réponse d'erreur
 */
export function createErrorResponse(
  message: string,
  status: number = 400,
  code?: string,
  details?: unknown
): Response {
  const error: ErrorResponse = {
    error: message,
    code,
    details,
  };
  
  return new Response(JSON.stringify(error), {
    status,
    headers: corsHeaders,
  });
}

/**
 * Gérer les requêtes OPTIONS (CORS preflight)
 */
export function handleOptionsRequest(): Response {
  return new Response(null, {
    status: 200,
    headers: corsHeaders,
  });
}

/**
 * Valider la méthode HTTP
 */
export function validateHttpMethod(
  request: Request,
  allowedMethods: string[]
): Response | null {
  if (!allowedMethods.includes(request.method)) {
    return createErrorResponse(
      `Méthode non autorisée. Utilisez: ${allowedMethods.join(', ')}`,
      405,
      'METHOD_NOT_ALLOWED'
    );
  }
  return null;
}

/**
 * Parser et valider le JSON du body
 */
export async function parseAndValidateJson<T>(
  request: Request,
  requiredFields?: (keyof T)[]
): Promise<{ data: T } | { error: Response }> {
  try {
    const data: T = await request.json() as T;
    
    // Valider les champs requis
    if (requiredFields) {
      const missingFields = requiredFields.filter(
        field => !(field in (data as object)) || (data as Record<string, unknown>)[field as string] === undefined
      );
      
      if (missingFields.length > 0) {
        return {
          error: createErrorResponse(
            `Champs manquants: ${missingFields.join(', ')}`,
            400,
            'MISSING_REQUIRED_FIELDS'
          ),
        };
      }
    }
    
    return { data };
  } catch (parseError) {
    return {
      error: createErrorResponse(
        'Corps de requête JSON invalide',
        400,
        'INVALID_JSON'
      ),
    };
  }
}

/**
 * Logger une requête avec les informations pertinentes
 */
export function logRequest(
  endpoint: string,
  request: Request,
  additionalData?: Record<string, unknown>
): void {
  console.log(`📨 ${endpoint} - ${request.method}`, {
    url: request.url,
    userAgent: request.headers.get('user-agent'),
    timestamp: new Date().toISOString(),
    ...additionalData,
  });
}

/**
 * Logger une réponse
 */
export function logResponse(
  endpoint: string,
  status: number,
  success: boolean,
  processingTime?: number
): void {
  const emoji = success ? '✅' : '❌';
  console.log(`${emoji} ${endpoint} - ${status}`, {
    success,
    status,
    processingTimeMs: processingTime,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Wrapper pour gérer les erreurs communes des fonctions Netlify
 */
export async function withErrorHandling(
  endpoint: string,
  handler: () => Promise<Response>
): Promise<Response> {
  const startTime = Date.now();
  
  try {
    const response = await handler();
    const processingTime = Date.now() - startTime;
    
    logResponse(endpoint, response.status, response.status < 400, processingTime);
    return response;
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    console.error(`💥 Erreur dans ${endpoint}:`, error);
    
    const errorResponse = createErrorResponse(
      'Erreur interne du serveur',
      500,
      'INTERNAL_SERVER_ERROR',
      process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : String(error)) : undefined
    );
    
    logResponse(endpoint, 500, false, processingTime);
    return errorResponse;
  }
}