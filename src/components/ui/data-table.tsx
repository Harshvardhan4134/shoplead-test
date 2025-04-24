import { useState } from "react";
import { Input } from "./input";
import { Search } from "lucide-react";

interface DataTableProps<T> {
  data: T[];
  columns: {
    header: string;
    accessorKey: string | ((row: T) => React.ReactNode);
    cell?: (row: T) => React.ReactNode;
  }[];
  searchKey: string;
  isLoading?: boolean;
  pageSize?: number;
}

export function DataTable<T>({
  data,
  columns,
  searchKey,
  isLoading = false,
  pageSize = 10,
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  const filteredData = data.filter((item: any) =>
    String(item[searchKey]).toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = filteredData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      <div className="rounded-md border">
        <div className="relative w-full overflow-auto">
          <table className="w-full caption-bottom text-sm">
            <thead className="[&_tr]:border-b">
              <tr className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted">
                {columns.map((column) => (
                  <th
                    key={column.header}
                    className="h-12 px-4 text-left align-middle font-medium text-muted-foreground"
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="[&_tr:last-child]:border-0">
              {isLoading ? (
                <tr>
                  <td colSpan={columns.length} className="h-24 text-center">
                    Loading...
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="h-24 text-center">
                    No results found.
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                  >
                    {columns.map((column) => (
                      <td key={column.header} className="p-4 align-middle">
                        {column.cell
                          ? column.cell(row)
                          : typeof column.accessorKey === "function"
                          ? column.accessorKey(row)
                          : (row as any)[column.accessorKey as string]}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-end space-x-2">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="h-8 w-8 rounded-md border p-1 disabled:opacity-50"
          >
            {"<"}
          </button>
          <span className="text-sm">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="h-8 w-8 rounded-md border p-1 disabled:opacity-50"
          >
            {">"}
          </button>
        </div>
      )}
    </div>
  );
} 