export type ThemePref = "light" | "dark" | "system";

const KEY = "lf_theme";

function systemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

/** Terapkan tema ke <html data-theme>. "system"/kosong = ikuti OS (tanpa atribut). */
export function applyTheme(pref: ThemePref | null | undefined): void {
  const root = document.documentElement;
  if (!pref || pref === "system") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", pref);
  }
}

export function getCachedTheme(): ThemePref {
  const v = localStorage.getItem(KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

export function cacheTheme(pref: ThemePref): void {
  localStorage.setItem(KEY, pref);
}

/** Tema efektif saat ini (untuk label/status UI). */
export function effectiveTheme(): "light" | "dark" {
  const cached = getCachedTheme();
  return cached === "system" ? systemTheme() : cached;
}

/** Panggil sekali saat boot agar tema langsung benar sebelum fetch backend. */
export function initTheme(): () => void {
  applyTheme(getCachedTheme());
  const mq = window.matchMedia("(prefers-color-scheme: light)");
  const onChange = () => {
    if (getCachedTheme() === "system") applyTheme("system");
  };
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
