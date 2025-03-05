"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card"
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
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

  const handleGetStartedClick = () => {
    router.push("/issues");
  };

  return (
    <div>
      {/* Welcome section with distinct background */}
      <section id="welcome" className="bg-green-100 py-50 mb-8">
        <div className="container mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">Welcome to TreePT</h1>
          <p className="text-lg mb-6">Contributing to a more connected Github</p>
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
              <CardTitle>Repository understanding</CardTitle>
              <CardDescription>Evaluate your project</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.</p>
            </CardContent>
            <CardFooter>
              <a href="#" className="text-green-600 hover:underline">Learn more</a>
            </CardFooter>
          </Card>
          
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Optimized issue resolution</CardTitle>
              <CardDescription>Get recognized for your efforts</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.</p>
            </CardContent>
            <CardFooter>
              <a href="#" className="text-green-600 hover:underline">Learn more</a>
            </CardFooter>
          </Card>
          
          <Card className="h-full">
            <CardHeader>
              <CardTitle>More Github contributions</CardTitle>
              <CardDescription>Empower your team</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.</p>
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
            Join millions of people already using TreePT to contribute to innovating technology.
          </p>
          <button 
            onClick={handleGetStartedClick}
            className="px-8 py-3 text-lg font-semibold text-white bg-green-600 rounded-lg 
                      hover:bg-white hover:text-green-600 hover:ring-2 hover:ring-green-600 
                      transition-all duration-300 transform hover:scale-105 shadow-lg cursor-pointer"
          >
            Get Started Today
          </button>
        </div>
      </section>
    </div>
  );
}