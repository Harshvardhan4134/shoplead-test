import React, { useState } from 'react';
import { serviceRoleClient } from '@/lib/supabaseClient';

export default function ForecastingDataFixer() {
  const [isFixing, setIsFixing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const fixForecastingData = async () => {
    setIsFixing(true);
    setResult(null);
    
    try {
      // 1. Check if the required tables exist
      const requiredTables = ['forecasts', 'products', 'customers', 'orders', 'jobs', 'work_centers'];
      let missingTables = [];
      
      // Check tables existence
      for (const table of requiredTables) {
        const { data, error } = await serviceRoleClient
          .from(table)
          .select('count');
          
        if (error) {
          missingTables.push(table);
        }
      }
      
      console.log(`Found ${missingTables.length} missing tables: ${missingTables.join(', ')}`);
      
      // 2. Create the missing tables
      let tablesCreated = 0;
      let recordsCreated = 0;
      
      // A. Create forecasts table if needed
      if (missingTables.includes('forecasts')) {
        try {
          const createForecastsSQL = `
            CREATE TABLE IF NOT EXISTS public.forecasts (
              id SERIAL PRIMARY KEY,
              product_id INTEGER NOT NULL,
              period TEXT NOT NULL,
              forecast_quantity INTEGER,
              actual_quantity INTEGER,
              variance_percent NUMERIC,
              trend TEXT,
              confidence TEXT,
              created_at TIMESTAMPTZ DEFAULT NOW(),
              updated_at TIMESTAMPTZ DEFAULT NOW()
            );
          `;
          
          await serviceRoleClient.rpc('exec_sql', { sql_query: createForecastsSQL });
          tablesCreated++;
          
          // Insert sample data
          const forecastsData = [
            {
              id: 1,
              product_id: 1,
              period: '2023-Q1',
              forecast_quantity: 1500,
              actual_quantity: 1450,
              variance_percent: -3.33,
              trend: 'stable',
              confidence: 'high',
              created_at: new Date().toISOString()
            },
            {
              id: 2,
              product_id: 1,
              period: '2023-Q2',
              forecast_quantity: 1800,
              actual_quantity: 1650,
              variance_percent: -8.33,
              trend: 'decreasing',
              confidence: 'medium',
              created_at: new Date().toISOString()
            },
            {
              id: 3,
              product_id: 2,
              period: '2023-Q1',
              forecast_quantity: 950,
              actual_quantity: 980,
              variance_percent: 3.16,
              trend: 'increasing',
              confidence: 'high',
              created_at: new Date().toISOString()
            }
          ];
          
          const { error } = await serviceRoleClient
            .from('forecasts')
            .upsert(forecastsData);
            
          if (!error) {
            recordsCreated += forecastsData.length;
          }
        } catch (e) {
          console.error('Error creating forecasts table:', e);
        }
      }
      
      // B. Create products table if needed
      if (missingTables.includes('products')) {
        try {
          const createProductsSQL = `
            CREATE TABLE IF NOT EXISTS public.products (
              id SERIAL PRIMARY KEY,
              name TEXT NOT NULL,
              sku TEXT,
              category TEXT,
              price NUMERIC,
              cost NUMERIC,
              inventory_level INTEGER,
              reorder_point INTEGER,
              lead_time_days INTEGER,
              created_at TIMESTAMPTZ DEFAULT NOW(),
              updated_at TIMESTAMPTZ DEFAULT NOW()
            );
          `;
          
          await serviceRoleClient.rpc('exec_sql', { sql_query: createProductsSQL });
          tablesCreated++;
          
          // Insert sample data
          const productsData = [
            {
              id: 1,
              name: 'Widget A',
              sku: 'WIDGET-A-001',
              category: 'Widgets',
              price: 45.99,
              cost: 15.75,
              inventory_level: 240,
              reorder_point: 50,
              lead_time_days: 14,
              created_at: new Date().toISOString()
            },
            {
              id: 2,
              name: 'Component B',
              sku: 'COMP-B-002',
              category: 'Components',
              price: 12.49,
              cost: 4.25,
              inventory_level: 780,
              reorder_point: 100,
              lead_time_days: 7,
              created_at: new Date().toISOString()
            },
            {
              id: 3,
              name: 'Assembly C',
              sku: 'ASSY-C-003',
              category: 'Assemblies',
              price: 199.99,
              cost: 68.50,
              inventory_level: 45,
              reorder_point: 15,
              lead_time_days: 21,
              created_at: new Date().toISOString()
            }
          ];
          
          const { error } = await serviceRoleClient
            .from('products')
            .upsert(productsData);
            
          if (!error) {
            recordsCreated += productsData.length;
          }
        } catch (e) {
          console.error('Error creating products table:', e);
        }
      }
      
      // C. Create customers table if needed
      if (missingTables.includes('customers')) {
        try {
          const createCustomersSQL = `
            CREATE TABLE IF NOT EXISTS public.customers (
              id SERIAL PRIMARY KEY,
              name TEXT NOT NULL,
              industry TEXT,
              contact_name TEXT,
              contact_email TEXT,
              contact_phone TEXT,
              created_at TIMESTAMPTZ DEFAULT NOW(),
              updated_at TIMESTAMPTZ DEFAULT NOW()
            );
          `;
          
          await serviceRoleClient.rpc('exec_sql', { sql_query: createCustomersSQL });
          tablesCreated++;
          
          // Insert sample data
          const customersData = [
            {
              id: 1,
              name: 'Acme Corporation',
              industry: 'Manufacturing',
              contact_name: 'John Smith',
              contact_email: 'john.smith@acme.com',
              contact_phone: '555-123-4567',
              created_at: new Date().toISOString()
            },
            {
              id: 2,
              name: 'TechSystems Inc',
              industry: 'Technology',
              contact_name: 'Sarah Johnson',
              contact_email: 'sarah.j@techsystems.com',
              contact_phone: '555-987-6543',
              created_at: new Date().toISOString()
            },
            {
              id: 3,
              name: 'Global Industries',
              industry: 'Industrial',
              contact_name: 'Michael Chen',
              contact_email: 'm.chen@globalind.com',
              contact_phone: '555-456-7890',
              created_at: new Date().toISOString()
            }
          ];
          
          const { error } = await serviceRoleClient
            .from('customers')
            .upsert(customersData);
            
          if (!error) {
            recordsCreated += customersData.length;
          }
        } catch (e) {
          console.error('Error creating customers table:', e);
        }
      }
      
      // D. Create orders table if needed
      if (missingTables.includes('orders')) {
        try {
          const createOrdersSQL = `
            CREATE TABLE IF NOT EXISTS public.orders (
              id SERIAL PRIMARY KEY,
              order_number TEXT NOT NULL,
              customer_id INTEGER,
              order_date TIMESTAMPTZ,
              total_amount NUMERIC,
              status TEXT,
              created_at TIMESTAMPTZ DEFAULT NOW(),
              updated_at TIMESTAMPTZ DEFAULT NOW()
            );
          `;
          
          await serviceRoleClient.rpc('exec_sql', { sql_query: createOrdersSQL });
          tablesCreated++;
          
          // Insert sample data
          const ordersData = [
            {
              id: 1,
              order_number: 'ORD-2023-001',
              customer_id: 1,
              order_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
              total_amount: 2500.75,
              status: 'Completed',
              created_at: new Date().toISOString()
            },
            {
              id: 2,
              order_number: 'ORD-2023-002',
              customer_id: 2,
              order_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
              total_amount: 4800.25,
              status: 'In Progress',
              created_at: new Date().toISOString()
            },
            {
              id: 3,
              order_number: 'ORD-2023-003',
              customer_id: 3,
              order_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
              total_amount: 1250.50,
              status: 'New',
              created_at: new Date().toISOString()
            }
          ];
          
          const { error } = await serviceRoleClient
            .from('orders')
            .upsert(ordersData);
            
          if (!error) {
            recordsCreated += ordersData.length;
          }
        } catch (e) {
          console.error('Error creating orders table:', e);
        }
      }
      
      // E. Create jobs table if needed
      if (missingTables.includes('jobs')) {
        try {
          const createJobsSQL = `
            CREATE TABLE IF NOT EXISTS public.jobs (
              id SERIAL PRIMARY KEY,
              job_number TEXT NOT NULL,
              description TEXT,
              customer TEXT,
              status TEXT,
              priority TEXT,
              due_date TIMESTAMPTZ,
              created_at TIMESTAMPTZ DEFAULT NOW(),
              updated_at TIMESTAMPTZ DEFAULT NOW(),
              work_center TEXT,
              estimated_hours NUMERIC,
              actual_hours NUMERIC,
              remaining_hours NUMERIC,
              reference TEXT
            );
          `;
          
          await serviceRoleClient.rpc('exec_sql', { sql_query: createJobsSQL });
          tablesCreated++;
          
          // Insert sample data
          const jobsData = [
            {
              id: 1,
              job_number: 'JOB-2023-001',
              description: 'CNC Machining for Widget Assembly',
              customer: 'Acme Corporation',
              status: 'In Progress',
              priority: 'High',
              due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
              work_center: 'CNC Machining',
              estimated_hours: 120,
              actual_hours: 80,
              remaining_hours: 40,
              reference: 'PO-12345'
            },
            {
              id: 2,
              job_number: 'JOB-2023-002',
              description: 'Precision Valve Assembly',
              customer: 'TechSystems Inc',
              status: 'Scheduled',
              priority: 'Medium',
              due_date: new Date(Date.now() + 21 * 24 * 60 * 60 * 1000).toISOString(),
              work_center: 'Assembly',
              estimated_hours: 85,
              actual_hours: 0,
              remaining_hours: 85,
              reference: 'PO-67890'
            },
            {
              id: 3,
              job_number: 'JOB-2023-003',
              description: 'Quality Inspection of Industrial Components',
              customer: 'Global Industries',
              status: 'Completed',
              priority: 'Low',
              due_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
              work_center: 'Quality Control',
              estimated_hours: 40,
              actual_hours: 38,
              remaining_hours: 0,
              reference: 'PO-24680'
            }
          ];
          
          const { error } = await serviceRoleClient
            .from('jobs')
            .upsert(jobsData);
            
          if (!error) {
            recordsCreated += jobsData.length;
          }
        } catch (e) {
          console.error('Error creating jobs table:', e);
        }
      }
      
      // F. Create work_centers table if needed
      if (missingTables.includes('work_centers')) {
        try {
          const createWorkCentersSQL = `
            CREATE TABLE IF NOT EXISTS public.work_centers (
              id SERIAL PRIMARY KEY,
              name TEXT NOT NULL UNIQUE,
              type TEXT,
              status TEXT,
              utilization INTEGER,
              active_jobs INTEGER,
              total_capacity INTEGER,
              operator_count INTEGER,
              last_maintenance TIMESTAMPTZ,
              next_maintenance TIMESTAMPTZ,
              created_at TIMESTAMPTZ DEFAULT NOW(),
              updated_at TIMESTAMPTZ DEFAULT NOW()
            );
          `;
          
          await serviceRoleClient.rpc('exec_sql', { sql_query: createWorkCentersSQL });
          tablesCreated++;
          
          // Insert sample data
          const workCentersData = [
            {
              name: 'CNC Machining',
              type: 'Manufacturing',
              status: 'Running',
              utilization: 85,
              active_jobs: 4,
              total_capacity: 100,
              operator_count: 3,
              last_maintenance: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
              next_maintenance: new Date(Date.now() + 23 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
              name: 'Assembly',
              type: 'Manufacturing',
              status: 'Running',
              utilization: 68,
              active_jobs: 2,
              total_capacity: 100,
              operator_count: 5,
              last_maintenance: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
              next_maintenance: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString()
            },
            {
              name: 'Quality Control',
              type: 'Quality',
              status: 'Idle',
              utilization: 54,
              active_jobs: 0,
              total_capacity: 100,
              operator_count: 2,
              last_maintenance: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
              next_maintenance: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString()
            }
          ];
          
          const { error } = await serviceRoleClient
            .from('work_centers')
            .upsert(workCentersData);
            
          if (!error) {
            recordsCreated += workCentersData.length;
          }
        } catch (e) {
          console.error('Error creating work_centers table:', e);
        }
      }
      
      // Set result message and reload page
      setResult(`Fixed! Created ${tablesCreated} missing tables and added ${recordsCreated} sample records. Reloading page in 3 seconds...`);
      
      // Reload page after 3 seconds
      setTimeout(() => {
        window.location.reload();
      }, 3000);
      
    } catch (error) {
      console.error('Error fixing forecasting data:', error);
      setResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsFixing(false);
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 bg-white p-4 rounded shadow-lg border border-gray-200 max-w-sm">
      <h3 className="text-lg font-bold mb-2">Forecasting Quick Fix</h3>
      <p className="text-sm text-gray-700 mb-3">
        Fix missing data in the Forecasting page by creating required database tables
      </p>
      
      {!result ? (
        <button
          className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-blue-300"
          onClick={fixForecastingData}
          disabled={isFixing}
        >
          {isFixing ? 'Fixing Forecasting Data...' : 'Fix Forecasting Data'}
        </button>
      ) : (
        <div className={`text-sm p-3 rounded ${result.startsWith('Error') ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {result}
        </div>
      )}
    </div>
  );
} 