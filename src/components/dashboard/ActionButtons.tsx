
import { Button } from "@/components/ui/button";
import { Upload, Sliders, AlertTriangle } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useState, useRef } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function ActionButtons() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportData = () => {
    // Clear any previous errors
    setError(null);
    
    // Trigger the hidden file input
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);

    // Validate file type
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(fileExtension || '')) {
      setError("Please upload an Excel or CSV file (.xlsx, .xls, .csv)");
      toast({
        title: "Invalid File Format",
        description: "Please upload an Excel or CSV file (.xlsx, .xls, .csv)",
        variant: "destructive"
      });
      setIsUploading(false);
      
      // Reset the file input for future uploads
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Simulate file processing (in a real app, this would send to an API)
    setTimeout(() => {
      console.log("Processing file:", file.name);
      
      // Show success message
      toast({
        title: "Data Imported Successfully",
        description: `Imported data from ${file.name}`,
      });
      
      setIsUploading(false);
      
      // Reset the file input for future uploads
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }, 1500);
  };

  const handleOverlayControls = () => {
    toast({
      title: "Overlay Controls",
      description: "Overlay controls panel opened",
    });
  };

  return (
    <div className="flex flex-col w-full gap-4">
      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <div className="flex justify-between items-center mb-2">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".xlsx,.xls,.csv"
          className="hidden"
          aria-label="Import data file"
        />
        <Button 
          variant="outline" 
          className="flex items-center gap-2 border border-gray-300"
          onClick={handleImportData}
          disabled={isUploading}
        >
          <Upload className="h-4 w-4" />
          <span>{isUploading ? "Importing..." : "Import Data"}</span>
        </Button>
        <Button 
          variant="outline" 
          className="flex items-center gap-2 border border-gray-300"
          onClick={handleOverlayControls}
        >
          <Sliders className="h-4 w-4" />
          <span>Overlay Controls</span>
        </Button>
      </div>
    </div>
  );
}
