import { create } from 'zustand';

export const useDealStore = create((set, get) => ({
  deals: [],
  selectedDeal: null,
  isNewDealModalOpen: false,
  searchTerm: '',
  selectedStageFilter: 'ALL',

  setDeals: (deals) => set({ deals }),
  setSelectedDeal: (deal) => set({ selectedDeal: deal }),
  setIsNewDealModalOpen: (open) => set({ isNewDealModalOpen: open }),
  setSearchTerm: (term) => set({ searchTerm: term }),
  setSelectedStageFilter: (stage) => set({ selectedStageFilter: stage }),

  // Real-time update helpers
  addOrUpdateDeal: (deal) => {
    const { deals } = get();
    const exists = deals.some((d) => d.id === deal.id);
    if (exists) {
      set({
        deals: deals.map((d) => (d.id === deal.id ? { ...d, ...deal } : d)),
      });
    } else {
      set({ deals: [deal, ...deals] });
    }
  },

  removeDeal: (id) => {
    const { deals } = get();
    set({ deals: deals.filter((d) => d.id !== id) });
  },
}));
