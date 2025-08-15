/**
 * Service d'authentification pour YT-Likes-Listener
 */

import admin from 'firebase-admin';
import { google } from 'googleapis';
import { googleAuthConfig } from '../common/config';
import { DatabaseService } from './DatabaseService';
import { User } from '../common/types';

export interface DecodedToken {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
  firebase: {
    identities: { [provider: string]: unknown };
    sign_in_provider: string;
  };
}

export class AuthService {
  private static instance: AuthService;
  private databaseService: DatabaseService;

  private constructor() {
    // DatabaseService va initialiser Firebase, donc on l'instancie en premier
    this.databaseService = DatabaseService.getInstance();
  }

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Vérifier et décoder un token Firebase
   */
  async verifyFirebaseToken(idToken: string): Promise<DecodedToken> {
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      console.log(`Token vérifié pour l'utilisateur: ${decodedToken.uid}`);
      return decodedToken as DecodedToken;
    } catch (error) {
      console.error('Erreur vérification token Firebase:', error);
      throw new Error('Token Firebase invalide ou expiré');
    }
  }

  /**
   * Échanger un serverAuthCode contre un refresh token YouTube
   */
  async exchangeServerAuthCodeForRefreshToken(serverAuthCode: string): Promise<string> {
    try {
      console.log('Échange du serverAuthCode contre un refresh token');
      
      const oauth2Client = new google.auth.OAuth2(
        googleAuthConfig.clientId,
        googleAuthConfig.clientSecret
        // Pas de redirect URI pour l'échange de serverAuthCode mobile
      );

      // Échanger le code contre des tokens
      const response = await oauth2Client.getToken(serverAuthCode);
      const tokens = response.tokens;
      
      if (!tokens.refresh_token) {
        throw new Error('Aucun refresh token reçu de Google');
      }

      console.log('Refresh token obtenu avec succès');
      return tokens.refresh_token;
      
    } catch (error) {
      console.error('Erreur échange serverAuthCode:', error);
      throw new Error('Impossible d\'échanger le serverAuthCode contre un refresh token');
    }
  }

  /**
   * Synchroniser l'utilisateur avec la base de données
   */
  async syncUserWithDatabase(decodedToken: DecodedToken, fcmToken?: string, youtubeRefreshToken?: string): Promise<User> {
    try {
      const userId = decodedToken.uid;
      
      // Vérifier si l'utilisateur existe déjà
      let existingUser = await this.databaseService.getUser(userId);
      
      const userData: Partial<User> & { userId: string } = {
        userId,
        email: decodedToken.email || existingUser?.email || '',
        displayName: decodedToken.name || existingUser?.displayName || '',
        fcmToken: fcmToken || existingUser?.fcmToken || '',
        isActive: true,
        lastSyncTimestamp: existingUser?.lastSyncTimestamp || new Date(0),
        youtubeRefreshToken: youtubeRefreshToken || existingUser?.youtubeRefreshToken,
      };

      // Créer ou mettre à jour l'utilisateur
      await this.databaseService.createOrUpdateUser(userData);
      
      // Récupérer l'utilisateur mis à jour
      const user = await this.databaseService.getUser(userId);
      if (!user) {
        throw new Error('Impossible de récupérer l\'utilisateur après synchronisation');
      }

      console.log(`Utilisateur synchronisé: ${user.email}`);
      return user;
    } catch (error) {
      console.error('Erreur synchronisation utilisateur:', error);
      throw new Error('Échec de la synchronisation utilisateur');
    }
  }

  /**
   * Vérifier si l'utilisateur a les permissions YouTube nécessaires
   */
  async hasYouTubePermissions(decodedToken: DecodedToken): Promise<boolean> {
    try {
      // Vérifier que l'utilisateur s'est connecté avec Google
      const isGoogleProvider = decodedToken.firebase.sign_in_provider === 'google.com' ||
        (decodedToken.firebase.identities && 
         decodedToken.firebase.identities['google.com']);

      if (!isGoogleProvider) {
        console.warn(`Utilisateur ${decodedToken.uid} non connecté via Google`);
        return false;
      }

      // Dans un environnement réel, on vérifierait ici les scopes OAuth
      // Pour l'instant, on assume que l'app mobile a déjà obtenu les permissions nécessaires
      console.log(`Permissions YouTube vérifiées pour ${decodedToken.uid}`);
      return true;
    } catch (error) {
      console.error('Erreur vérification permissions YouTube:', error);
      return false;
    }
  }

  /**
   * Désactiver un utilisateur
   */
  async deactivateUser(userId: string): Promise<void> {
    try {
      await this.databaseService.createOrUpdateUser({
        userId,
        isActive: false,
      });
      console.log(`Utilisateur désactivé: ${userId}`);
    } catch (error) {
      console.error('Erreur désactivation utilisateur:', error);
      throw new Error('Impossible de désactiver l\'utilisateur');
    }
  }

  /**
   * Mettre à jour le token FCM d'un utilisateur
   */
  async updateFCMToken(userId: string, fcmToken: string): Promise<void> {
    try {
      await this.databaseService.createOrUpdateUser({
        userId,
        fcmToken,
      });
      console.log(`Token FCM mis à jour pour ${userId}`);
    } catch (error) {
      console.error('Erreur mise à jour token FCM:', error);
      throw new Error('Impossible de mettre à jour le token FCM');
    }
  }

  /**
   * Vérifier si un utilisateur existe et est actif
   */
  async isUserActiveAndValid(userId: string): Promise<boolean> {
    try {
      const user = await this.databaseService.getUser(userId);
      return user !== null && user.isActive && user.fcmToken.length > 0;
    } catch (error) {
      console.error('Erreur vérification utilisateur actif:', error);
      return false;
    }
  }

  /**
   * Obtenir les informations d'un utilisateur Firebase
   */
  async getUserRecord(userId: string): Promise<admin.auth.UserRecord | null> {
    try {
      const userRecord = await admin.auth().getUser(userId);
      return userRecord;
    } catch (error) {
      console.error('Erreur récupération enregistrement utilisateur:', error);
      return null;
    }
  }

  /**
   * Processus complet de vérification et synchronisation
   */
  async verifyAndSyncUser(idToken: string, fcmToken?: string, youtubeServerAuthCode?: string): Promise<{
    success: boolean;
    user?: User;
    hasYouTubePermissions?: boolean;
    error?: string;
  }> {
    try {
      // Étape 1: Vérifier le token Firebase
      const decodedToken = await this.verifyFirebaseToken(idToken);
      
      // Étape 2: Vérifier les permissions YouTube
      const hasPermissions = await this.hasYouTubePermissions(decodedToken);
      
      if (!hasPermissions) {
        return {
          success: false,
          hasYouTubePermissions: false,
          error: 'Permissions YouTube manquantes'
        };
      }
      
      // Étape 3: Échanger le serverAuthCode contre un refresh token si fourni
      let youtubeRefreshToken: string | undefined;
      if (youtubeServerAuthCode) {
        try {
          youtubeRefreshToken = await this.exchangeServerAuthCodeForRefreshToken(youtubeServerAuthCode);
          console.log('✅ ServerAuthCode échangé avec succès');
        } catch (error) {
          console.warn('⚠️ Impossible d\'échanger le serverAuthCode:', error);
          // On continue sans refresh token plutôt que d'échouer complètement
        }
      }
      
      // Étape 4: Synchroniser avec la base de données
      const user = await this.syncUserWithDatabase(decodedToken, fcmToken, youtubeRefreshToken);
      
      // Vérifier que l'utilisateur a un refresh token YouTube
      if (!user.youtubeRefreshToken) {
        return {
          success: false,
          hasYouTubePermissions: false,
          error: 'Refresh token YouTube manquant'
        };
      }
      
      return {
        success: true,
        user,
        hasYouTubePermissions: true,
      };
    } catch (error) {
      console.error('Erreur processus vérification complète:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue',
      };
    }
  }
}