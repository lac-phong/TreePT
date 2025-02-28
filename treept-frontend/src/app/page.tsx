"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { useEffect } from "react";

export default function Home() {
  // Function to handle smooth scrolling with proper typing
  useEffect(() => {
    // Add a smooth scroll effect when clicking on navigation items
    const handleSmoothScroll = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      if (target.classList.contains("scroll-link")) {
        e.preventDefault();
        const targetId = target.getAttribute("href");
        if (targetId) {
          const targetElement = document.querySelector(targetId) as HTMLElement;
          
          if (targetElement) {
            window.scrollTo({
              top: targetElement.offsetTop,
              behavior: "smooth"
            });
          }
        }
      }
    };

    document.addEventListener("click", handleSmoothScroll);
    
    return () => {
      document.removeEventListener("click", handleSmoothScroll);
    };
  }, []);

  return (
    <div>
      {/* Welcome section with distinct background */}
      <section id="welcome" className="bg-green-100 py-16 mb-8">
        <div className="container mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">Welcome to TreePT</h1>
          <p className="text-lg mb-6">Your sustainable solutions provider</p>
          <a href="#solutions" className="scroll-link bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 transition-colors">
            Explore Our Solutions
          </a>
        </div>
      </section>

      {/* Solutions section */}
      <section id="solutions" className="container mx-auto py-8">
        <h1 className="text-2xl font-bold mb-8 text-center">Our Solutions</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Eco-Friendly Assessment</CardTitle>
              <CardDescription>Evaluate your environmental impact</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Our comprehensive assessment helps identify areas where your business can reduce its carbon footprint and improve sustainability practices.</p>
            </CardContent>
            <CardFooter>
              <a href="#" className="text-green-600 hover:underline">Learn more</a>
            </CardFooter>
          </Card>
          
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Green Certification</CardTitle>
              <CardDescription>Get recognized for your efforts</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Our certification process validates your organization&apos;s commitment to environmental stewardship and sustainable business practices.</p>
            </CardContent>
            <CardFooter>
              <a href="#" className="text-green-600 hover:underline">Learn more</a>
            </CardFooter>
          </Card>
          
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Sustainability Training</CardTitle>
              <CardDescription>Empower your team</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Provide your employees with the knowledge and tools they need to implement eco-friendly practices throughout your organization.</p>
            </CardContent>
            <CardFooter>
              <a href="#" className="text-green-600 hover:underline">Learn more</a>
            </CardFooter>
          </Card>
        </div>
      </section>
      <section id="get-started" className="bg-green-50 py-16 mt-8">
        <div className="container mx-auto text-center">
          <h2 className="text-3xl font-bold mb-6">Ready to Make a Difference?</h2>
          <p className="text-lg mb-8 max-w-2xl mx-auto">
            Join thousands of organizations already using TreePT to improve their environmental impact and build a more sustainable future.
          </p>
          <button 
            className="px-8 py-3 text-lg font-semibold text-white bg-green-600 rounded-lg 
                      hover:bg-white hover:text-green-600 hover:ring-2 hover:ring-green-600 
                      transition-all duration-300 transform hover:scale-105 shadow-lg"
          >
            Get Started Today
          </button>
        </div>
      </section>
    </div>
  );
}