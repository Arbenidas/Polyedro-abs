import { brandRoutes } from "@/api/routes/brand";
import { campaignRoutes } from "@/api/routes/campaign";
import { Hono } from "hono";

const api = new Hono();

api.route("/brands", brandRoutes);
api.route("/", campaignRoutes);

export { api };
