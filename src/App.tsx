import { lazy, Suspense } from "react";
import { HelmetProvider } from "react-helmet-async";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { DataPreloaderProvider } from "@/contexts/DataPreloaderContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { Loader2 } from "lucide-react";
// Lazy load pages for code splitting
const Landing = lazy(() => import("./pages/Landing"));
const Auth = lazy(() => import("./pages/Auth"));
const ProfileSetup = lazy(() => import("./pages/ProfileSetup"));
const ProfileEdit = lazy(() => import("./pages/ProfileEdit"));
const StyleGenerator = lazy(() => import("./pages/StyleGenerator"));
const Cart = lazy(() => import("./pages/Cart"));
const Install = lazy(() => import("./pages/Install"));
const Admin = lazy(() => import("./pages/Admin"));
const Pricing = lazy(() => import("./pages/Pricing"));
const Pitch = lazy(() => import("./pages/Pitch"));
const MyPage = lazy(() => import("./pages/MyPage"));
const SharedLook = lazy(() => import("./pages/SharedLook"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Cafe24Fitting = lazy(() => import("./pages/Cafe24Fitting"));
const Community = lazy(() => import("./pages/Community"));
const UserGallery = lazy(() => import("./pages/UserGallery"));

// Optimized QueryClient configuration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 30, // 30 minutes (garbage collection)
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Loading fallback component
const PageLoader = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <Loader2 className="w-8 h-8 animate-spin text-accent" />
  </div>
);

const App = () => (
  <HelmetProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LanguageProvider>
        <DataPreloaderProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/profile-setup" element={<ProfileSetup />} />
                  <Route path="/profile-edit" element={<ProfileEdit />} />
                  <Route path="/style" element={<StyleGenerator />} />
                  <Route path="/cart" element={<Cart />} />
                  <Route path="/install" element={<Install />} />
                  <Route path="/admin" element={<Admin />} />
                  <Route path="/pricing" element={<Pricing />} />
                  <Route path="/pitch" element={<Pitch />} />
                  <Route path="/mypage" element={<MyPage />} />
                  <Route path="/look/:lookId" element={<SharedLook />} />
                  <Route path="/privacy" element={<Privacy />} />
                  <Route path="/terms" element={<Terms />} />
                  <Route path="/cafe24-fitting" element={<Cafe24Fitting />} />
                  <Route path="/community" element={<Community />} />
                  <Route path="/gallery/:userId" element={<UserGallery />} />
                  {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
        </DataPreloaderProvider>
      </AuthProvider>
    </QueryClientProvider>
  </HelmetProvider>
);

export default App;