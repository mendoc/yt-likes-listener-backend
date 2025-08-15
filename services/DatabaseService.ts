/**
 * Service de base de données Firebase pour YT-Likes-Listener
 */

import admin from 'firebase-admin';
import { firebaseConfig } from '../common/config';
import { User, Download, DownloadStatus } from '../common/types';

export class DatabaseService {
  private static instance: DatabaseService;
  private db: FirebaseFirestore.Firestore;

  private constructor() {
    this.initializeFirebase();
    this.db = admin.firestore();
  }

  public static getInstance(): DatabaseService {
    if (!DatabaseService.instance) {
      DatabaseService.instance = new DatabaseService();
    }
    return DatabaseService.instance;
  }

  private initializeFirebase(): void {
    if (!admin.apps.length) {
      try {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId: firebaseConfig.projectId,
            privateKey: firebaseConfig.privateKey,
            clientEmail: firebaseConfig.clientEmail,
          }),
          projectId: firebaseConfig.projectId,
        });
        console.log('Firebase Admin initialisé avec succès');
      } catch (error) {
        console.error('Erreur initialisation Firebase Admin:', error);
        throw new Error('Échec de l\'initialisation Firebase Admin');
      }
    }
  }

  // Gestion des utilisateurs
  async getUser(userId: string): Promise<User | null> {
    try {
      const doc = await this.db.collection('users').doc(userId).collection('profile').doc('data').get();
      if (!doc.exists) {
        return null;
      }
      
      const data = doc.data();
      return {
        userId: userId,
        email: data?.email || '',
        displayName: data?.displayName || '',
        fcmToken: data?.fcmToken || '',
        lastSyncTimestamp: data?.lastSyncTimestamp?.toDate() || new Date(0),
        isActive: data?.isActive !== false, // true par défaut
        youtubeRefreshToken: data?.youtubeRefreshToken || undefined,
      };
    } catch (error) {
      console.error('Erreur récupération utilisateur:', error);
      throw new Error('Impossible de récupérer l\'utilisateur');
    }
  }

  async createOrUpdateUser(user: Partial<User> & { userId: string }): Promise<void> {
    try {
      const userRef = this.db.collection('users').doc(user.userId).collection('profile').doc('data');
      
      const updateData: Partial<User> & { lastSyncTimestamp?: Date } = {
        ...user,
        lastSyncTimestamp: user.lastSyncTimestamp ? 
          user.lastSyncTimestamp :
          new Date(),
      };

      await userRef.set(updateData, { merge: true });
      console.log(`Utilisateur ${user.userId} mis à jour`);
    } catch (error) {
      console.error('Erreur sauvegarde utilisateur:', error);
      throw new Error('Impossible de sauvegarder l\'utilisateur');
    }
  }

  async getAllActiveUsers(): Promise<User[]> {
    try {
      // Avec la structure imbriquée, nous devons lister tous les documents utilisateurs
      // Utiliser listDocuments() pour inclure les documents sans champs directs
      const userRefs = await this.db.collection('users').listDocuments();
      console.log(`📊 Trouvé ${userRefs.length} références utilisateurs dans la collection 'users'`);
      
      const users: User[] = [];
      
      for (const userRef of userRefs) {
        const profileDoc = await userRef.collection('profile').doc('data').get();
        if (profileDoc.exists) {
          const data = profileDoc.data();
          // Considérer l'utilisateur comme actif par défaut si isActive n'est pas défini
          const isActive = data?.isActive !== false; // true par défaut, false seulement si explicitement défini à false
          if (isActive) {
            users.push({
              userId: userRef.id,
              email: data?.email || '',
              displayName: data?.displayName || '',
              fcmToken: data?.fcmToken || '',
              lastSyncTimestamp: data?.lastSyncTimestamp?.toDate() || new Date(0),
              isActive: isActive,
              youtubeRefreshToken: data?.youtubeRefreshToken || undefined,
            });
          }
        }
      }

      return users;
    } catch (error) {
      console.error('Erreur récupération utilisateurs actifs:', error);
      throw new Error('Impossible de récupérer les utilisateurs actifs');
    }
  }

  async updateUserSyncTimestamp(userId: string, timestamp: Date): Promise<void> {
    try {
      await this.db.collection('users').doc(userId).collection('profile').doc('data').update({
        lastSyncTimestamp: admin.firestore.Timestamp.fromDate(timestamp),
      });
    } catch (error) {
      console.error('Erreur mise à jour timestamp:', error);
      throw new Error('Impossible de mettre à jour le timestamp');
    }
  }

  // Gestion des téléchargements
  async getDownload(userId: string, videoId: string): Promise<Download | null> {
    try {
      const doc = await this.db
        .collection('downloads')
        .where('userId', '==', userId)
        .where('videoId', '==', videoId)
        .limit(1)
        .get();

      if (doc.empty) {
        return null;
      }

      const data = doc.docs[0].data();
      return {
        userId: data.userId,
        videoId: data.videoId,
        title: data.title || '',
        status: data.status as DownloadStatus,
        downloadPath: data.downloadPath,
        timestamp: data.timestamp?.toDate() || new Date(),
      };
    } catch (error) {
      console.error('Erreur récupération téléchargement:', error);
      throw new Error('Impossible de récupérer le téléchargement');
    }
  }

  async createDownload(download: Download): Promise<void> {
    try {
      await this.db.collection('downloads').add({
        ...download,
        timestamp: admin.firestore.Timestamp.fromDate(download.timestamp),
      });
      console.log(`Téléchargement créé: ${download.videoId} pour ${download.userId}`);
    } catch (error) {
      console.error('Erreur création téléchargement:', error);
      throw new Error('Impossible de créer le téléchargement');
    }
  }

  async updateDownloadStatus(
    userId: string, 
    videoId: string, 
    status: DownloadStatus,
    downloadPath?: string
  ): Promise<void> {
    try {
      const snapshot = await this.db
        .collection('downloads')
        .where('userId', '==', userId)
        .where('videoId', '==', videoId)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const updateData: Partial<Download> = { status };
        if (downloadPath) {
          updateData.downloadPath = downloadPath;
        }
        
        await doc.ref.update(updateData);
        console.log(`Status téléchargement mis à jour: ${videoId} -> ${status}`);
      }
    } catch (error) {
      console.error('Erreur mise à jour status téléchargement:', error);
      throw new Error('Impossible de mettre à jour le status');
    }
  }

  async getDownloadsByStatus(status: DownloadStatus): Promise<Download[]> {
    try {
      const snapshot = await this.db
        .collection('downloads')
        .where('status', '==', status)
        .get();

      const downloads: Download[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        downloads.push({
          userId: data.userId,
          videoId: data.videoId,
          title: data.title || '',
          status: data.status as DownloadStatus,
          downloadPath: data.downloadPath,
          timestamp: data.timestamp?.toDate() || new Date(),
        });
      });

      return downloads;
    } catch (error) {
      console.error('Erreur récupération téléchargements par status:', error);
      throw new Error('Impossible de récupérer les téléchargements');
    }
  }

  // Statistiques
  async getStats(): Promise<{ totalUsers: number; activeUsers: number; totalDownloads: number }> {
    try {
      const [userRefs, downloadsSnapshot] = await Promise.all([
        this.db.collection('users').listDocuments(),
        this.db.collection('downloads').get(),
      ]);

      // Compter les utilisateurs actifs avec la structure imbriquée
      let activeUsers = 0;
      for (const userRef of userRefs) {
        const profileDoc = await userRef.collection('profile').doc('data').get();
        if (profileDoc.exists) {
          const data = profileDoc.data();
          // Considérer l'utilisateur comme actif par défaut si isActive n'est pas défini
          const isActive = data?.isActive !== false;
          if (isActive) {
            activeUsers++;
          }
        }
      }

      return {
        totalUsers: userRefs.length,
        activeUsers,
        totalDownloads: downloadsSnapshot.size,
      };
    } catch (error) {
      console.error('Erreur récupération statistiques:', error);
      return { totalUsers: 0, activeUsers: 0, totalDownloads: 0 };
    }
  }
}