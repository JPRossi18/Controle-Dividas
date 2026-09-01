import type { DebtPaymentMethod, DebtPaymentStatus, DebtRole } from "@prisma/client";

export const PAYMENT_METHOD_LABELS: Record<DebtPaymentMethod, string> = {
  PIX: "PIX",
  BANK_TRANSFER: "Transferência bancária",
  CASH: "Dinheiro",
  OTHER: "Outro",
};

export const PAYMENT_METHODS = Object.keys(PAYMENT_METHOD_LABELS) as DebtPaymentMethod[];

export const PAYMENT_STATUS_LABELS: Record<DebtPaymentStatus, string> = {
  PENDING: "Aguardando confirmação",
  CONFIRMED: "Confirmado",
  DISPUTED: "Contestado",
  CANCELED: "Cancelado",
};

export const ROLE_LABELS: Record<DebtRole, string> = {
  DEBTOR: "Devedor",
  CREDITOR: "Credor",
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  "payment.create": "Pagamento registrado",
  "payment.update": "Pagamento editado",
  "payment.delete": "Pagamento excluído",
  "payment.confirm": "Pagamento confirmado",
  "payment.dispute": "Pagamento contestado",
  "payment.cancel": "Pagamento cancelado",
  "payment.reopen": "Pagamento reaberto",
  "receipt.upload": "Comprovante anexado",
  "receipt.delete": "Comprovante removido",
  "debt.update": "Dados da dívida alterados",
  "user.update": "Usuário alterado",
  "user.password": "Senha alterada",
  "auth.login": "Entrou na plataforma",
  "auth.logout": "Saiu da plataforma",
};

export function auditLabel(action: string): string {
  return AUDIT_ACTION_LABELS[action] ?? action;
}
