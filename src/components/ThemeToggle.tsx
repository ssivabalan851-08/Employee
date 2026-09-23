import React, { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { flushSync } from "react-dom";
import { applyTheme, currentTheme } from "../lib/theme.ts";

export const ThemeToggle: React.FC<{ floating?: boolean }> = ({ floating = false }) => {
  const [theme, setTheme] = useState(currentTheme);
  const nextTheme = theme === "light" ? "dark" : "light";

  return (
    <button
      type="button"
      className={`leavewise-theme-toggle ${floating ? "leavewise-theme-toggle--floating" : ""}`}
      aria-label={`Switch to ${nextTheme} mode`}
      aria-pressed={theme === "dark"}
      title={`Switch to ${nextTheme} mode`}
      onClick={(event) => {
        const switchTheme = () => flushSync(() => {
          applyTheme(nextTheme, true);
          setTheme(nextTheme);
        });
        if (document.startViewTransition && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          const bounds = event.currentTarget.getBoundingClientRect();
          document.documentElement.style.setProperty("--lw-theme-x", `${bounds.left + bounds.width / 2}px`);
          document.documentElement.style.setProperty("--lw-theme-y", `${bounds.top + bounds.height / 2}px`);
          document.startViewTransition(switchTheme);
        } else {
          switchTheme();
        }
      }}
    >
      {theme === "light" ? <Moon aria-hidden="true" size={17} /> : <Sun aria-hidden="true" size={17} />}
      <span>{theme === "light" ? "Night" : "Light"}</span>
    </button>
  );
};
