import { useEffect } from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Header from "@/components/Header";
import HeroSection from "@/components/HeroSection";
import FloorPlans from "@/components/FloorPlans";
import LocationSection from "@/components/LocationSection";
import FAQ from "@/components/FAQ";
import FinalForm from "@/components/FinalForm";
import Slider3D from "@/components/Slider3D";
import Footer from "@/components/Footer";
import FloatingWhatsApp from "@/components/FloatingWhatsApp";
import CookieConsent from "@/components/CookieConsent";
import ScrollProgress from "@/components/ScrollProgress";
import LLMContext from "@/components/LLMContext";

const Home = () => {
  useEffect(() => {
    document.documentElement.style.scrollBehavior = "smooth";
  }, []);

  return (
    <div className="min-h-screen bg-[#0A1930] text-[#F0F5FA] overflow-x-hidden w-full max-w-[100vw] relative">
      <ScrollProgress />
      <Header />
      <main>
        {/* 1. Hero — title + iPhone with video */}
        <HeroSection />
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
      </main>
      <Footer />
      <LLMContext />
      <FloatingWhatsApp />
      <CookieConsent />
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
