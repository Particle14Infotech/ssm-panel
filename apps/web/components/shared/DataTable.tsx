"use client";

import React from "react";

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  render?: (item: T, index: number) => React.ReactNode;
  align?: "left" | "center" | "right";
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  emptyState?: React.ReactNode;
  className?: string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyState,
  className = "",
}: DataTableProps<T>) {
  if (data.length === 0 && emptyState) {
    return <div className="p-8">{emptyState}</div>;
  }

  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-left border-collapse">
        <thead className="sticky top-0 bg-[#131313]/95 backdrop-blur-md z-10 border-b border-white/10">
          <tr className="text-[11px] uppercase tracking-wider text-slate-400 font-mono">
            {columns.map((col, idx) => (
              <th
                key={idx}
                className={`py-3 px-4 font-semibold ${
                  col.align === "right"
                    ? "text-right"
                    : col.align === "center"
                    ? "text-center"
                    : "text-left"
                } ${col.className || ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5 text-xs">
          {data.map((item, rowIdx) => (
            <tr
              key={keyExtractor(item)}
              className="hover:bg-white/[0.03] transition-colors duration-150 group"
            >
              {columns.map((col, colIdx) => (
                <td
                  key={colIdx}
                  className={`py-3.5 px-4 ${
                    col.align === "right"
                      ? "text-right"
                      : col.align === "center"
                      ? "text-center"
                      : "text-left"
                  } ${col.className || ""}`}
                >
                  {col.render
                    ? col.render(item, rowIdx)
                    : col.accessorKey
                    ? String(item[col.accessorKey] ?? "")
                    : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
