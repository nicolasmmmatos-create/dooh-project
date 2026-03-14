import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import TvPlayerPage from "./pages/TvPlayerPage";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import MediaLibrary from "./pages/MediaLibrary";
import Playlists from "./pages/Playlists";
import Player from "./pages/Player";
import Schedule from "./pages/Schedule";
import Analytics from "./pages/Analytics";
import MinhasTelas from "./pages/MinhasTelas";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ session, children }: { session: Session | null; children: React.ReactNode }) => {
  if (!session) return <Navigate to="/auth" replace />;
  return <>{children}</>;
};

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={session ? <Navigate to="/" replace /> : <Auth />} />
            <Route path="/player/:token" element={<Player />} />
            <Route path="/tv/:token" element={<TvPlayerPage />} />
            <Route path="/" element={<ProtectedRoute session={session}><Index /></ProtectedRoute>} />
            <Route path="/media" element={<ProtectedRoute session={session}><MediaLibrary /></ProtectedRoute>} />
            <Route path="/playlists" element={<ProtectedRoute session={session}><Playlists /></ProtectedRoute>} />
            <Route path="/schedule" element={<ProtectedRoute session={session}><Schedule /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute session={session}><Analytics /></ProtectedRoute>} />
            <Route path="/minhas-telas" element={<ProtectedRoute session={session}><MinhasTelas /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
