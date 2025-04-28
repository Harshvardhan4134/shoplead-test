import React from 'react';
import { useRouter } from 'next/router';
import LogisticsDataFixer from '@/components/LogisticsDataFixer';

export default function LogisticsFixPage() {
  const router = useRouter();
  
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Logistics Data Management</h1>
      
      <LogisticsDataFixer />
      
      <div className="mt-8">
        <button 
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
          onClick={() => router.push('/logistics')}
        >
          Return to Logistics
        </button>
      </div>
      
      <div className="mt-8 p-4 border rounded bg-blue-50">
        <h2 className="text-lg font-semibold mb-2">Instructions</h2>
        <p className="mb-4">
          Use the button above to create relationships between your data tables and fix missing data in the logistics page.
        </p>
        <p className="mb-2">This tool will:</p>
        <ul className="list-disc pl-6">
          <li>Link Purchase Orders to Jobs</li>
          <li>Generate Vendor Operations data</li>
          <li>Create Job Timelines from your Purchase Orders and Shipment Logs</li>
          <li>Ensure all required data tables exist</li>
        </ul>
        <p className="mt-4 text-sm text-gray-600">
          After fixing the data, return to the Logistics page and refresh to see the updated information.
        </p>
      </div>
    </div>
  );
} 