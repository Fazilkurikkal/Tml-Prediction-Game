/**
 * Firebase Client Setup with Graceful Sandbox Fallback
 */

import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, Firestore, doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

// Check if we are running with placeholder mock configurations
const isPlaceholderKey = !firebaseConfig.apiKey || firebaseConfig.apiKey.includes('MOCK_API_KEY_PLACEHOLDER');

let firebaseApp;
let db: Firestore | null = null;
let auth: Auth | null = null;
let isFirebaseSupported = false;

if (!isPlaceholderKey) {
  try {
    if (getApps().length === 0) {
      firebaseApp = initializeApp(firebaseConfig);
    } else {
      firebaseApp = getApp();
    }
    // Set up standard Services with standard robust caching
    db = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);
    auth = getAuth(firebaseApp);
    isFirebaseSupported = true;
    
    // Validate connection to Firestore as requested by regulations
    const testConnection = async () => {
      try {
        if (db) {
          const docRef = doc(db, 'test', 'connection');
          await getDocFromServer(docRef).catch(err => {
            console.warn("Firebase doc fetch offline / warning:", err);
          });
        }
      } catch (error) {
        console.warn("Firebase client offline warning safely caught:", error);
      }
    };
    testConnection().catch(err => {
      console.warn("Firebase connection tester promise warning caught:", err);
    });
  } catch (error) {
    console.error("Firebase failed to initialize. Falling back to Local Sandbox mode.", error);
    isFirebaseSupported = false;
    db = null;
    auth = null;
  }
} else {
  console.log("Using local sandbox mode. Setup Firebase via the AI Studio UI to sync to the cloud.");
}

/**
 * Standardized error handling wrapper for Firestore exceptions.
 * Throws a JSON string conforming strictly to the FirestoreErrorInfo schema.
 */
export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || null,
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || null,
      isAnonymous: auth?.currentUser?.isAnonymous || null,
      tenantId: auth?.currentUser?.tenantId || null,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  
  console.error('Firestore Hardened Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export { db, auth, isFirebaseSupported };
