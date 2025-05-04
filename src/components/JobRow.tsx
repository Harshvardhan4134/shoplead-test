import { format } from "date-fns";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Save, 
  UserPlus, 
  Clipboard, 
  MoreVertical 
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface JobRowProps {
  job: any;
  onUpdateField: (jobId: string | number, field: string, value: any) => void;
  onSaveReferenceName: (jobId: string | number, name: string) => void;
  onAssign: (job: any) => void;
  onReport: (jobId: string | number) => void;
}

const JobRow = ({
  job,
  onUpdateField,
  onSaveReferenceName,
  onAssign,
  onReport
}: JobRowProps) => {
  const [editableReferenceName, setEditableReferenceName] = useState(job.title || job.reference_name || '');
  const [isEditingName, setIsEditingName] = useState(false);

  // Check if financial data is missing
  const hasFinancialData = job.planned_cost && job.actual_cost && job.projected_cost && 
                          job.order_value && job.margin && job.profit_value;

  return (
    <tr className={`hover:bg-gray-50 ${!hasFinancialData ? 'bg-yellow-50' : ''}`}>
      <td className="px-6 py-4">
        <div className="flex items-center">
          <input 
            className="w-full border-none bg-transparent"
            value={editableReferenceName}
            onChange={(e) => setEditableReferenceName(e.target.value)}
            onFocus={() => setIsEditingName(true)}
          />
          {isEditingName && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6 text-green-600"
              onClick={() => {
                onSaveReferenceName(job.job_number, editableReferenceName);
                setIsEditingName(false);
              }}
            >
              <Save className="h-4 w-4" />
            </Button>
          )}
        </div>
      </td>
      <td className="px-6 py-4 font-medium text-blue-600">{job.job_number}</td>
      <td className="px-6 py-4">
        <input
          type="number"
          step="0.01"
          min="0"
          className="w-full border-none bg-transparent"
          value={job.planned_hours?.toFixed(2) || '0.00'}
          onChange={(e) => {
            const value = parseFloat(e.target.value);
            if (!isNaN(value)) {
              onUpdateField(job.job_number, 'planned_hours', value);
            }
          }}
        />
      </td>
      <td className="px-6 py-4">
        <input
          type="number"
          step="0.01"
          min="0"
          className="w-full border-none bg-transparent"
          value={job.actual_hours?.toFixed(2) || '0.00'}
          onChange={(e) => {
            const value = parseFloat(e.target.value);
            if (!isNaN(value)) {
              onUpdateField(job.job_number, 'actual_hours', value);
            }
          }}
        />
      </td>
      <td className="px-6 py-4">
        <span className={`${job.projected_hours > job.planned_hours ? 'text-red-600' : 'text-green-600'}`}>
          {job.projected_hours?.toFixed(2) || '0.00'}
        </span>
      </td>
      <td className="px-6 py-4">{job.planned_cost?.toFixed(2) || '0.00'}</td>
      <td className="px-6 py-4">{job.actual_cost?.toFixed(2) || '0.00'}</td>
      <td className="px-6 py-4">
        <span className={`${job.projected_cost > job.planned_cost ? 'text-red-600' : 'text-green-600'}`}>
          {job.projected_cost?.toFixed(2) || '0.00'}
        </span>
      </td>
      <td className="px-6 py-4">
        <input
          type="number"
          step="0.01"
          min="0"
          className="w-full border-none bg-transparent"
          value={job.order_value?.toFixed(2) || '0.00'}
          onChange={(e) => {
            const value = parseFloat(e.target.value);
            if (!isNaN(value)) {
              onUpdateField(job.job_number, 'order_value', value);
            }
          }}
        />
      </td>
      <td className="px-6 py-4">{job.margin?.toFixed(2) || '0.00'}</td>
      <td className="px-6 py-4">{job.profit_value?.toFixed(2) || '0.00'}</td>
      <td className="px-6 py-4">
        <input
          type="date"
          className="w-full border-none bg-transparent"
          value={format(new Date(job.due_date), "yyyy-MM-dd")}
          onChange={(e) => {
            onUpdateField(job.job_number, 'due_date', e.target.value);
          }}
        />
      </td>
      <td className="px-6 py-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onAssign(job)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Assign Employee
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onReport(job.job_number)}>
              <Clipboard className="h-4 w-4 mr-2" />
              Report Issue
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </td>
    </tr>
  );
};

export default JobRow; 