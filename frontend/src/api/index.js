import api from './client';

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
  getPriceLists: () => api.get('/products/pricelists/all'),
  createPriceList: (d) => api.post('/products/pricelists', d),
  addVariant: (productId, d) => api.post(`/products/${productId}/variants`, d),
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
};

export const fulfillmentAPI = {
  getSplit: (quotationId) => api.get(`/fulfillment/${quotationId}/split`),
  acceptSplit: (quotationId) => api.post(`/fulfillment/${quotationId}/accept-split`),
  getWarehouseStock: () => api.get('/fulfillment/warehouses/stock'),
  createWarehouse: (d) => api.post('/fulfillment/warehouses', d),
  updateStock: (wId, pId, d) => api.put(`/fulfillment/warehouses/${wId}/stock/${pId}`, d),
};

export const subscriptionsAPI = {
  getAll: () => api.get('/subscriptions'),
  create: (quotationId, d) => api.post(`/subscriptions/${quotationId}`, d),
  cancel: (id) => api.put(`/subscriptions/${id}/cancel`),
  getPlans: () => api.get('/subscriptions/plans'),
  createPlan: (d) => api.post('/subscriptions/plans', d),
};

export const invoicesAPI = {
  getAll: (params) => api.get('/invoices', { params }),
  create: (d) => api.post('/invoices', d),
  markPaid: (id, d) => api.put(`/invoices/${id}/pay`, d),
  downloadPDF: (id) => window.open(`http://localhost:5000/api/invoices/${id}/pdf`, '_blank'),
};

export const negotiationsAPI = {
  submit: (quotationId, d) => api.post(`/negotiations/${quotationId}/negotiate`, d),
  respond: (id, d) => api.put(`/negotiations/${id}/respond`, d),
  confirm: (quotationId, d) => api.post(`/negotiations/${quotationId}/confirm-portal`, d),
};

export const dashboardAPI = {
  getMetrics: (params) => api.get('/dashboard/metrics', { params }),
  getApprovalQueue: () => api.get('/dashboard/approval-queue'),
};

export const notificationsAPI = {
  getAll: () => api.get('/notifications'),
  markRead: (id) => api.put(`/notifications/${id}/read`),
  markAllRead: () => api.put('/notifications/read-all'),
};
