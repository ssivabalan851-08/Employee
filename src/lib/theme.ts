export type Theme = "light";

const COOKIE_NAME = "leavewise-theme";

export function currentTheme(): "light" {
  return "light";
}

export function applyTheme(_theme?: string, _remember = false): void {
  document.documentElement.dataset.theme = "light";
  document.documentElement.style.colorScheme = "light";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", "#f8fafc");
  document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function initializeTheme(): void {
  applyTheme("light");
}
