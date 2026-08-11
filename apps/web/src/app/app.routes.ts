import type { Routes } from "@angular/router";
import { BrandDashboardComponent } from "./features/brands/brand-dashboard.component";
import { ContentComposerComponent } from "./features/content/content-composer.component";
import { ContentEditorPageComponent } from "./features/content/content-editor-page.component";
import { TopicReviewComponent } from "./features/topic/topic-review.component";
import { PublishPageComponent } from "./features/publish/publish-page.component";
import { ShortVideoStudioComponent } from "./features/short-video/short-video-studio.component";

export const APP_ROUTES: Routes = [
  { path: "", pathMatch: "full", redirectTo: "brands/local-brand" },
  { path: "brands/:brandId", component: BrandDashboardComponent },
  { path: "brands/:brandId/content/new", component: ContentComposerComponent },
  { path: "brands/:brandId/short-video/new", component: ShortVideoStudioComponent },
  { path: "brands/:brandId/topic/:draftId/review", component: TopicReviewComponent },
  { path: "brands/:brandId/content/:postId/edit", component: ContentEditorPageComponent },
  { path: "brands/:brandId/content/:postId/publish", component: PublishPageComponent },
  { path: "**", redirectTo: "brands/local-brand" },
];
