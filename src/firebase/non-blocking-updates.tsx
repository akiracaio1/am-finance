
'use client';
    
import {
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  collection,
  doc,
  CollectionReference,
  DocumentReference,
  SetOptions,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * Grava um log de auditoria de forma assíncrona e não-bloqueante.
 */
function logActivity(action: 'CREATE' | 'UPDATE' | 'DELETE', path: string, data: any) {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) return;

  // Extrai o tipo de entidade do path (ex: /users/XYZ/suppliers/ABC -> suppliers)
  const pathParts = path.split('/');
  const entityType = pathParts[pathParts.length - 2] || 'unknown';
  const entityId = pathParts[pathParts.length - 1] || 'unknown';
  
  // Ignora logs de logs para evitar recursividade infinita
  if (entityType === 'auditLogs') return;

  const logId = `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
  const logRef = doc(collection(user.providerData[0]?.uid ? doc(doc(collection(user.auth.app.options as any, "users"), user.uid), "auditLogs") as any : any, "users", user.uid, "auditLogs"), logId);

  // Tentativa simplificada de gravar log
  const description = data?.description || data?.name || data?.customerName || entityId;
  
  const logData = {
    id: logId,
    userId: user.uid,
    userEmail: user.email || 'N/A',
    action,
    entityType,
    entityId,
    description: `${action} em ${entityType}: ${description}`,
    timestamp: new Date().toISOString()
  };

  // Gravação direta para evitar overhead
  setDoc(logRef, logData).catch(() => {});
}

/**
 * Initiates a setDoc operation for a document reference.
 * Does NOT await the write operation internally.
 */
export function setDocumentNonBlocking(docRef: DocumentReference, data: any, options: SetOptions) {
  const isCreate = !options || !('merge' in options);
  setDoc(docRef, data, options)
    .then(() => logActivity(isCreate ? 'CREATE' : 'UPDATE', docRef.path, data))
    .catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: docRef.path,
          operation: 'write',
          requestResourceData: data,
        })
      )
    });
}


/**
 * Initiates an addDoc operation for a collection reference.
 * Does NOT await the write operation internally.
 */
export function addDocumentNonBlocking(colRef: CollectionReference, data: any) {
  const promise = addDoc(colRef, data)
    .then((docRef) => {
      logActivity('CREATE', docRef.path, data);
      return docRef;
    })
    .catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: colRef.path,
          operation: 'create',
          requestResourceData: data,
        })
      )
    });
  return promise;
}


/**
 * Initiates an updateDoc operation for a document reference.
 * Does NOT await the write operation internally.
 */
export function updateDocumentNonBlocking(docRef: DocumentReference, data: any) {
  updateDoc(docRef, data)
    .then(() => logActivity('UPDATE', docRef.path, data))
    .catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: docRef.path,
          operation: 'update',
          requestResourceData: data,
        })
      )
    });
}


/**
 * Initiates a deleteDoc operation for a document reference.
 * Does NOT await the write operation internally.
 */
export function deleteDocumentNonBlocking(docRef: DocumentReference) {
  // Para delete, tentamos pegar o ID para o log antes de sumir
  deleteDoc(docRef)
    .then(() => logActivity('DELETE', docRef.path, { description: 'Item removido' }))
    .catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete',
        })
      )
    });
}
