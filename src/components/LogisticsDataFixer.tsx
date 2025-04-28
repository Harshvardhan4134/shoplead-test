import React, { useState } from 'react';
import { db } from '@/lib/db';

/**
 * A component that provides buttons to fix logistics data issues
 */
export default function LogisticsDataFixer() {
  const [isFixing, setIsFixing] = useState(false);
  const [fixResult, setFixResult] = useState<{success: boolean, message: string} | null>(null);

  const handleFixData = async () => {
    setIsFixing(true);
    setFixResult(null);
    
    try {
      // First ensure tables exist
      await db.createLogisticsTables();
      
      // Link purchase orders to jobs
      const poLinkResult = await db.linkPurchaseOrdersToJobs();
      
      // Generate vendor operations
      const vendorOpsResult = await db.generateVendorOperations();
      
      // Generate job timelines
      const timelinesResult = await db.generateJobTimelines();
      
      setFixResult({
        success: true,
        message: `Logistics data fixed successfully! Results: PO Links: ${poLinkResult ? 'Success' : 'No change'}, Vendor Ops: ${vendorOpsResult ? 'Success' : 'No change'}, Timelines: ${timelinesResult ? 'Success' : 'No change'}`
      });
    } catch (error) {
      console.error('Error fixing logistics data:', error);
      setFixResult({
        success: false,
        message: `Error fixing logistics data: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <div className="p-4 mb-4 border rounded shadow-sm bg-white">
      <h3 className="text-lg font-semibold mb-2">
        Logistics Data Management
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        If you're seeing missing data in the Vendor Operations, Related POs, or 
        Purchase Orders sections, use this tool to fix the relationships between 
        your data tables.
      </p>
      
      <div className="mt-4 flex gap-2 flex-wrap">
        <button 
          className={`px-4 py-2 rounded text-white ${isFixing ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}
          onClick={handleFixData}
          disabled={isFixing}
        >
          {isFixing ? 'Fixing Data...' : 'Fix Logistics Data'}
        </button>
      </div>
      
      {fixResult && (
        <div 
          className={`mt-4 p-3 border rounded ${fixResult.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}
        >
          {fixResult.message}
        </div>
      )}
    </div>
  );
} 