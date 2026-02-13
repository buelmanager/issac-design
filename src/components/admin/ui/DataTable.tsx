import type { ReactNode } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';

interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  onSort?: (column: string, direction: 'asc' | 'desc') => void;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  loading?: boolean;
}

function getCellValue<T>(row: T, key: string): ReactNode {
  const value = (row as Record<string, unknown>)[key];
  if (value === null || value === undefined) return '';
  return String(value);
}

export function DataTable<T>({
  columns,
  data,
  onSort,
  sortColumn,
  sortDirection,
  onRowClick,
  emptyMessage = 'No data found',
  loading,
}: DataTableProps<T>) {
  function handleSort(col: Column<T>) {
    if (!col.sortable || !onSort) return;
    const nextDir = sortColumn === col.key && sortDirection === 'asc' ? 'desc' : 'asc';
    onSort(col.key, nextDir);
  }

  return (
    <div className="admin-table-wrapper">
      {loading && (
        <div className="admin-table-loading">
          <LoadingSpinner size="lg" />
        </div>
      )}
      <table className="admin-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={`admin-table-th ${col.sortable ? 'admin-table-th-sortable' : ''}`}
                style={col.width ? { width: col.width } : undefined}
                onClick={() => handleSort(col)}
              >
                <span className="admin-table-th-content">
                  {col.label}
                  {col.sortable && sortColumn === col.key && (
                    <span className="admin-table-sort-icon">
                      {sortDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && !loading ? (
            <tr>
              <td colSpan={columns.length} className="admin-table-empty">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={`admin-table-row ${onRowClick ? 'admin-table-row-clickable' : ''}`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td key={col.key} className="admin-table-td">
                    {col.render ? col.render(row) : getCellValue(row, col.key)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
