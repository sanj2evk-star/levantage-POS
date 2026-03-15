"use client"

import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Sun, Moon, Monitor } from "lucide-react"

export function ThemeToggle({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  // Cycle: light → dark → system → light
  const nextTheme = () => {
    if (theme === "light") setTheme("dark")
    else if (theme === "dark") setTheme("system")
    else setTheme("light")
  }

  const label =
    theme === "dark" ? "Dark mode (click for auto)"
    : theme === "system" ? "Auto mode (click for light)"
    : "Light mode (click for dark)"

  if (!mounted) {
    return (
      <button className={`p-2 rounded-lg ${className}`} aria-label="Toggle theme">
        <Sun className="h-5 w-5 text-gray-400 dark:text-neutral-500" />
      </button>
    )
  }

  return (
    <button
      onClick={nextTheme}
      className={`p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-neutral-600 ${className}`}
      aria-label={label}
      title={label}
    >
      {theme === "dark" ? (
        <Moon className="h-5 w-5 text-blue-400" />
      ) : theme === "system" ? (
        <Monitor className="h-5 w-5 text-amber-500 dark:text-amber-400" />
      ) : (
        <Sun className="h-5 w-5 text-amber-500" />
      )}
    </button>
  )
}
