import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  Tag,
  Shield,
  Layers,
  Search,
  Plus,
  Building2,
  Calendar,
  CheckCircle,
  HelpCircle,
  Award
} from 'lucide-react';
import { productsAPI } from '../../api';
import toast from 'react-hot-toast';
import Pagination from '../../components/ui/Pagination';

export default function PriceListsPage() {
  const [priceLists, setPriceLists] = useState([]);
  const [allPriceLists, setAllPriceLists] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState('ALL');
  const [search, setSearch] = useState('');

  const fetchData = useCallback(async (q = search, t = selectedTier) => {
    try {
      setLoading(true);
      const params = {};
      if (q && q.trim()) params.search = q.trim();
      if (t && t !== 'ALL') params.tier = t;

      const [listsRes, prodsRes] = await Promise.all([
        productsAPI.getPriceLists(params),
        products.length === 0 ? productsAPI.getAll() : Promise.resolve(products)
      ]);
      const list = listsRes || [];
      setPriceLists(list);
      if (!q && t === 'ALL' && allPriceLists.length === 0) {
        setAllPriceLists(list);
      }
      if (products.length === 0) setProducts(prodsRes || []);
    } catch (err) {
      console.error('Failed to load price lists from database:', err);
      toast.error('Failed to load price lists');
    } finally {
      setLoading(false);
    }
  }, [search, selectedTier, products, allPriceLists.length]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData(search, selectedTier);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, selectedTier, fetchData]);

  const tiers = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM'];

  const getTierBadgeStyle = (tier) => {
    switch (tier) {
      case 'PLATINUM':
        return 'bg-pop-violet text-white border-2 border-slate-900 shadow-pop-sm';
      case 'GOLD':
        return 'bg-pop-yellow text-slate-900 border-2 border-slate-900 shadow-pop-sm';
      case 'SILVER':
        return 'bg-slate-200 text-slate-900 border-2 border-slate-900 shadow-pop-sm';
      default:
        return 'bg-amber-100 text-amber-900 border-2 border-slate-900 shadow-pop-sm';
    }
  };

  // Database-queried price lists
  const filteredLists = priceLists;

  // Pagination for items inside each price list
  const [itemPages, setItemPages] = useState({});
  const [itemPageSizes, setItemPageSizes] = useState({});

  const getItemPage = (id) => itemPages[id] || 1;
  const getItemPageSize = (id) => itemPageSizes[id] || 5;

  useEffect(() => {
    setItemPages({});
  }, [selectedTier, search]);

  const pagedLists = filteredLists;

  return (
    <div className="space-y-6 pb-12 antialiased">
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border-2 border-slate-900 p-6 rounded-3xl shadow-pop">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-pop-mint border-2 border-slate-900 text-slate-900 flex items-center justify-center shadow-pop-sm">
              <Tag className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-heading font-extrabold text-slate-900 tracking-tight">
                  Customer Tier Price Lists
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-pop-mint/40 text-emerald-950 border-2 border-slate-900 shadow-pop-sm">
                  Contracted Rates
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium mt-0.5">
                Standard negotiated rates per customer tier (Bronze, Silver, Gold, Platinum). Applied automatically during quotation creation.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── TIER OVERVIEW CARDS ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tiers.map((t) => {
          const matchingLists = (allPriceLists.length > 0 ? allPriceLists : priceLists).filter((p) => p.tier === t);
          const itemCount = matchingLists.reduce(
            (acc, l) => acc + (l.items?.length || 0),
            0
          );
          const isSelected = selectedTier === t;

          return (
            <div
              key={t}
              onClick={() => setSelectedTier(selectedTier === t ? 'ALL' : t)}
              className={`bg-white border-2 border-slate-900 rounded-3xl p-5 cursor-pointer transition-all hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 ${
                isSelected
                  ? 'shadow-pop ring-4 ring-pop-violet/30 bg-amber-50/50'
                  : 'shadow-pop-sm hover:shadow-pop'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`px-2.5 py-1 rounded-xl text-[10px] font-mono font-black uppercase ${getTierBadgeStyle(
                    t
                  )}`}
                >
                  {t} Tier
                </span>
                <span className="text-xs font-mono font-bold text-slate-500">
                  {matchingLists.length} List{matchingLists.length === 1 ? '' : 's'}
                </span>
              </div>
              <div className="mt-3">
                <div className="text-2xl font-heading font-black text-slate-900 font-mono">
                  {itemCount} SKUs
                </div>
                <div className="text-[11px] font-medium text-slate-500 mt-0.5">
                  Pre-approved contracted items
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── CONTROLS BAR ──────────────────────────────────────────────────── */}
      <div className="bg-white border-2 border-slate-900 rounded-3xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-pop">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 stroke-[2.5]" />
            <input
              type="text"
              placeholder="Search price lists by name or tier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-paper border-2 border-slate-900 rounded-2xl text-xs sm:text-sm font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-pop-violet transition-all"
            />
          </div>

          <div className="flex items-center bg-slate-100 border-2 border-slate-900 rounded-2xl p-1 text-xs">
            {['ALL', ...tiers].map((t) => (
              <button
                key={t}
                onClick={() => setSelectedTier(t)}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all ${
                  selectedTier === t
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── PRICE LISTS CONTENT ───────────────────────────────────────────── */}
      {loading ? (
        <div className="bg-white border-2 border-slate-900 rounded-3xl p-12 text-center shadow-pop">
          <div className="w-8 h-8 border-3 border-slate-900 border-t-pop-violet rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs font-bold text-slate-600">Loading price lists...</p>
        </div>
      ) : filteredLists.length === 0 ? (
        <div className="bg-white border-2 border-slate-900 rounded-3xl p-12 text-center shadow-pop">
          <div className="w-14 h-14 rounded-2xl bg-pop-yellow/40 border-2 border-slate-900 flex items-center justify-center mx-auto mb-3 shadow-pop-sm">
            <Tag className="w-7 h-7 text-slate-900 stroke-[2.5]" />
          </div>
          <h3 className="text-base font-heading font-black text-slate-900">No Price Lists Configured</h3>
          <p className="text-xs font-medium text-slate-600 mt-1 max-w-sm mx-auto">
            Products use their default base prices for tiers without a dedicated custom price list.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {pagedLists.map((pl) => (
            <div
              key={pl.id}
              className="bg-white border-2 border-slate-900 rounded-3xl overflow-hidden shadow-pop"
            >
              {/* Header */}
              <div className="p-5 bg-amber-50/70 border-b-2 border-slate-900 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span
                    className={`px-3 py-1 rounded-xl text-xs font-mono font-black uppercase ${getTierBadgeStyle(
                      pl.tier
                    )}`}
                  >
                    {pl.tier} Tier
                  </span>
                  <div>
                    <h3 className="text-base font-heading font-black text-slate-900">{pl.name}</h3>
                    <p className="text-[11px] font-mono font-bold text-slate-500">Currency: {pl.currency || 'INR'}</p>
                  </div>
                </div>

                <span className="text-xs font-mono font-bold text-slate-600 bg-white px-3 py-1 rounded-xl border-2 border-slate-900 shadow-pop-sm">
                  {pl.items?.length || 0} Special Item Rates
                </span>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b-2 border-slate-900 bg-slate-100/90 text-[10px] uppercase font-mono font-black text-slate-800 tracking-wider">
                      <th className="py-3 px-4">Product Name</th>
                      <th className="py-3 px-4 hidden sm:table-cell">SKU</th>
                      <th className="py-3 px-4 text-right hidden md:table-cell">Standard Base Price</th>
                      <th className="py-3 px-4 text-right">Contracted Tier Price</th>
                      <th className="py-3 px-4 text-center">Discount Off Base</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-slate-100">
                    {(() => {
                      const plPage = getItemPage(pl.id);
                      const plPageSize = getItemPageSize(pl.id);
                      const allItems = pl.items || [];
                      const pagedItems = allItems.slice((plPage - 1) * plPageSize, plPage * plPageSize);

                      if (allItems.length === 0) {
                        return (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-500 font-medium text-xs">
                              No customized SKU prices in this price list
                            </td>
                          </tr>
                        );
                      }

                      return pagedItems.map((item) => {
                        const standardPrice = Number(item.product?.basePrice ?? item.product?.base_price ?? item.product?.unit_price) || 0;
                        const contractPrice = Number(item.price) || 0;
                        const discountPct =
                          standardPrice > 0
                            ? (((standardPrice - contractPrice) / standardPrice) * 100).toFixed(1)
                            : '0.0';

                        return (
                          <tr key={item.id} className="hover:bg-amber-50/40 transition-colors">
                            <td className="py-3 px-4 font-bold text-slate-900">
                              <div>{item.product?.name || 'Product'}</div>
                              <div className="sm:hidden text-[10px] font-mono text-pop-violet font-bold mt-0.5">
                                {item.product?.sku || 'SKU'}
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-pop-violet hidden sm:table-cell">
                              {item.product?.sku || 'SKU'}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-slate-500 line-through hidden md:table-cell">
                              ₹{standardPrice.toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-black text-slate-900 text-sm">
                              ₹{contractPrice.toLocaleString()}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="inline-block px-2.5 py-0.5 rounded-xl text-[10px] font-mono font-black bg-pop-mint/40 text-emerald-950 border-2 border-slate-900 shadow-pop-sm">
                                {discountPct}% off
                              </span>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Items Pagination Footer */}
              {(pl.items?.length || 0) > 0 && (
                <div className="p-4 border-t-2 border-slate-900 bg-slate-50">
                  <Pagination
                    currentPage={getItemPage(pl.id)}
                    totalItems={pl.items?.length || 0}
                    pageSize={getItemPageSize(pl.id)}
                    onPageChange={(newPage) =>
                      setItemPages((prev) => ({ ...prev, [pl.id]: newPage }))
                    }
                    onPageSizeChange={(newSize) => {
                      setItemPageSizes((prev) => ({ ...prev, [pl.id]: newSize }));
                      setItemPages((prev) => ({ ...prev, [pl.id]: 1 }));
                    }}
                    pageSizeOptions={[5, 10, 25, 50, 100, 200]}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
