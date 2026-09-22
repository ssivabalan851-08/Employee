import React, { useState } from "react";
import { Moon, Sun } from "lucide-react";
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
      onClick={() => {
        applyTheme(nextTheme, true);
        setTheme(nextTheme);
      }}
    >
      {theme === "light" ? <Moon aria-hidden="true" size={17} /> : <Sun aria-hidden="true" size={17} />}
      <span>{theme === "light" ? "Night" : "Light"}</span>
    </button>
  );
};
