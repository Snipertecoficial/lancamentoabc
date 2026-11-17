import { useEffect, Suspense, lazy } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import ErrorBoundary from "@/components/ErrorBoundary";
import { initRadar } from "@/lib/radar";
import { retryPendingLead } from "@/lib/radar/pendingLead";
import { LeadCaptureProvider } from "@/components/LeadCaptureProvider";

// Lazy loaded components (below the fold)
const FAQ = lazy(() => import("@/components/FAQ"));
const FinalForm = lazy(() => import("@/components/FinalForm"));
const Slider3D = lazy(() => import("@/components/Slider3D"));
const Footer = lazy(() => import("@/components/Footer"));

const CookieConsent = lazy(() => import("@/components/CookieConsent"));
const ScrollProgress = lazy(() => import("@/components/ScrollProgress"));
const LLMContext = lazy(() => import("@/components/LLMContext"));
const ThankYou = lazy(() => import("@/components/ThankYou"));
const PrivacyPage = lazy(() => import("@/components/PrivacyPage"));

// Admin panel: separate lazy chunks, so the LP bundle never carries supabase-js.
const LoginPage = lazy(() => import("@/painel/LoginPage"));
const PainelApp = lazy(() => import("@/painel/PainelApp"));

const Home = () => {
  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
  }, []);

  return (
    <LeadCaptureProvider>
      <div className="min-h-screen bg-[#0A1930] text-[#F0F5FA] overflow-x-hidden w-full max-w-[100vw] relative">
        <Suspense fallback={null}>
          <ScrollProgress />
        </Suspense>
        <Header />
        <main>
          {/* 1. Hero — title + iPhone with video */}
          <HeroSection />
        
          <Suspense fallback={<div className="h-32" />}>
            {/* 2. Lead form right after the hero (it used to sit ~5 phone screens down, after the FAQ) */}
            <FinalForm />
            {/* 3. FAQ */}
            <FAQ />
            {/* 12. 3D immersive gallery — LAST section */}
            <Slider3D />
          </Suspense>
        </main>
      
        <Suspense fallback={null}>
          <Footer />
          <LLMContext />
          <CookieConsent />
        </Suspense>
      </div>
    </LeadCaptureProvider>
  );
};

function App() {
  useEffect(() => {
    initRadar(); // idempotent (safe under StrictMode); no-op without REACT_APP_RADAR_URL or on /login, /painel
    retryPendingLead(); // a lead whose submit failed in this tab gets one silent retry (pendingLead.js)
  }, []);

  return (
    <div className="App">
      <BrowserRouter>
        <ErrorBoundary>
          <Suspense fallback={<div className="min-h-screen bg-[#0A1930]" />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/obrigado" element={<ThankYou />} />
              <Route path="/privacidade" element={<LeadCaptureProvider><PrivacyPage /></LeadCaptureProvider>} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/painel/*" element={<PainelApp />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </div>
  );
}

export default App;
