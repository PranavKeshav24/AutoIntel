import { Parallax } from "react-scroll-parallax";
import Link from "next/link";
import { Button } from "./ui/button";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import hero_mockup from "../public/hero-mockup.webp";
import Image from "next/image";

export default function Hero() {
  return (
    <section className="relative py-8 sm:py-12 md:py-16 lg:py-20 h-auto lg:h-[90vh]">
      {/* Background Overlay */}
      <div className="absolute left-0 top-0 bottom-0 -z-10 w-full">
        <div className="absolute inset-0 h-full w-full bg-hero-background bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_60%,transparent_100%)]"></div>
      </div>

      {/* Bottom Gradient */}
      <div
        className="absolute left-0 right-0 bottom-0 backdrop-blur-[2px] h-40 
  bg-gradient-to-b 
  from-transparent 
  via-[rgba(233,238,255,0.5)] 
  to-[rgba(202,208,230,0.5)]
  dark:via-[rgba(20,20,30,0.5)] 
  dark:to-[rgba(49,46,129,0.5)]"
      ></div>

      <Parallax speed={-10}>
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1 }}
          className="flex flex-col h-full mx-auto px-4 pt-20 md:pt-12"
        >
          {/* Text Content */}
          <div className="flex flex-col justify-between max-w-5xl mx-auto text-center md:mb-8 lg:mb-8 mb-12">
            <motion.h1
              className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-4 sm:mb-6 leading-tight"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.6 }}
            >
              Transform Your Data
              <div className="flex flex-wrap justify-center space-x-1 sm:space-x-2 mt-2">
                <span>into</span>
                <span className="inline-flex text-indigo-700">
                  Actionable Insights
                </span>
              </div>
            </motion.h1>
            <p className="text-sm sm:text-md lg:text-md text-muted-foreground mb-8 max-w-screen-sm mx-auto">
              Upload your CSV, Excel, or Google Sheets data and get instant
              analysis, visualizations, and AI-powered insights.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/upload">
                <Button
                  size="lg"
                  className="transition-transform hover:scale-105"
                >
                  Get Started
                  <ArrowRight className="ml-2" />
                </Button>
              </Link>
              <Link href="/about">
                <Button
                  variant="outline"
                  size="lg"
                  className="transition-transform hover:scale-105"
                >
                  Learn More
                </Button>
              </Link>
            </div>
          </div>
          {/* Hero Image */}
          <div className="flex justify-center">
            <Image
              src={hero_mockup}
              alt="Hero Image"
              width={384}
              height={340}
              quality={100}
              sizes="(max-width: 768px) 100vw, 384px"
              priority={true}
              unoptimized={true}
              className="mx-auto"
            />
          </div>
        </motion.div>
      </Parallax>
    </section>
  );
}
