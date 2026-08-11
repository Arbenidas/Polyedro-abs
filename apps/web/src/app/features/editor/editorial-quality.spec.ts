import { describe, expect, it } from "vitest";
import type { SceneDocument } from "./editor.models";
import { applyCarouselContinuity, applyEditorialReadability, auditEditorialScene } from "./editorial-quality";

const scene = (): SceneDocument => ({ version:1,id:"scene",projectId:"p",slideId:"s",channel:"instagram_portrait",width:1080,height:1350,background:"#18181B",palette:["#D94E1E","#008F99","#18181B","#F4F4F5"],createdAt:"x",updatedAt:"x",elements:[{id:"t",type:"text",name:"Cuerpo",content:"Una idea útil",x:80,y:80,width:600,height:100,scaleX:1,scaleY:1,rotation:0,opacity:1,zIndex:1,visible:true,locked:false,fill:"#fff",fontSize:11}]});

describe("editorial quality", () => {
  it("eleva texto informativo demasiado pequeño", () => expect(applyEditorialReadability(scene()).elements[0]?.fontSize).toBeGreaterThanOrEqual(19));
  it("detecta texto pequeño antes de normalizar", () => expect(auditEditorialScene(scene()).issues.some((issue) => issue.code === "tiny-text")).toBe(true));
  it("añade progreso sin alterar una pieza individual", () => {
    expect(applyCarouselContinuity(scene(), 0, 3).elements.length).toBe(4);
    expect(applyCarouselContinuity(scene(), 0, 1).elements.length).toBe(1);
  });
});
