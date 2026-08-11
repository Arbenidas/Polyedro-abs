import { Component, Input } from "@angular/core";
import { RouterLink } from "@angular/router";
import { ThemeService } from "../core/theme.service";

@Component({
  selector: "poly-app-header",
  standalone: true,
  imports: [RouterLink],
  template: `
    <header class="app-header" [class.is-wide]="wide">
      <a class="brand-lockup" [routerLink]="backLink" [attr.aria-label]="backLabel">
        <i aria-hidden="true"></i>
        <span><b>POLYEDRO</b><small>editorial studio</small></span>
      </a>
      <div class="header-meta">
        <span>{{ section }}</span>
        <button type="button" (click)="theme.toggle()" [attr.aria-label]="'Cambiar a tema ' + (theme.theme() === 'dark' ? 'claro' : 'oscuro')">
          <i aria-hidden="true">{{ theme.theme() === "dark" ? "D" : "L" }}</i>
          {{ theme.theme() === "dark" ? "Oscuro" : "Claro" }}
        </button>
      </div>
    </header>
  `,
  styles: [`
    :host { display: block; }
    .app-header {
      display: flex;
      width: min(100% - 48px, 1280px);
      min-height: 72px;
      justify-content: space-between;
      gap: 24px;
      align-items: center;
      margin: 0 auto;
      border-bottom: 1px solid var(--line);
    }
    .app-header.is-wide { width: min(100% - 48px, 1540px); }
    .brand-lockup {
      display: inline-flex;
      gap: 11px;
      align-items: center;
      color: var(--ink);
      text-decoration: none;
    }
    .brand-lockup > i {
      position: relative;
      width: 19px;
      height: 19px;
      border: 1px solid var(--line-strong);
      background: var(--accent-warm);
    }
    .brand-lockup > i::after {
      position: absolute;
      inset: 5px -6px -6px 5px;
      border: 1px solid var(--accent-cool);
      content: "";
    }
    .brand-lockup b,
    .brand-lockup small { display: block; }
    .brand-lockup b {
      font: 650 13px/1 var(--font-display);
      letter-spacing: -.02em;
    }
    .brand-lockup small {
      margin-top: 3px;
      color: var(--muted);
      font: 400 8px/1 var(--font-mono);
      letter-spacing: .12em;
      text-transform: uppercase;
    }
    .header-meta {
      display: flex;
      gap: 16px;
      align-items: center;
      color: var(--muted);
      font: 400 9px/1 var(--font-mono);
      letter-spacing: .12em;
      text-transform: uppercase;
    }
    .header-meta button {
      display: inline-flex;
      gap: 8px;
      align-items: center;
      padding: 8px 10px;
      border: 1px solid var(--line);
      background: var(--surface);
      color: var(--ink);
      font: inherit;
      cursor: pointer;
    }
    .header-meta button i {
      display: grid;
      width: 18px;
      height: 18px;
      place-items: center;
      border: 1px solid currentColor;
      color: var(--accent-cool);
      font-style: normal;
    }
    .header-meta button:hover { border-color: var(--accent-warm); color: var(--accent-warm); }
    @media (max-width: 620px) {
      .app-header,
      .app-header.is-wide { width: min(100% - 24px, 1540px); }
      .header-meta > span { display: none; }
    }
  `],
})
export class AppHeaderComponent {
  @Input() section = "Studio";
  @Input() backLink: string | unknown[] = "/brands/local-brand";
  @Input() backLabel = "Volver a proyectos";
  @Input() wide = false;

  constructor(readonly theme: ThemeService) {}
}
