export function getRedirectPathForUser(user) {
  if (!user) return '/login';
  if (user.role === 'ADMIN' || user.role === 'SALES_MANAGER') return '/products';
  if (user.role === 'SALES_REP') return '/quotations';
  if (user.role === 'FINANCE') return '/approvals';
  if (user.role === 'CUSTOMER') return `/portal/${user.portalToken || 'demo-portal-token-acme'}`;
  return '/dashboard';
}
