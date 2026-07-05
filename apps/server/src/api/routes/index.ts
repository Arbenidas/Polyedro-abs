import { brandRoutes } from "@/api/routes/brand";
import { campaignBriefRoutes } from "@/api/routes/campaign-brief";
import { campaignRoutes } from "@/api/routes/campaign";
import { transcriptionRoutes } from "@/api/routes/transcription";
import { Hono } from "hono";

const api = new Hono();

api.route("/brands", brandRoutes);
api.route("/campaign-briefs", campaignBriefRoutes);
api.route("/transcriptions", transcriptionRoutes);
api.route("/", campaignRoutes);

export { api };
