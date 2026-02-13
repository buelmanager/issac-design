import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  totalItems?: number;
}

function getPageNumbers(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | 'ellipsis')[] = [1];

  if (current > 3) {
    pages.push('ellipsis');
  }

  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) {
    pages.push('ellipsis');
  }

  pages.push(total);

  return pages;
}

export function Pagination({ currentPage, totalPages, onPageChange, pageSize, totalItems }: PaginationProps) {
  if (totalPages <= 1) return null;

  const pages = getPageNumbers(currentPage, totalPages);

  const showingFrom = totalItems !== undefined && pageSize ? (currentPage - 1) * pageSize + 1 : null;
  const showingTo = totalItems !== undefined && pageSize ? Math.min(currentPage * pageSize, totalItems) : null;

  return (
    <div className="admin-pagination">
      {showingFrom !== null && showingTo !== null && totalItems !== undefined && (
        <span className="admin-pagination-info">
          Showing {showingFrom}-{showingTo} of {totalItems} items
        </span>
      )}
      <div className="admin-pagination-controls">
        <button
          type="button"
          className="admin-pagination-btn"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        >
          <ChevronLeft size={16} />
        </button>
        {pages.map((page, index) =>
          page === 'ellipsis' ? (
            <span key={`ellipsis-${index}`} className="admin-pagination-ellipsis">
              ...
            </span>
          ) : (
            <button
              key={page}
              type="button"
              className={`admin-pagination-btn ${page === currentPage ? 'admin-pagination-btn-active' : ''}`}
              onClick={() => onPageChange(page)}
            >
              {page}
            </button>
          ),
        )}
        <button
          type="button"
          className="admin-pagination-btn"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
