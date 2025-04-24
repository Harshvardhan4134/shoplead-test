import { RefreshCw } from "lucide-react";

interface LoadingSpinnerProps {
  message?: string;
}

export function LoadingSpinner({ message = "Loading..." }: LoadingSpinnerProps) {
  return (
    <div className="flex items-center justify-center py-4">
      <RefreshCw className="h-6 w-6 animate-spin mr-2" />
      <span>{message}</span>
    </div>
  );
} 