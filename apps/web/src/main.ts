import "zone.js";
import { bootstrapApplication } from "@angular/platform-browser";
import { provideRouter, withComponentInputBinding } from "@angular/router";
import { AppComponent } from "./app/app.component";
import { APP_ROUTES } from "./app/app.routes";

bootstrapApplication(AppComponent, { providers: [provideRouter(APP_ROUTES, withComponentInputBinding())] }).catch((error: unknown) => console.error(error));
