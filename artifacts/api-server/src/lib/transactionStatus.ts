export const TRANSACTION_STATUS = {
  COMPLETED: "completed",
  CANCELLED: "cancelled",
  REVERSED: "reversed",
} as const;

export type TransactionStatus = typeof TRANSACTION_STATUS[keyof typeof TRANSACTION_STATUS];

export function assertActiveTransaction(status: string): void {
  if (status !== TRANSACTION_STATUS.COMPLETED) {
    throw new Error(`Transaction is already ${status} and cannot be changed again`);
  }
}
