"use client";

import { ParallaxProvider } from "react-scroll-parallax";
import CTA from "@/components/CTA";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import SliderTypes from "@/components/SliderTypes";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <ParallaxProvider>
      <div className="flex flex-col min-h-screen bg-background overflow-hidden">
        {/* Hero Section */}
        <Hero />

        {/*Data Types Slider*/}
        <SliderTypes />

        {/* Features Section */}
        <Features />

        <CTA />

        <Footer />
      </div>
    </ParallaxProvider>
  );
}
