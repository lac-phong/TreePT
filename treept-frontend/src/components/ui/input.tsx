import * as React from "react"

import { cn } from "@/lib/utils"

export function Input({ type = "text", placeholder, value, onChange }: React.InputHTMLAttributes<HTMLInputElement>) {
    return (
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="w-full p-2 border rounded-lg bg-background text-foreground border-border focus:outline-none focus:ring-2 focus:ring-primary"
      />
    );
  }