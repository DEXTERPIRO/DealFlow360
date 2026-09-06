import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

export default function Pagination({
  currentPage = 1,
  totalItems,
  pageSize = 5,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 25, 50, 100, 200],
  className = '',
}) {
  const [jumpPage, setJumpPage] = useState('');

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = Math.min((safeCurrentPage - 1) * pageSize + 1, totalItems);
  const endItem = Math.min(safeCurrentPage * pageSize, totalItems);

  const handleJumpSubmit = (e) => {
    e.preventDefault();
    const num = parseInt(jumpPage, 10);
    if (!isNaN(num)) {
      const target = Math.min(Math.max(1, num), totalPages);
      onPageChange(target);
    }
    setJumpPage('');
  };

  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safeCurrentPage > 3) pages.push('...');

      const rangeStart = Math.max(2, safeCurrentPage - 1);
      const rangeEnd = Math.min(totalPages - 1, safeCurrentPage + 1);

      for (let i = rangeStart; i <= rangeEnd; i++) pages.push(i);

      if (safeCurrentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  const pageNumbers = getPageNumbers();

  const btnBase =
    'flex items-center justify-center w-8 h-8 rounded-full border-2 border-slate-900 font-heading font-bold text-xs transition-all duration-150 select-none cursor-pointer';
  const btnActive =
    'bg-pop-violet text-white shadow-pop hover:-translate-y-0.5 hover:shadow-pop-lg';
  const btnInactive =
    'bg-white text-slate-900 shadow-pop-sm hover:bg-pop-yellow hover:-translate-y-0.5 hover:shadow-pop active:translate-y-0.5 active:shadow-none';
  const btnDisabled =
    'bg-slate-100 text-slate-400 border-slate-300 shadow-none cursor-not-allowed';

  if (totalItems === 0) return null;

  return (
    <div
      className={`flex flex-col md:flex-row items-center justify-between gap-3 pt-3 border-t-2 border-slate-900 ${className}`}
    >
      {/* Left: Item Counter & Page Size Selector */}
      <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3 w-full md:w-auto">
        <div className="px-2.5 sm:px-3 py-1 rounded-xl bg-white border-2 border-slate-900 shadow-pop-xs flex items-center gap-1.5 text-[11px] sm:text-xs font-heading font-bold text-slate-700">
          <span>Showing</span>
          <span className="text-slate-900 font-mono font-black">{startItem}–{endItem}</span>
          <span>of</span>
          <span className="text-pop-violet font-mono font-black">{totalItems}</span>
          <span>records</span>
        </div>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 text-xs font-heading font-bold text-slate-600">
            <span>Rows:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1);
              }}
              className="bg-white border-2 border-slate-900 text-slate-900 text-xs font-heading font-black rounded-xl px-2 py-1 shadow-pop-xs focus:outline-none focus:ring-2 focus:ring-pop-violet cursor-pointer hover:bg-slate-50 transition-colors"
              title="Rows per page"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>{opt} / page</option>
              ))}
            </select>
          </div>
        )}

        {/* Quick page jump if multiple pages */}
        {totalPages > 3 && (
          <form onSubmit={handleJumpSubmit} className="flex items-center gap-1.5 text-xs font-heading font-bold text-slate-600">
            <span>Jump:</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={jumpPage}
              onChange={(e) => setJumpPage(e.target.value)}
              placeholder={`${safeCurrentPage}`}
              className="w-12 h-7 px-1 text-center bg-white border-2 border-slate-900 rounded-xl text-xs font-mono font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-pop-violet shadow-pop-xs"
              title={`Enter page 1-${totalPages} and press Enter`}
            />
            <span className="text-[11px] font-mono font-bold text-slate-500">/ {totalPages}</span>
          </form>
        )}
      </div>

      {/* Right: Page Navigation Buttons */}
      <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap justify-center">
        {/* First page */}
        <button
          onClick={() => onPageChange(1)}
          disabled={safeCurrentPage === 1}
          className={`${btnBase} ${safeCurrentPage === 1 ? btnDisabled : btnInactive}`}
          title="First page"
          type="button"
        >
          <ChevronsLeft className="w-3.5 h-3.5" strokeWidth={2.5} />
        </button>

        {/* Prev */}
        <button
          onClick={() => onPageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage === 1}
          className={`${btnBase} ${safeCurrentPage === 1 ? btnDisabled : btnInactive}`}
          title="Previous page"
          type="button"
        >
          <ChevronLeft className="w-3.5 h-3.5" strokeWidth={2.5} />
        </button>

        {/* Page numbers */}
        {pageNumbers.map((page, idx) =>
          page === '...' ? (
            <span
              key={`ellipsis-${idx}`}
              className="flex items-center justify-center w-7 h-8 text-xs font-black text-slate-400 select-none"
            >
              ···
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`${btnBase} ${page === safeCurrentPage ? btnActive : btnInactive}`}
              type="button"
              title={`Page ${page}`}
            >
              {page}
            </button>
          )
        )}

        {/* Next */}
        <button
          onClick={() => onPageChange(safeCurrentPage + 1)}
          disabled={safeCurrentPage === totalPages}
          className={`${btnBase} ${safeCurrentPage === totalPages ? btnDisabled : btnInactive}`}
          title="Next page"
          type="button"
        >
          <ChevronRight className="w-3.5 h-3.5" strokeWidth={2.5} />
        </button>

        {/* Last page */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={safeCurrentPage === totalPages}
          className={`${btnBase} ${safeCurrentPage === totalPages ? btnDisabled : btnInactive}`}
          title="Last page"
          type="button"
        >
          <ChevronsRight className="w-3.5 h-3.5" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  );
}
