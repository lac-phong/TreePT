'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const Navbar = () => {
  const pathname = usePathname() ?? '';

  return (
    <header className="bg-black border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="text-xl font-bold text-white">
            TreePT
          </Link>

          {/* User Actions */}
          <div className="flex items-center space-x-12">
            <Link
              href="/"
              className={`text-sm font-medium ${
                pathname.includes('/dashboard')
                  ? 'text-white'
                  : 'text-white hover:text-green-600'
              }`}
            >
              About
            </Link>
            <Link
              href="/github"
              className={`text-sm font-medium ${
                pathname.includes('/issues')
                  ? 'text-white'
                  : 'text-white hover:text-green-600'
              }`}
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};