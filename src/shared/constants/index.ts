const TABLES = {
  user: 'user',
  outbox_event: 'outbox_event',
  wallet: 'wallet',
  ledger_entry: 'ledger_entry',
  transaction: 'transaction',
  transfer: 'transfer',
};

enum UserRole {
  Admin = 'ADMIN',
  User = 'USER',
}

enum SupportedCurrency {
  EUR = 'EUR',
  USD = 'USD',
  GBP = 'GBP',
  NGN = 'NGN',
}

const DEFAULT_CURRENCY = SupportedCurrency.EUR;

export { TABLES, UserRole, SupportedCurrency, DEFAULT_CURRENCY };
