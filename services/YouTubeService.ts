/**
 * Service YouTube API pour YT-Likes-Listener
 */

import { google, youtube_v3 } from 'googleapis';
import { youtubeConfig, youtubeLimits } from '../common/config';
import { User } from '../common/types';
import { DatabaseService } from './DatabaseService';

export interface YouTubeLikedVideo {
  videoId: string;
  title: string;
  duration?: string;
  publishedAt?: string;
  channelTitle?: string;
  thumbnailUrl?: string;
  isShort?: boolean;
}

export class YouTubeService {
  private static instance: YouTubeService;
  private youtube: youtube_v3.Youtube;
  private databaseService: DatabaseService;

  private constructor() {
    this.youtube = google.youtube({
      version: 'v3',
      auth: youtubeConfig.apiKey,
    });
    this.databaseService = DatabaseService.getInstance();
  }

  public static getInstance(): YouTubeService {
    if (!YouTubeService.instance) {
      YouTubeService.instance = new YouTubeService();
    }
    return YouTubeService.instance;
  }

  /**
   * Convertir la durée ISO 8601 en secondes
   */
  private parseDuration(duration: string): number {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;

    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0'); 
    const seconds = parseInt(match[3] || '0');

    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Vérifier si une vidéo est un YouTube Short (< 60 secondes)
   */
  private isYouTubeShort(duration: string): boolean {
    const durationInSeconds = this.parseDuration(duration);
    return durationInSeconds <= 60;
  }

  /**
   * Vérifier si une vidéo dépasse 6 minutes
   */
  private isVideoTooLong(duration: string): boolean {
    const durationInSeconds = this.parseDuration(duration);
    return durationInSeconds > 360; // 6 minutes
  }

  /**
   * Récupérer les détails d'une ou plusieurs vidéos
   */
  async getVideoDetails(videoIds: string[]): Promise<YouTubeLikedVideo[]> {
    try {
      if (videoIds.length === 0) return [];

      // Limiter à 50 vidéos par requête (limite API YouTube)
      const chunkedIds = this.chunkArray(videoIds, youtubeLimits.maxVideosPerRequest);
      const allVideos: YouTubeLikedVideo[] = [];

      for (const chunk of chunkedIds) {
        const response = await this.youtube.videos.list({
          part: ['snippet', 'contentDetails'],
          id: chunk,
        });

        if (response.data.items) {
          for (const item of response.data.items) {
            const video: YouTubeLikedVideo = {
              videoId: item.id!,
              title: item.snippet?.title || 'Titre inconnu',
              duration: item.contentDetails?.duration || undefined,
              publishedAt: item.snippet?.publishedAt || undefined,
              channelTitle: item.snippet?.channelTitle || undefined,
              thumbnailUrl: item.snippet?.thumbnails?.medium?.url || 
                          item.snippet?.thumbnails?.default?.url || undefined,
              isShort: item.contentDetails?.duration ? 
                      this.isYouTubeShort(item.contentDetails.duration) : false,
            };
            allVideos.push(video);
          }
        }
      }

      return allVideos;
    } catch (error) {
      console.error('Erreur récupération détails vidéos:', error);
      throw new Error('Impossible de récupérer les détails des vidéos');
    }
  }

  /**
   * Filtrer les vidéos selon les règles de gestion
   */
  private filterValidVideos(videos: YouTubeLikedVideo[]): YouTubeLikedVideo[] {
    return videos.filter(video => {
      // Ignorer les shorts
      if (video.isShort) {
        console.log(`Vidéo ignorée (Short): ${video.title}`);
        return false;
      }

      // Ignorer les vidéos de plus de 6 minutes
      if (video.duration && this.isVideoTooLong(video.duration)) {
        console.log(`Vidéo ignorée (trop longue): ${video.title}`);
        return false;
      }

      return true;
    });
  }

  /**
   * Vérifier les nouveaux likes pour un utilisateur via l'API YouTube
   * Note: Cette fonction simule l'appel à l'API "Liked Videos" qui nécessite OAuth
   */
  async checkNewLikesForUser(user: User): Promise<YouTubeLikedVideo[]> {
    try {
      console.log(`Vérification des likes pour ${user.email}`);

      // IMPORTANT: Dans un environnement réel, cette fonction devrait :
      // 1. Utiliser le refresh token de l'utilisateur pour obtenir un access token
      // 2. Faire l'appel à l'API YouTube avec les credentials de l'utilisateur
      // 3. Récupérer uniquement les likes depuis lastSyncTimestamp
      
      // Pour la simulation, nous retournons une liste vide
      // En production, le code ressemblerait à :
      /*
      const oauth2Client = new google.auth.OAuth2();
      oauth2Client.setCredentials({
        access_token: await this.getAccessTokenFromRefreshToken(user.refreshToken),
      });

      const youtubeWithAuth = google.youtube({
        version: 'v3',
        auth: oauth2Client,
      });

      const response = await youtubeWithAuth.videos.list({
        part: ['snippet', 'contentDetails'],
        myRating: 'like',
        maxResults: 50,
      });
      */

      // Pour le développement, retourner une liste vide
      console.log(`Simulation: aucun nouveau like trouvé pour ${user.email}`);
      return [];

    } catch (error) {
      console.error(`Erreur vérification likes pour ${user.email}:`, error);
      return [];
    }
  }

  /**
   * Vérifier les nouveaux likes pour tous les utilisateurs actifs
   */
  async checkAllUsersForNewLikes(): Promise<{
    usersChecked: number;
    totalNewLikes: number;
    newLikesByUser: Map<string, YouTubeLikedVideo[]>;
  }> {
    try {
      const activeUsers = await this.databaseService.getAllActiveUsers();
      console.log(`Vérification de ${activeUsers.length} utilisateurs actifs`);

      const newLikesByUser = new Map<string, YouTubeLikedVideo[]>();
      let totalNewLikes = 0;

      for (const user of activeUsers) {
        try {
          // Vérifier les nouveaux likes pour cet utilisateur
          const newLikes = await this.checkNewLikesForUser(user);
          
          if (newLikes.length > 0) {
            // Filtrer selon les règles de gestion
            const validLikes = this.filterValidVideos(newLikes);
            
            // Vérifier que les vidéos ne sont pas déjà téléchargées
            const uniqueLikes: YouTubeLikedVideo[] = [];
            for (const like of validLikes) {
              const existingDownload = await this.databaseService.getDownload(
                user.userId, 
                like.videoId
              );
              if (!existingDownload) {
                uniqueLikes.push(like);
              }
            }

            if (uniqueLikes.length > 0) {
              newLikesByUser.set(user.userId, uniqueLikes);
              totalNewLikes += uniqueLikes.length;

              // Créer les entrées de téléchargement en statut "pending"
              for (const like of uniqueLikes) {
                await this.databaseService.createDownload({
                  userId: user.userId,
                  videoId: like.videoId,
                  title: like.title,
                  status: 'pending',
                  timestamp: new Date(),
                });
              }
            }

            // Mettre à jour le timestamp de synchronisation
            await this.databaseService.updateUserSyncTimestamp(user.userId, new Date());
          }
        } catch (error) {
          console.error(`Erreur traitement utilisateur ${user.email}:`, error);
        }
      }

      console.log(`Polling terminé: ${totalNewLikes} nouveaux likes pour ${newLikesByUser.size} utilisateurs`);

      return {
        usersChecked: activeUsers.length,
        totalNewLikes,
        newLikesByUser,
      };
    } catch (error) {
      console.error('Erreur polling général:', error);
      throw new Error('Échec du polling YouTube');
    }
  }

  /**
   * Obtenir les statistiques d'usage de l'API YouTube
   */
  async getAPIQuotaStats(): Promise<{
    estimatedDailyUsage: number;
    remainingQuota: number;
  }> {
    // Cette fonction simule le tracking de quota
    // En production, il faudrait implémenter un vrai tracking
    return {
      estimatedDailyUsage: 0,
      remainingQuota: youtubeLimits.dailyQuotaLimit,
    };
  }

  /**
   * Utilitaire pour diviser un array en chunks
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Valider qu'une vidéo YouTube existe et est accessible
   */
  async validateVideo(videoId: string): Promise<boolean> {
    try {
      const response = await this.youtube.videos.list({
        part: ['id'],
        id: [videoId],
      });

      return !!(response.data.items && response.data.items.length > 0);
    } catch (error) {
      console.error(`Erreur validation vidéo ${videoId}:`, error);
      return false;
    }
  }
}