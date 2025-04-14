import { Parallax } from "react-scroll-parallax";
import Link from "next/link";
import { Button } from "./ui/button";
import { motion } from "framer-motion";
import { BarChart3, FileSpreadsheet, LineChart } from "lucide-react";

export default function Features() {
  return (
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
              icon: <FileSpreadsheet className="w-12 h-12 text-primary mb-4" />,
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
              <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </section>
  );
}
