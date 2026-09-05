import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

/**
 * Reusable Pagination Component
 * 
 * Props:
 *  - currentPage  : number (1-indexed)
 *  - totalItems   : number
 *  - pageSize     : number
 *  - onPageChange : (page: number) => void
 *  - onPageSizeChange : (size: number) => void  (optional)
 *  - pageSizeOptions  : number[]                (optional, default [10,25,50,100])
 *  - className    : string (optional)
 */
export default function Pagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
  className = '',
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startItem = Math.min((safeCurrentPage - 1) * pageSize + 1, totalItems);
  const endItem = Math.min(safeCurrentPage * pageSize, totalItems);

  // Generate page numbers to show with ellipsis
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
    'flex items-center justify-center w-8 h-8 rounded-lg text-xs font-semibold transition-all duration-150 select-none';
  const btnActive =
    'bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-2 ring-blue-500/40';
  const btnInactive =
    'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white border border-slate-700';
  const btnDisabled =
    'bg-slate-900 text-slate-600 cursor-not-allowed border border-slate-800';

  if (totalItems === 0) return null;

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-800 ${className}`}
    >
      {/* Left: item count */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-400">
          Showing{' '}
          <span className="text-white font-semibold">{startItem}–{endItem}</span>
          {' '}of{' '}
          <span className="text-white font-semibold">{totalItems}</span>
          {' '}results
        </span>

        {onPageSizeChange && (
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-slate-500">per page</span>
            <select
              value={pageSize}
              onChange={(e) => {
                onPageSizeChange(Number(e.target.value));
                onPageChange(1); // reset to first page
              }}
              className="bg-slate-800 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Right: page buttons */}
      <div className="flex items-center gap-1">
        {/* First page */}
        <button
          onClick={() => onPageChange(1)}
          disabled={safeCurrentPage === 1}
          className={`${btnBase} ${safeCurrentPage === 1 ? btnDisabled : btnInactive}`}
          title="First page"
        >
          <ChevronsLeft className="w-3.5 h-3.5" />
        </button>

        {/* Prev */}
        <button
          onClick={() => onPageChange(safeCurrentPage - 1)}
          disabled={safeCurrentPage === 1}
          className={`${btnBase} ${safeCurrentPage === 1 ? btnDisabled : btnInactive}`}
          title="Previous page"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        {/* Page numbers */}
        {pageNumbers.map((page, idx) =>
          page === '...' ? (
            <span
              key={`ellipsis-${idx}`}
              className="flex items-center justify-center w-8 h-8 text-xs text-slate-500 select-none"
            >
              ···
            </span>
          ) : (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`${btnBase} ${page === safeCurrentPage ? btnActive : btnInactive}`}
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
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        {/* Last page */}
        <button
          onClick={() => onPageChange(totalPages)}
          disabled={safeCurrentPage === totalPages}
          className={`${btnBase} ${safeCurrentPage === totalPages ? btnDisabled : btnInactive}`}
          title="Last page"
        >
          <ChevronsRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
