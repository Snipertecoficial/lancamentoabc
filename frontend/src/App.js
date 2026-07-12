import { useEffect, Suspense, lazy } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";

// Lazy loaded components (below the fold)
const FloorPlans = lazy(() => import("@/components/FloorPlans"));
const LocationSection = lazy(() => import("@/components/LocationSection"));
const FAQ = lazy(() => import("@/components/FAQ"));
const FinalForm = lazy(() => import("@/components/FinalForm"));
const Slider3D = lazy(() => import("@/components/Slider3D"));
const Footer = lazy(() => import("@/components/Footer"));
const FloatingWhatsApp = lazy(() => import("@/components/FloatingWhatsApp"));
const CookieConsent = lazy(() => import("@/components/CookieConsent"));
const ScrollProgress = lazy(() => import("@/components/ScrollProgress"));
const LLMContext = lazy(() => import("@/components/LLMContext"));

const Home = () => {
  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
  }, []);

  return (
    <div className="min-h-screen bg-[#0A1930] text-[#F0F5FA] overflow-x-hidden w-full max-w-[100vw] relative">
      <Suspense fallback={null}>
        <ScrollProgress />
      </Suspense>
      <Header />
      <main>
        {/* 1. Hero — title + iPhone with video */}
        <HeroSection />
        
        <Suspense fallback={<div className="h-32" />}>
          {/* 4. Floor plans */}
          <FloorPlans />
          {/* 6. Location */}
          <LocationSection />
          {/* 10. FAQ */}
          <FAQ />
          {/* 11. Final form — PENULTIMATE section */}
          <FinalForm />
          {/* 12. 3D immersive gallery — LAST section */}
          <Slider3D />
        </Suspense>
      </main>
      
      <Suspense fallback={null}>
        <Footer />
        <LLMContext />
        <FloatingWhatsApp />
        <CookieConsent />
      </Suspense>
    </div>
  );
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
