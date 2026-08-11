import { CommonModule } from "@angular/common";
import { Component, OnInit, computed, signal } from "@angular/core";
import { ActivatedRoute, Router, RouterLink } from "@angular/router";
import type { EditorialSlide } from "../../editorial.models";
import { LOCAL_BRAND } from "../../editorial-presets";
import { EditorWorkspaceComponent } from "../editor/editor-workspace.component";
import type { SceneDocument } from "../editor/editor.models";
import { LocalLibraryService } from "../editor/local-library.service";
import { ExportService } from "../editor/export.service";
import { SceneThumbnailComponent } from "../editor/scene-thumbnail.component";
import type { ContentProject, HookCandidate } from "./content.models";
import { AppHeaderComponent } from "../../shared/app-header.component";

@Component({selector:"poly-content-editor-page",standalone:true,imports:[CommonModule,RouterLink,EditorWorkspaceComponent,SceneThumbnailComponent,AppHeaderComponent],templateUrl:"./content-editor-page.component.html",styleUrl:"./content-editor-page.component.css"})
export class ContentEditorPageComponent implements OnInit {
  readonly brand = LOCAL_BRAND;
  readonly brandId = this.route.snapshot.paramMap.get("brandId") ?? LOCAL_BRAND.id;
  readonly project = signal<ContentProject | null>(null);
  readonly scenes = signal<Record<string,SceneDocument>>({});
  readonly loading = signal(true);
  readonly notice = signal<string | null>(null);
  readonly exporting = signal<"zip" | "pdf" | null>(null);
  readonly selectedSlide = computed(()=>{
    const project=this.project(); if(!project)return null;
    const id=project.selectedSlideId; const index=project.slideOrder.indexOf(id); const plan=project.plan.slides.find((item)=>item.id===id); if(!plan)return null;
    return this.toSlide(plan.id,index,plan.headline,plan.body,plan.recipeId);
  });
  readonly selectedScene = computed(()=>{const id=this.project()?.selectedSlideId;return id?this.scenes()[id]??null:null});
  readonly activeHook = computed(()=>{const plan=this.project()?.plan;return plan?.hookCandidates.find((item)=>item.id===plan.selectedHookId)??plan?.hookCandidates[0]});
  constructor(private readonly route:ActivatedRoute,private readonly router:Router,private readonly library:LocalLibraryService,private readonly exporter:ExportService){}
  async ngOnInit(){await this.library.initialize();const id=this.route.snapshot.paramMap.get("postId")!;const project=await this.library.project(id);if(!project){await this.router.navigate(["/brands",this.brand.id]);return}this.project.set(project);const scenes:Record<string,SceneDocument>={};for(const slideId of project.slideOrder){const scene=await this.library.scene(`scene-${slideId}`);if(scene)scenes[slideId]=scene}this.scenes.set(scenes);this.loading.set(false)}
  planSlide(id:string){return this.project()?.plan.slides.find((item)=>item.id===id)}
  selectSlide(id:string){const project=this.project();if(!project)return;this.project.set({...project,selectedSlideId:id,updatedAt:new Date().toISOString()});void this.persist()}
  onSceneChanged(scene:SceneDocument){this.scenes.update((items)=>({...items,[scene.slideId]:scene}))}
  async move(id:string,direction:-1|1){const project=this.project();if(!project)return;const from=project.slideOrder.indexOf(id);const to=from+direction;if(to<0||to>=project.slideOrder.length)return;const order=[...project.slideOrder];[order[from],order[to]]=[order[to],order[from]];this.project.set({...project,slideOrder:order,updatedAt:new Date().toISOString()});await this.persist();this.notice.set("Orden del storyboard guardado.")}
  async duplicate(id:string){const project=this.project();const source=this.scenes()[id];const plan=this.planSlide(id);if(!project||!source||!plan)return;const newId=crypto.randomUUID();const index=project.slideOrder.indexOf(id)+1;const scene:SceneDocument={...structuredClone(source),id:`scene-${newId}`,slideId:newId,elements:source.elements.map((item)=>({...item,id:crypto.randomUUID()})),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};await this.library.saveScene(scene);const nextPlan={...structuredClone(plan),id:newId};const slides=[...project.plan.slides];slides.splice(index,0,nextPlan);const order=[...project.slideOrder];order.splice(index,0,newId);this.scenes.update((items)=>({...items,[newId]:scene}));this.project.set({...project,plan:{...project.plan,slides,recommendedSlideCount:slides.length},slideOrder:order,selectedSlideId:newId,updatedAt:new Date().toISOString()});await this.persist()}
  async remove(id:string){const project=this.project();if(!project||project.slideOrder.length===1)return;const order=project.slideOrder.filter((item)=>item!==id);const slides=project.plan.slides.filter((item)=>item.id!==id);const selectedSlideId=project.selectedSlideId===id?order[0]:project.selectedSlideId;await this.library.deleteScene(`scene-${id}`);this.scenes.update((items)=>{const next={...items};delete next[id];return next});this.project.set({...project,plan:{...project.plan,slides,recommendedSlideCount:slides.length},slideOrder:order,selectedSlideId,updatedAt:new Date().toISOString()});await this.persist()}
  async changeHook(hook:HookCandidate){const project=this.project();if(!project)return;const firstId=project.slideOrder[0];const slides=project.plan.slides.map((slide)=>slide.id===firstId?{...slide,headline:hook.text}:slide);const scene=this.scenes()[firstId];if(scene){const next={...scene,elements:scene.elements.map((item)=>item.name==="Titular"?{...item,content:hook.text}:item),updatedAt:new Date().toISOString()};await this.library.saveScene(next);this.scenes.update((items)=>({...items,[firstId]:next}))}this.project.set({...project,plan:{...project.plan,selectedHookId:hook.id,slides},updatedAt:new Date().toISOString()});await this.persist();this.notice.set("Hook actualizado sin perder la composición.")}
  async exportCarousel(format:"zip"|"pdf"){
    const project=this.project();if(!project||this.exporting())return;
    const scenes=project.slideOrder.map((id)=>this.scenes()[id]).filter((scene):scene is SceneDocument=>Boolean(scene));
    if(!scenes.length)return;
    this.exporting.set(format);this.notice.set(format==="zip"?"Preparando PNGs ordenados…":"Preparando PDF multipágina…");
    try{
      const slug=project.plan.topic.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,50)||"carrusel";
      if(format==="zip")await this.exporter.exportCarouselZip(scenes,`${slug}-instagram.zip`);
      else await this.exporter.exportCarouselPdf(scenes,`${slug}-linkedin.pdf`);
      this.notice.set(format==="zip"?"Carrusel PNG exportado en orden.":"PDF de LinkedIn exportado.");
    }catch(error){this.notice.set(error instanceof Error?error.message:"No se pudo exportar el carrusel.");}
    finally{this.exporting.set(null);}
  }
  private toSlide(id:string,index:number,headline:string,body:string,composition:string):EditorialSlide{return{id,post_id:this.project()!.id,slide_order:index+1,headline,body,composition,image_url:null}}
  private async persist(){const project=this.project();if(project)await this.library.saveProject(project)}
}
