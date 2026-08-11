import { CommonModule } from "@angular/common";
import { Component, OnInit, signal } from "@angular/core";
import { RouterLink } from "@angular/router";
import { LOCAL_BRAND } from "../../editorial-presets";
import type { ContentProject } from "../content/content.models";
import { LocalLibraryService } from "../editor/local-library.service";
import { AppHeaderComponent } from "../../shared/app-header.component";

@Component({
  selector: "poly-brand-dashboard",
  standalone: true,
  imports: [CommonModule, RouterLink, AppHeaderComponent],
  templateUrl: "./brand-dashboard.component.html",
  styleUrl: "./brand-dashboard.component.css",
})
export class BrandDashboardComponent implements OnInit {
  readonly brand = LOCAL_BRAND;
  readonly projects = signal<ContentProject[]>([]);
  constructor(private readonly library: LocalLibraryService) {}
  async ngOnInit() { await this.library.initialize(); this.projects.set(await this.library.projects(this.brand.id)); }
}
