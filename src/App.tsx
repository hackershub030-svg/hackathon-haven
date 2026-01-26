import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Hackathons from "./pages/Hackathons";
import HackathonDetail from "./pages/HackathonDetail";
import Dashboard from "./pages/Dashboard";
import CreateHackathon from "./pages/CreateHackathon";
import Profile from "./pages/Profile";
import ProjectSubmission from "./pages/ProjectSubmission";
import OrganizerDashboard from "./pages/OrganizerDashboard";
import ProjectGallery from "./pages/ProjectGallery";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/hackathons" element={<Hackathons />} />
            <Route path="/gallery" element={<ProjectGallery />} />
            <Route path="/hackathon/:id" element={<HackathonDetail />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/create-hackathon"
              element={
                <ProtectedRoute>
                  <CreateHackathon />
                </ProtectedRoute>
              }
            />
            <Route
              path="/create-hackathon/:id"
              element={
                <ProtectedRoute>
                  <CreateHackathon />
                </ProtectedRoute>
              }
            />
            <Route
              path="/organizer/:id"
              element={
                <ProtectedRoute>
                  <OrganizerDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/project/:hackathonId/:teamId"
              element={
                <ProtectedRoute>
                  <ProjectSubmission />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
