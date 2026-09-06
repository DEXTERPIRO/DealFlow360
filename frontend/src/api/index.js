import api, { API_BASE_URL } from './client';

export const authAPI = {
  login: (d) => api.post('/auth/login', d),
  signup: (d) => api.post('/auth/signup', d),
  refresh: () => api.post('/auth/refresh'),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  magicLink: (email) => api.post('/auth/magic-link', { email }),
  verifyMagic: (token) => api.post('/auth/verify-magic', { token }),
};

export const productsAPI = {
  getAll: (params) => api.get('/products', { params }),
  getOne: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  getUpsells: (data) => api.post('/products/upsell-suggestions', data),
  getCategories: () => api.get('/products/categories/all'),
  createCategory: (d) => api.post('/products/categories', d),
  updateCategory: (id, d) => api.put(`/products/categories/${id}`, d),
  getPriceLists: (params) => api.get('/products/pricelists/all', { params }),
  createPriceList: (d) => api.post('/products/pricelists', d),
  addVariant: (productId, d) => api.post(`/products/${productId}/variants`, d),
  getDiscountTiers: () => api.get('/products/discount-tiers'),
  updateDiscountTier: (tier, d) => api.put(`/products/discount-tiers/${tier}`, d),
  getUpsellRules: (params) => api.get('/products/upsell-rules', { params }),
  createUpsellRule: (d) => api.post('/products/upsell-rules', d),
  updateUpsellRule: (id, d) => api.put(`/products/upsell-rules/${id}`, d),
  deleteUpsellRule: (id) => api.delete(`/products/upsell-rules/${id}`),
};

export const quotationsAPI = {
  getAll: (params) => api.get('/quotations', { params }),
  getOne: (id) => api.get(`/quotations/${id}`),
  create: (d) => api.post('/quotations', d),
  update: (id, d) => api.put(`/quotations/${id}`, d),
  submit: (id) => api.put(`/quotations/${id}/submit`),
  decision: (id, d) => api.put(`/quotations/${id}/decision`, d),
  send: (id) => api.put(`/quotations/${id}/send`),
  computeRisk: (d) => api.post('/quotations/compute-risk', d),
  getPortal: (token) => api.get(`/quotations/portal/${token}`),
  updateStatus: (id, d) => api.put(`/quotations/${id}/status`, d),
  batchDecision: (d) => api.post('/quotations/batch-decision', d),
};

export const fulfillmentAPI = {
  getSplit: (quotationId) => api.get(`/fulfillment/${quotationId}/split`),
  acceptSplit: (quotationId) => api.post(`/fulfillment/${quotationId}/accept-split`),
  getWarehouseStock: (params) => api.get('/fulfillment/warehouses/stock', { params }),
  createWarehouse: (d) => api.post('/fulfillment/warehouses', d),
  updateWarehouse: (id, d) => api.put(`/fulfillment/warehouses/${id}`, d),
  updateStock: (wId, pId, d) => api.put(`/fulfillment/warehouses/${wId}/stock/${pId}`, d),
};

export const subscriptionsAPI = {
  getAll: (params) => api.get('/subscriptions', { params }),
  create: (quotationId, d) => api.post(`/subscriptions/${quotationId}`, d),
  cancel: (id) => api.put(`/subscriptions/${id}/cancel`),
  getPlans: () => api.get('/subscriptions/plans'),
  createPlan: (d) => api.post('/subscriptions/plans', d),
  updatePlan: (id, d) => api.put(`/subscriptions/plans/${id}`, d),
};

export const invoicesAPI = {
  getAll: (params) => api.get('/invoices', { params }),
  create: (d) => api.post('/invoices', d),
  markPaid: (id, d) => api.put(`/invoices/${id}/pay`, d),
  markSent: (id) => api.put(`/invoices/${id}/send`),
  createRazorpayOrder: (id) => api.post(`/invoices/${id}/razorpay-order`),
  createPayUOrder: (id) => api.post(`/invoices/${id}/payu-order`),
  downloadPDF: (id) => {
    window.open(`${API_BASE_URL}/invoices/${id}/pdf`, '_blank');
  },
};

export const negotiationsAPI = {
  submit: (quotationId, d) => api.post(`/negotiations/${quotationId}/negotiate`, d),
  respond: (id, d) => api.put(`/negotiations/${id}/respond`, d),
  confirm: (quotationId, d) => api.post(`/negotiations/${quotationId}/confirm-portal`, d),
};

export const dashboardAPI = {
  getMetrics: (params) => api.get('/dashboard/metrics', { params }),
  getApprovalQueue: () => api.get('/dashboard/approval-queue'),
  getRepLeaderboard: () => api.get('/auth/users', { params: { role: 'SALES_REP' } }),
  getDealHealth: () => api.get('/dashboard/deal-health'),
  nudgeRep: (quotationId) => api.post(`/dashboard/nudge/${quotationId}`),
  escalateDeal: (quotationId) => api.post(`/dashboard/escalate/${quotationId}`),
};

export const notificationsAPI = {
  getAll: () => api.get('/notifications'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};

export const usersAPI = {
  getAll: (params) => api.get('/auth/users', { params }),
  create: (d) => api.post('/auth/users', d),
  toggleStatus: (id) => api.put(`/auth/users/${id}/status`),
  resetPassword: (id, d) => api.put(`/auth/users/${id}/reset-password`, d),
  updateRole: (id, d) => api.put(`/auth/users/${id}/role`, d),
};

