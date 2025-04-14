import Image from "next/image";
import Link from "next/link";
import { Button } from "./ui/button";
import { ArrowRight } from "lucide-react";

export default function CTA() {
  return (
    <section className=" py-16 px-4 lg:py-20 lg:flex lg:justify-center">
      <div className="overflow-hidden bg-white dark:bg-gray-900 lg:mx-8 lg:flex lg:max-w-6xl lg:w-full shadow-lg rounded-xl">
        {/* Image Section */}
        <div className="lg:w-1/2 h-64 lg:h-auto relative">
          <Image
            src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2015&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D"
            alt="Data dashboard"
            fill
            className="object-cover"
            priority
          />
        </div>

        {/* Text Section */}
        <div className="max-w-xl px-6 py-12 lg:max-w-5xl lg:w-1/2 flex flex-col justify-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-800 dark:text-white leading-tight">
            Make{" "}
            <span className="text-indigo-700 dark:text-indigo-400">
              Smarter
            </span>{" "}
            Data-Driven Decisions
          </h2>

          <p className="mt-4 text-gray-600 dark:text-gray-300 text-md leading-relaxed">
            Upload your spreadsheets or connect your favorite tools. Visualize
            trends, uncover insights, and take action — all powered by AI.
          </p>

          <div className="inline-flex mt-8">
            <Link href="/upload">
              <Button className="transition-transform hover:scale-105">
                Get started
                <ArrowRight className="ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
