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
import AdminUsers from "@/pages/AdminUsers";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminBrands from "@/pages/AdminBrands";
import AdminLogs from "@/pages/AdminLogs";
import AdminHistory from "@/pages/AdminHistory";
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
              <Route path="/" element={<Studio />} />
              <Route path="/brands" element={<BrandHub />} />
              <Route path="/brands/:id" element={<BrandForm />} />
              <Route path="/brands/:id/edit" element={<BrandForm />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/history" element={<History />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/brands" element={<AdminBrands />} />
              <Route path="/admin/logs" element={<AdminLogs />} />
              <Route path="/admin/history" element={<AdminHistory />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
