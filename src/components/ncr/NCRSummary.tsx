import { DollarSign, FileText, Package2, TrendingUp } from "lucide-react";

interface NCRSummaryProps {
  totalSubmitted: number;
  totalNCRCost: number;
  mostAffectedPart: string;
  ncrYTD: number;
}

export default function NCRSummary({
  totalSubmitted,
  totalNCRCost,
  mostAffectedPart,
  ncrYTD
}: NCRSummaryProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {/* Total Submitted NCRs */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center gap-4">
          <div className="bg-blue-50 p-3 rounded-full">
            <FileText className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Submitted NCRs</h3>
            <p className="text-2xl font-bold">{totalSubmitted}</p>
          </div>
        </div>
      </div>

      {/* Total NCR Cost */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center gap-4">
          <div className="bg-green-50 p-3 rounded-full">
            <DollarSign className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Total NCR Cost</h3>
            <p className="text-2xl font-bold">${totalNCRCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>
        </div>
      </div>

      {/* Most Affected Part */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center gap-4">
          <div className="bg-purple-50 p-3 rounded-full">
            <Package2 className="h-6 w-6 text-purple-600" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">Most Affected Part</h3>
            <p className="text-2xl font-bold truncate" title={mostAffectedPart}>
              {mostAffectedPart}
            </p>
          </div>
        </div>
      </div>

      {/* NCR Year to Date */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center gap-4">
          <div className="bg-orange-50 p-3 rounded-full">
            <TrendingUp className="h-6 w-6 text-orange-600" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-500">NCR YTD</h3>
            <p className="text-2xl font-bold">{ncrYTD}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
