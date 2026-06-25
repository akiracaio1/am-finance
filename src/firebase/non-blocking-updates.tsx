
'use client';
    
import {
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  getFirestore,
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
 * O log é gravado na subcoleção do próprio usuário.
 */
function logActivity(action: 'CREATE' | 'UPDATE' | 'DELETE', path: string, data: any) {
  const auth = getAuth();
  const user = auth.currentUser;
  if (!user) return;

  const pathParts = path.split('/');
  const entityType = pathParts[pathParts.length - 2] || 'unknown';
  const entityId = pathParts[pathParts.length - 1] || 'unknown';
  
  if (entityType === 'auditLogs') return;

  const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const db = getFirestore();
  const logRef = doc(db, "users", user.uid, "auditLogs", logId);

  const description = data?.description || data?.name || data?.customerName || entityId;
  
  const logData = {
    id: logId,
    userId: user.uid,
    userEmail: user.email || 'N/A',
    action,
    entityType,
    entityId,
    description: `${action === 'CREATE' ? 'Criou' : action === 'UPDATE' ? 'Editou' : 'Excluiu'} em ${entityType}: ${description}`,
    timestamp: new Date().toISOString(),
    details: data || {} // Salva o snapshot dos dados para auditoria detalhada
  };

  setDoc(logRef, logData).catch(() => {
    // Falha silenciosa no log para não travar a operação principal
  });
}

/**
 * Executa um setDoc de forma não-bloqueante com registro de auditoria.
 */
export function setDocumentNonBlocking(docRef: DocumentReference, data: any, options?: SetOptions) {
  const isCreate = !options || !('merge' in options);
  setDoc(docRef, data, options || {})
    .then(() => logActivity(isCreate ? 'CREATE' : 'UPDATE', docRef.path, data))
    .catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: docRef.path,
          operation: 'write',
          requestResourceData: data,
        })
      );
    });
}

/**
 * Executa um addDoc de forma não-bloqueante com registro de auditoria.
 */
export function addDocumentNonBlocking(colRef: CollectionReference, data: any) {
  return addDoc(colRef, data)
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
      );
    });
}

/**
 * Executa um updateDoc de forma não-bloqueante com registro de auditoria.
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
      );
    });
}

/**
 * Executa um deleteDoc de forma não-bloqueante com registro de auditoria.
 * Aceita opcionalmente os dados que estão sendo excluídos para manter no log.
 */
export function deleteDocumentNonBlocking(docRef: DocumentReference, dataForLog?: any) {
  deleteDoc(docRef)
    .then(() => logActivity('DELETE', docRef.path, dataForLog || { info: 'Item removido' }))
    .catch(error => {
      errorEmitter.emit(
        'permission-error',
        new FirestorePermissionError({
          path: docRef.path,
          operation: 'delete',
        })
      );
    });
}
