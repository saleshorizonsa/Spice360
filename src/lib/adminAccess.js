import { PLATFORM_OWNER_EMAIL, isPlatformOwnerEmail } from '@/lib/subscriptionPlans';

export const MATRIXSALES_FULL_ADMIN_EMAILS = [PLATFORM_OWNER_EMAIL];

export function isMatrixSalesAdminEmail(email, configuredEmails = '') {
  const envEmails = configuredEmails
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);

  return [...MATRIXSALES_FULL_ADMIN_EMAILS, ...envEmails].includes(email?.toLowerCase());
}

export function isMatrixSalesPlatformOwner(email) {
  return isPlatformOwnerEmail(email);
}
