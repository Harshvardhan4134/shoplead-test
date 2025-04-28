import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "@/components/layout/Navbar";
import Dashboard from "@/pages/Dashboard";
import NCRTracker from "@/pages/NCRTracker";
import WorkCenters from "@/pages/WorkCenters";
import Scheduling from "@/pages/Scheduling";
import Forecasting from "@/pages/Forecasting";
import Purchase from "@/pages/Purchase";
import Logistics from "@/pages/logistics";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <main className="flex-1 bg-gray-50">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/ncr-tracking" element={<NCRTracker />} />
              <Route path="/work-centers" element={<WorkCenters />} />
              <Route path="/scheduling" element={<Scheduling />} />
              <Route path="/forecasting" element={<Forecasting />} />
              <Route path="/purchase" element={<Purchase />} />
              <Route path="/logistics" element={<Logistics />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
