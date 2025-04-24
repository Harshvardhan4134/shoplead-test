import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye } from "lucide-react";
import { type NCR, NCR_STATUS, NCR_CATEGORIES } from "@/types/ncr";
import { useState } from "react";

interface NCRListProps {
  ncrs: NCR[];
  onViewNCR: (ncr: NCR) => void;
}

export default function NCRList({ ncrs, onViewNCR }: NCRListProps) {
  const [jobFilter, setJobFilter] = useState("");
  const [customerFilter, setCustomerFilter] = useState("");
  const [partFilter, setPartFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const filteredNCRs = ncrs.filter(ncr => {
    if (jobFilter && !ncr.job_number.toLowerCase().includes(jobFilter.toLowerCase())) return false;
    if (customerFilter && !ncr.customer_name.toLowerCase().includes(customerFilter.toLowerCase())) return false;
    if (partFilter && !ncr.part_name.toLowerCase().includes(partFilter.toLowerCase())) return false;
    if (categoryFilter !== "all" && ncr.issue_category !== categoryFilter) return false;
    return true;
  });

  const renderStatus = (status: string) => {
    const variants: Record<string, string> = {
      [NCR_STATUS.SUBMITTED]: "bg-blue-100 text-blue-800",
      [NCR_STATUS.IN_PROGRESS]: "bg-yellow-100 text-yellow-800",
      [NCR_STATUS.UNDER_REVIEW]: "bg-purple-100 text-purple-800",
      [NCR_STATUS.CORRECTIVE_ACTION]: "bg-orange-100 text-orange-800",
      [NCR_STATUS.COMPLETED]: "bg-green-100 text-green-800",
      [NCR_STATUS.CLOSED]: "bg-gray-100 text-gray-800"
    };

    return (
      <Badge className={variants[status] || "bg-gray-100 text-gray-800"}>
        {status}
      </Badge>
    );
  };

  return (
    <div>
      {/* Filter Bar */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="flex-1">
          <Input
            placeholder="Filter by Job Number"
            value={jobFilter}
            onChange={(e) => setJobFilter(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex-1">
          <Input
            placeholder="Filter by Customer"
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex-1">
          <Input
            placeholder="Filter by Part Name"
            value={partFilter}
            onChange={(e) => setPartFilter(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="flex-1">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by Issue Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {Object.entries(NCR_CATEGORIES).map(([key, value]) => (
                <SelectItem key={key} value={key.toLowerCase()}>{value}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* NCR Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-semibold">NCR #</TableHead>
                <TableHead className="font-semibold">Job</TableHead>
                <TableHead className="font-semibold">Customer</TableHead>
                <TableHead className="font-semibold">Work Order</TableHead>
                <TableHead className="font-semibold">Part</TableHead>
                <TableHead className="font-semibold">Category</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold text-right">Impact ($)</TableHead>
                <TableHead className="font-semibold">Docs</TableHead>
                <TableHead className="font-semibold w-[80px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredNCRs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-500">
                      <p className="text-sm">No submitted NCRs found</p>
                      <p className="text-xs">Submit NCR reports for pending items to see them here</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredNCRs.map((ncr) => (
                  <TableRow
                    key={ncr.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => onViewNCR(ncr)}
                  >
                    <TableCell className="font-medium">
                      NCR-{ncr.id.toString().padStart(4, "0")}
                    </TableCell>
                    <TableCell>{ncr.job_number}</TableCell>
                    <TableCell>
                      <div className="max-w-[200px] truncate" title={ncr.customer_name}>
                        {ncr.customer_name}
                      </div>
                    </TableCell>
                    <TableCell>{ncr.work_order}</TableCell>
                    <TableCell>{ncr.part_name}</TableCell>
                    <TableCell>{ncr.issue_category || "N/A"}</TableCell>
                    <TableCell>{renderStatus(ncr.status || NCR_STATUS.SUBMITTED)}</TableCell>
                    <TableCell className="text-right">
                      ${(ncr.financial_impact || 0).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                      })}
                    </TableCell>
                    <TableCell>
                      {ncr.pdf_report_url ? "PDF" : "No PDF"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:bg-gray-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewNCR(ncr);
                        }}
                      >
                        <Eye className="h-4 w-4 text-gray-600" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
