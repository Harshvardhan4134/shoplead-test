
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Filter } from "lucide-react";

interface NCRHeaderProps {
  onNewNCR?: () => void;
  onSearch?: (query: string) => void;
  onFilter?: () => void;
}

export default function NCRHeader({ onNewNCR, onSearch, onFilter }: NCRHeaderProps) {
  return (
    <div className="flex flex-col mb-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">NCR Tracker</h1>
      <p className="text-gray-500 mb-6">Track and manage non-conformance reports</p>
      
      <div className="flex justify-between">
        <Button
          variant="default"
          className="bg-[#1a2133] hover:bg-[#263046] text-white flex items-center gap-2"
          onClick={onNewNCR}
        >
          <Plus className="h-4 w-4" />
          <span>New NCR</span>
        </Button>
        
        <div className="flex gap-2">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400" />
            </div>
            <Input
              placeholder="Search NCRs..."
              className="pl-10 h-10 w-64 bg-white border border-gray-300 focus:border-primary"
              onChange={(e) => onSearch && onSearch(e.target.value)}
            />
          </div>
          
          <Button
            variant="outline"
            className="flex items-center gap-2 border border-gray-300"
            onClick={onFilter}
          >
            <Filter className="h-4 w-4" />
            <span>Filter</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
