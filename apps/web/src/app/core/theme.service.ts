import { DOCUMENT } from "@angular/common";
import { Inject, Injectable, signal } from "@angular/core";

export type AppTheme = "dark" | "light";

const STORAGE_KEY = "polyedro-theme";

@Injectable({ providedIn: "root" })
export class ThemeService {
  readonly theme = signal<AppTheme>("dark");

  constructor(@Inject(DOCUMENT) private readonly document: Document) {
    const bootTheme = this.document.documentElement.dataset["theme"];
    const stored = localStorage.getItem(STORAGE_KEY);
    this.apply(stored === "light" || stored === "dark" ? stored : bootTheme === "light" ? "light" : "dark", false);
  }

  toggle() {
    this.apply(this.theme() === "dark" ? "light" : "dark");
  }

  set(theme: AppTheme) {
    this.apply(theme);
  }

  private apply(theme: AppTheme, persist = true) {
    this.theme.set(theme);
    this.document.documentElement.dataset["theme"] = theme;
    this.document.documentElement.style.colorScheme = theme;
    if (persist) localStorage.setItem(STORAGE_KEY, theme);
  }
}
