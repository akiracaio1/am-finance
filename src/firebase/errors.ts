
export type SecurityRuleContext = {
  path: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete' | 'write';
  requestResourceData?: any;
};

export class FirestorePermissionError extends Error {
  context: SecurityRuleContext;

  constructor(context: SecurityRuleContext) {
    super(`Erro de Permissão no Firestore: A operação '${context.operation}' em '${context.path}' foi negada.`);
    this.name = 'FirestorePermissionError';
    this.context = context;
  }
}
