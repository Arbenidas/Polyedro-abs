import { json, preflight, requireAuthorization } from "../_shared/http.ts";

Deno.serve(async (request) => {
  const options = preflight(request);
  if (options) return options;
  try {
    requireAuthorization(request);
    const { url } = await request.json();
    const match = String(url ?? "").match(/^https?:\/\/github\.com\/([^/]+)\/([^/#?]+)/i);
    if (!match) return json({ error: "URL pública de GitHub inválida" }, 400);
    const [repoResponse, languagesResponse] = await Promise.all([
      fetch(`https://api.github.com/repos/${encodeURIComponent(match[1])}/${encodeURIComponent(match[2])}`, { headers: { Accept: "application/vnd.github+json", "User-Agent": "Polyedro-Editorial" } }),
      fetch(`https://api.github.com/repos/${encodeURIComponent(match[1])}/${encodeURIComponent(match[2])}/languages`, { headers: { Accept: "application/vnd.github+json", "User-Agent": "Polyedro-Editorial" } }),
    ]);
    if (!repoResponse.ok) return json({ error: repoResponse.status === 404 ? "Repositorio público no encontrado" : "GitHub no respondió" }, repoResponse.status);
    const repo = await repoResponse.json();
    const languages = languagesResponse.ok ? await languagesResponse.json() : {};
    return json({
      name: repo.name, fullName: repo.full_name, description: repo.description, url: repo.html_url,
      stars: repo.stargazers_count, forks: repo.forks_count, license: repo.license?.spdx_id ?? null,
      topics: repo.topics ?? [], languages, defaultBranch: repo.default_branch, updatedAt: repo.updated_at,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    return json({ error: message }, message === "AUTH_REQUIRED" ? 401 : 500);
  }
});
