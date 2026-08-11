import { Component } from "@angular/core";
import { RouterOutlet } from "@angular/router";
import { ThemeService } from "./core/theme.service";

@Component({
  selector: "poly-root",
  standalone: true,
  imports: [RouterOutlet],
  template: '<a class="skip-link" href="#main-content">Saltar al contenido</a><router-outlet />',
})
export class AppComponent {
  constructor(readonly theme: ThemeService) {}
}
