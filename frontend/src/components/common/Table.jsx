import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import styles from './Table.module.css';

export const Table = ({
  columns = [],
  data = [],
  keyField = 'id',
  onRowClick,
  emptyMessage = 'No records found',
  defaultSortKey = null,
  defaultSortDirection = null, // 'asc' | 'desc' | null
}) => {
  const [sortKey, setSortKey] = useState(defaultSortKey);
  const [sortDirection, setSortDirection] = useState(defaultSortDirection);

  const handleSort = (col) => {
    const isAction = ['actions', 'action', 'aksi'].includes(String(col.title || '').trim().toLowerCase());
    if (col.sortable === false || !col.key || isAction) return;

    if (sortKey === col.key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortKey(null);
        setSortDirection(null);
      } else {
        setSortDirection('asc');
      }
    } else {
      setSortKey(col.key);
      setSortDirection('asc');
    }
  };

  const sortedData = useMemo(() => {
    if (!sortKey || !sortDirection || !Array.isArray(data) || data.length === 0) {
      return data;
    }

    const col = columns.find((c) => c.key === sortKey);
    const customSorter = col?.sorter;

    return [...data].sort((a, b) => {
      if (customSorter) {
        const res = customSorter(a, b);
        return sortDirection === 'desc' ? -res : res;
      }

      const valA = a[sortKey];
      const valB = b[sortKey];

      // Handle null or undefined values
      if (valA === valB) return 0;
      if (valA === null || valA === undefined) return 1;
      if (valB === null || valB === undefined) return -1;

      // Handle numbers
      if (typeof valA === 'number' && typeof valB === 'number') {
        return sortDirection === 'asc' ? valA - valB : valB - valA;
      }

      // Handle booleans
      if (typeof valA === 'boolean' && typeof valB === 'boolean') {
        return sortDirection === 'asc'
          ? (valA === valB ? 0 : valA ? -1 : 1)
          : (valA === valB ? 0 : valA ? 1 : -1);
      }

      // Handle Dates or date strings
      if (typeof valA === 'string' && typeof valB === 'string') {
        const isDateA = !isNaN(Date.parse(valA)) && (valA.includes('-') || valA.includes('/'));
        const isDateB = !isNaN(Date.parse(valB)) && (valB.includes('-') || valB.includes('/'));
        if (isDateA && isDateB) {
          const timeA = new Date(valA).getTime();
          const timeB = new Date(valB).getTime();
          return sortDirection === 'asc' ? timeA - timeB : timeB - timeA;
        }
      }

      // Handle strings with natural alphanumeric comparison
      const strA = String(valA);
      const strB = String(valB);
      const cmp = strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
      return sortDirection === 'asc' ? cmp : -cmp;
    });
  }, [data, sortKey, sortDirection, columns]);

  return (
    <div className={styles.container}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns.map((col, idx) => {
              const isAction = ['actions', 'action', 'aksi'].includes(String(col.title || '').trim().toLowerCase());
              const isSortable = col.sortable !== false && Boolean(col.key) && !isAction;
              const isSorted = sortKey === col.key && sortDirection !== null;

              return (
                <th
                  key={col.key || idx}
                  style={{
                    width: col.width,
                    textAlign: col.align || 'left',
                    cursor: isSortable ? 'pointer' : 'default',
                    userSelect: isSortable ? 'none' : 'auto',
                  }}
                  className={`${styles.th} ${isSortable ? styles.sortableTh : ''}`}
                  onClick={() => isSortable && handleSort(col)}
                  title={isSortable ? `Klik untuk mengurutkan ${col.title || ''}` : undefined}
                >
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      justifyContent:
                        col.align === 'center'
                          ? 'center'
                          : col.align === 'right'
                          ? 'flex-end'
                          : 'flex-start',
                      width: '100%',
                    }}
                  >
                    <span>{col.title}</span>
                    {isSortable && (
                      <span className={styles.sortIcon}>
                        {isSorted ? (
                          sortDirection === 'asc' ? (
                            <ArrowUp size={13} color="var(--color-accent)" />
                          ) : (
                            <ArrowDown size={13} color="var(--color-accent)" />
                          )
                        ) : (
                          <ArrowUpDown size={12} className={styles.unsortedIcon} />
                        )}
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {sortedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={styles.empty}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            sortedData.map((row, rowIdx) => (
              <tr
                key={row[keyField] || rowIdx}
                onClick={() => onRowClick && onRowClick(row)}
                className={`${styles.tr} ${onRowClick ? styles.clickable : ''}`}
              >
                {columns.map((col, colIdx) => (
                  <td
                    key={col.key || colIdx}
                    style={{ textAlign: col.align || 'left' }}
                    className={styles.td}
                  >
                    {col.render ? col.render(row[col.key], row, rowIdx) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
