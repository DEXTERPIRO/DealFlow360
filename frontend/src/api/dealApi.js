import api from './axiosClient';

export const dealApi = {
  getDeals: async (params = {}) => {
    const res = await api.get('/deals', { params });
    return res.data;
  },
  getDealById: async (id) => {
    const res = await api.get(`/deals/${id}`);
    return res.data;
  },
  createDeal: async (dealData) => {
    const res = await api.post('/deals', dealData);
    return res.data;
  },
  updateDeal: async (id, dealData) => {
    const res = await api.put(`/deals/${id}`, dealData);
    return res.data;
  },
  deleteDeal: async (id) => {
    const res = await api.delete(`/deals/${id}`);
    return res.data;
  },
  getPipelineStats: async () => {
    const res = await api.get('/deals/stats');
    return res.data;
  },
  downloadPdf: (id) => {
    window.open(`/api/deals/${id}/pdf`, '_blank');
  },
};
