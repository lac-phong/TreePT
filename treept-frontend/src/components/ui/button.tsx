import * as React from "react"

import { cn } from "@/lib/utils"

export function Button({ children, onClick, type = "button" }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors cursor-pointer"
    >
      {children}
    </button>
  );
}
