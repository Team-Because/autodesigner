import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { DashboardLayout } from "@/components/DashboardLayout";
import Dashboard from "@/pages/Dashboard";
import BrandHub from "@/pages/BrandHub";
import BrandForm from "@/pages/BrandForm";

import Studio from "@/pages/Studio";
import History from "@/pages/History";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/brands" element={<BrandHub />} />
              <Route path="/brands/:id" element={<BrandForm />} />
              <Route path="/brands/:id/edit" element={<BrandForm />} />
              <Route path="/brands/:brandId/campaigns/new" element={<CampaignForm />} />
              <Route path="/brands/:brandId/campaigns/:campaignId/edit" element={<CampaignForm />} />
              <Route path="/studio" element={<Studio />} />
              <Route path="/history" element={<History />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
