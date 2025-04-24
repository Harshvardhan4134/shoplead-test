import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const getStatusStyles = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
      case "delivered":
      case "closed":
        return "bg-green-100 text-green-800";
      case "in progress":
      case "in transit":
        return "bg-blue-100 text-blue-800";
      case "scheduled":
      case "ordered":
        return "bg-yellow-100 text-yellow-800";
      case "cancelled":
      case "failed":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        getStatusStyles(status),
        className
      )}
    >
      {status}
    </span>
  );
} 