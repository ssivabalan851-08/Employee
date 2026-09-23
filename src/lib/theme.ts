export type Theme = "light" | "dark";

const COOKIE_NAME = "leavewise-theme";

function savedTheme(): Theme | null {
  const value = document.cookie.split(";").map((entry) => entry.trim()).find((entry) => entry.startsWith(`${COOKIE_NAME}=`))?.split("=")[1];
  return value === "light" || value === "dark" ? value : null;
}

export function currentTheme(): Theme {
  const applied = document.documentElement.dataset.theme;
  if (applied === "light" || applied === "dark") return applied;
  return savedTheme() ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}

export function applyTheme(theme: Theme, remember = false): void {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", theme === "dark" ? "#0d1324" : "#f5f7fc");
  if (remember) {
    // Authentication clears localStorage on startup, so keep this visual choice in a cookie.
    document.cookie = `${COOKIE_NAME}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }
}

export function initializeTheme(): void {
  applyTheme(currentTheme());
}
