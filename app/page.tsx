"use client";

import {
  ArrowRight,
  BarChart3,
  FileSpreadsheet,
  LineChart,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { motion } from "framer-motion";
import { ParallaxProvider, Parallax } from "react-scroll-parallax";

export default function Home() {
  return (
    <ParallaxProvider>
      <div className="flex flex-col min-h-screen bg-background overflow-hidden">
        {/* Hero Section */}
        <section className="relative py-32 bg-gradient-to-b from-primary/5 to-primary/10 min-h-svh">
          <Parallax speed={-10}>
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1 }}
              className="container mx-auto px-4"
            >
              <div className="max-w-5xl mx-auto text-center">
                <motion.h1
                  className="text-6xl font-extrabold tracking-tight mb-6 leading-tight"
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.6 }}
                >
                  Transform Your Data Into
                  <span className="text-primary"> Actionable Insights</span>
                </motion.h1>
                <p className="text-xl text-muted-foreground mb-10">
                  Upload your CSV, Excel, or Google Sheets data and get instant
                  analysis, visualizations, and AI-powered insights.
                </p>
                <div className="flex gap-4 justify-center">
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
            </motion.div>
          </Parallax>
        </section>

        {/* Features Section */}
        <section className="relative py-32 bg-background z-10">
          <motion.div
            className="container mx-auto px-4"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            transition={{ staggerChildren: 0.2 }}
          >
            <motion.h2
              className="text-4xl font-bold text-center mb-16"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              Powerful Features for Data Analysis
            </motion.h2>
            <div className="grid md:grid-cols-3 gap-10 px-4">
              {[
                {
                  icon: (
                    <FileSpreadsheet className="w-12 h-12 text-primary mb-4" />
                  ),
                  title: "Multiple Data Sources",
                  desc: "Import data from CSV, Excel, or Google Sheets seamlessly.",
                },
                {
                  icon: <BarChart3 className="w-12 h-12 text-primary mb-4" />,
                  title: "Advanced Analytics",
                  desc: "Get instant insights with AI-powered analysis and visualizations.",
                },
                {
                  icon: <LineChart className="w-12 h-12 text-primary mb-4" />,
                  title: "Interactive Reports",
                  desc: "Generate beautiful, interactive reports and dashboards.",
                },
              ].map((feature, idx) => (
                <motion.div
                  key={idx}
                  className="p-8 bg-card rounded-2xl shadow-lg hover:shadow-xl transition-shadow border-2 border-gray-200"
                  whileHover={{ scale: 1.03 }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: idx * 0.2 }}
                >
                  {feature.icon}
                  <h3 className="text-xl font-semibold mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground">{feature.desc}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* CTA Section */}
        <section className="relative py-32 bg-primary text-primary-foreground overflow-hidden">
          <Parallax speed={10}>
            <motion.div
              className="container mx-auto px-4 text-center"
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 1 }}
            >
              <h2 className="text-4xl font-bold mb-6">
                Ready to Transform Your Data?
              </h2>
              <p className="text-xl mb-10 opacity-90">
                Start analyzing your data in minutes with our powerful platform.
              </p>
              <Link href="/upload">
                <Button
                  size="lg"
                  variant="secondary"
                  className="transition-transform hover:scale-105"
                >
                  <Upload className="mr-2" />
                  Upload Your Data
                </Button>
              </Link>
            </motion.div>
          </Parallax>
        </section>
      </div>
    </ParallaxProvider>
  );
}
