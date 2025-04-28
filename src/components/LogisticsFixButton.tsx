import React, { useState } from 'react';
import { db } from '@/lib/db';

export default function LogisticsFixButton() {
  const [isFixing, setIsFixing] = useState(false);
  const [fixed, setFixed] = useState(false);

  const runFix = async () => {
    setIsFixing(true);
    try {
      // 1. Ensure tables exist
      await db.createLogisticsTables();
      
      // 2. Link purchase orders to jobs
      await db.linkPurchaseOrdersToJobs();
      
      // 3. Generate vendor operations
      await db.generateVendorOperations();
      
      // 4. Generate job timelines
      await db.generateJobTimelines();
      
      setFixed(true);
      
      // Reload the page after 2 seconds to show fixed data
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (error) {
      console.error('Error fixing logistics data:', error);
      alert('Error fixing data. See console for details.');
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {fixed ? (
        <div className="bg-green-100 text-green-700 px-4 py-2 rounded shadow-lg">
          Data fixed! Reloading...
        </div>
      ) : (
        <button
          className="px-4 py-2 bg-blue-600 text-white rounded shadow-lg hover:bg-blue-700"
          onClick={runFix}
          disabled={isFixing}
        >
          {isFixing ? 'Fixing...' : 'Fix Logistics Data'}
        </button>
      )}
    </div>
  );
} 