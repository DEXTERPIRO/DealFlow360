import React, { useState, useEffect } from 'react';
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
  HelpCircle
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

  const getTierColor = (tier) => {
    switch (tier) {
      case 'PLATINUM':
        return 'bg-purple-500/15 text-purple-400 border-purple-500/30';
      case 'GOLD':
        return 'bg-amber-500/15 text-amber-400 border-amber-500/30';
      case 'SILVER':
        return 'bg-slate-400/15 text-slate-300 border-slate-400/30';
      default:
        return 'bg-orange-500/15 text-orange-400 border-orange-500/30';
    }
  };

  // Database-queried price lists
  const filteredLists = priceLists;

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 2;

  useEffect(() => {
    setPage(1);
  }, [selectedTier, search]);

  const pagedLists = filteredLists.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-6 pb-12 antialiased">
      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Customer Tier Price Lists
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Contracted Rates
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Standard negotiated rates per customer tier (Bronze, Silver, Gold, Platinum). Applied automatically during quotation creation.
          </p>
        </div>
      </div>

      {/* ── TIER OVERVIEW CARDS ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {tiers.map((t) => {
          const matchingLists = (allPriceLists.length > 0 ? allPriceLists : priceLists).filter((p) => p.tier === t);
          const itemCount = matchingLists.reduce(
            (acc, l) => acc + (l.items?.length || 0),
            0
          );

          return (
            <div
              key={t}
              onClick={() => setSelectedTier(selectedTier === t ? 'ALL' : t)}
              className={`bg-slate-900 border rounded-2xl p-4 cursor-pointer transition-all hover:border-slate-700 ${
                selectedTier === t ? 'border-blue-500 shadow-lg shadow-blue-500/10' : 'border-slate-800'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border ${getTierColor(
                    t
                  )}`}
                >
                  {t} Tier
                </span>
                <span className="text-xs font-mono text-slate-500">
                  {matchingLists.length} Price List(s)
                </span>
              </div>
              <div className="mt-3">
                <div className="text-xl font-black text-white font-mono">
                  {itemCount} SKUs
                </div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Pre-approved contracted items
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── CONTROLS BAR ──────────────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search price lists by name or tier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
            {['ALL', ...tiers].map((t) => (
              <button
                key={t}
                onClick={() => setSelectedTier(t)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${
                  selectedTier === t
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
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
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-400">Loading price lists...</p>
        </div>
      ) : filteredLists.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center">
          <Tag className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-white">No Price Lists Configured</h3>
          <p className="text-xs text-slate-400 mt-1">
            Products use their default base prices for tiers without a dedicated custom price list.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {pagedLists.map((pl) => (
            <div
              key={pl.id}
              className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm"
            >
              {/* Header */}
              <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold uppercase border ${getTierColor(
                      pl.tier
                    )}`}
                  >
                    {pl.tier}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-white">{pl.name}</h3>
                    <p className="text-[11px] text-slate-400 font-mono">Currency: {pl.currency || 'INR'}</p>
                  </div>
                </div>

                <span className="text-xs text-slate-400 font-mono">
                  {pl.items?.length || 0} Special Item Rates
                </span>
              </div>

              {/* Items Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/60 text-[10px] uppercase font-bold text-slate-400 font-mono">
                      <th className="py-2.5 px-4">Product Name</th>
                      <th className="py-2.5 px-4">SKU</th>
                      <th className="py-2.5 px-4 text-right">Standard Base Price</th>
                      <th className="py-2.5 px-4 text-right">Contracted Tier Price</th>
                      <th className="py-2.5 px-4 text-center">Discount Off Base</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {pl.items?.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-500 text-xs">
                          No customized SKU prices in this price list
                        </td>
                      </tr>
                    ) : (
                      pl.items?.map((item) => {
                        const standardPrice = Number(item.product?.basePrice) || 0;
                        const contractPrice = Number(item.price) || 0;
                        const discountPct =
                          standardPrice > 0
                            ? (((standardPrice - contractPrice) / standardPrice) * 100).toFixed(1)
                            : '0.0';

                        return (
                          <tr key={item.id} className="hover:bg-slate-850/50 transition-colors">
                            <td className="py-2.5 px-4 font-semibold text-slate-200">
                              {item.product?.name || 'Product'}
                            </td>
                            <td className="py-2.5 px-4 font-mono text-blue-400">
                              {item.product?.sku || 'SKU'}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono text-slate-400">
                              ₹{standardPrice.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-400 text-sm">
                              ₹{contractPrice.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <span className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                {discountPct}% off
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
            <Pagination
              currentPage={page}
              totalItems={filteredLists.length}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </div>
        </div>
      )}
    </div>
  );
}
