
import { cn } from "@/lib/utils";

interface TabsProps {
  tabs: {
    id: string;
    label: string;
    count: number;
  }[];
  activeTab: string;
  onChange: (tabId: string) => void;
}

export default function NCRTabs({ tabs, activeTab, onChange }: TabsProps) {
  return (
    <div className="flex space-x-1 rounded-lg bg-gray-100 p-1 mb-6">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={cn(
            "flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md",
            activeTab === tab.id
              ? "bg-white shadow-sm text-gray-900"
              : "text-gray-600 hover:text-gray-900"
          )}
        >
          {tab.label} ({tab.count})
        </button>
      ))}
    </div>
  );
}
