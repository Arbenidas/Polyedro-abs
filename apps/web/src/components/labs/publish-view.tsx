"use client";

import { useEffect, useState } from "react";

import {
  createSocialPost,
  listCampaignPosts,
  publishPost,
  reschedulePost,
  type CampaignDashboard,
  type SocialPost,
  type SocialPostStatus,
} from "@/lib/api";
import {
  ACID,
  cardShell,
  CARD,
  CORAL,
  CYAN,
  FONT_MONO,
  FONT_SANS,
  INK,
  RADIUS_SM,
  STONE,
  SUN,
  textOnSignal,
} from "./defs";

const POST_STATUS_STYLE: Record<SocialPostStatus, { bg: string; label: string }> = {
  draft: { bg: STONE, label: "DRAFT" },
  scheduled: { bg: SUN, label: "SCHEDULED" },
  publishing: { bg: CYAN, label: "PUBLISHING…" },
  published: { bg: ACID, label: "PUBLISHED ✓" },
  failed: { bg: CORAL, label: "FAILED" },
};

function statusChip(status: SocialPostStatus) {
  const style = POST_STATUS_STYLE[status];
  return { ...style, color: textOnSignal(style.bg) };
}

/** <input type="datetime-local"> no acepta/devuelve ISO con offset; este par
 *  de helpers convierte entre el string "local" del input y el ISO que espera
 *  el server, en la zona horaria del navegador. */
function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocalValue(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

export function PublishView({
  campaignId,
  dashboard,
}: {
  campaignId: string | null;
  dashboard: CampaignDashboard | null;
}) {
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publishableAssets = (dashboard?.agents.visualAssets ?? []).filter(
    (asset) => !!asset.imageUrl,
  );
  const [selectedAssetId, setSelectedAssetId] = useState<string>("");
  const [caption, setCaption] = useState("");
  const [scheduledAtInput, setScheduledAtInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const refresh = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      setPosts(await listCampaignPosts(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar los posts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!campaignId) {
      setPosts([]);
      return;
    }
    void refresh(campaignId);
  }, [campaignId]);

  useEffect(() => {
    if (!selectedAssetId && publishableAssets.length > 0) {
      setSelectedAssetId(publishableAssets[0]!.id);
    }
  }, [publishableAssets, selectedAssetId]);

  useEffect(() => {
    if (!caption) {
      const esCopy = dashboard?.agents.adCopies.find((copy) => copy.language === "es");
      if (esCopy?.primaryText) setCaption(esCopy.primaryText);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboard]);

  const submit = async (mode: "now" | "schedule") => {
    if (!campaignId || !selectedAssetId || !caption.trim() || submitting) return;
    if (mode === "schedule" && !scheduledAtInput) return;

    setSubmitting(true);
    setError(null);
    try {
      const scheduledAt = mode === "schedule" ? fromDatetimeLocalValue(scheduledAtInput) : null;
      const created = await createSocialPost(campaignId, {
        creativeAssetId: selectedAssetId,
        caption: caption.trim(),
        scheduledAt,
      });

      if (mode === "now") {
        await publishPost(campaignId, created.id);
      }

      setCaption("");
      setScheduledAtInput("");
      await refresh(campaignId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo crear el post.");
    } finally {
      setSubmitting(false);
    }
  };

  const publishNow = async (postId: string) => {
    if (!campaignId) return;
    setError(null);
    try {
      await publishPost(campaignId, postId);
      await refresh(campaignId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo publicar el post.");
    }
  };

  const rescheduleTo = async (postId: string, value: string) => {
    if (!campaignId) return;
    setError(null);
    try {
      await reschedulePost(campaignId, postId, fromDatetimeLocalValue(value));
      await refresh(campaignId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo reprogramar el post.");
    }
  };

  if (!campaignId) {
    return (
      <div style={{ fontFamily: FONT_MONO, fontSize: 12, opacity: 0.7 }}>
        Elegí o creá una campaña primero.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 720 }}>
      <div style={{ ...cardShell, padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em" }}>
          NUEVO POST · META GRAPH API
        </span>

        {publishableAssets.length === 0 ? (
          <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, opacity: 0.7 }}>
            No hay creatividades disponibles todavía — generá y aprobá una en Campañas primero.
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {publishableAssets.map((asset) => (
                <button
                  key={asset.id}
                  onClick={() => setSelectedAssetId(asset.id)}
                  className="nb-press"
                  style={{
                    padding: 4,
                    border: `2.5px solid ${INK}`,
                    background: selectedAssetId === asset.id ? ACID : CARD,
                    cursor: "pointer",
                  }}
                >
                  <img
                    src={asset.imageUrl ?? undefined}
                    alt={asset.altText ?? `Variante ${asset.variant.toUpperCase()}`}
                    style={{ width: 72, height: 72, objectFit: "cover", display: "block" }}
                  />
                </button>
              ))}
            </div>

            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Caption del post…"
              rows={3}
              style={{
                fontFamily: FONT_SANS,
                fontSize: 13,
                padding: 10,
                border: `2px solid ${INK}`,
                borderRadius: RADIUS_SM,
                resize: "vertical",
              }}
            />

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <input
                type="datetime-local"
                value={scheduledAtInput}
                onChange={(e) => setScheduledAtInput(e.target.value)}
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 12,
                  padding: "8px 10px",
                  border: `2px solid ${INK}`,
                  borderRadius: RADIUS_SM,
                }}
              />
              <button
                onClick={() => void submit("schedule")}
                disabled={!caption.trim() || !scheduledAtInput || submitting}
                className="nb-press"
                style={{
                  fontFamily: FONT_SANS,
                  fontSize: 12.5,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  padding: "10px 16px",
                  border: `2.5px solid ${INK}`,
                  borderRadius: RADIUS_SM,
                  background: SUN,
                  cursor: "pointer",
                }}
              >
                Programar
              </button>
              <button
                onClick={() => void submit("now")}
                disabled={!caption.trim() || submitting}
                className="nb-press"
                style={{
                  fontFamily: FONT_SANS,
                  fontSize: 12.5,
                  fontWeight: 800,
                  textTransform: "uppercase",
                  padding: "10px 16px",
                  border: `2.5px solid ${INK}`,
                  borderRadius: RADIUS_SM,
                  background: ACID,
                  cursor: "pointer",
                  marginLeft: "auto",
                }}
              >
                Publicar ahora
              </button>
            </div>
          </>
        )}
      </div>

      {error && (
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 11.5,
            color: INK,
            background: CORAL,
            border: `2px solid ${INK}`,
            padding: "8px 12px",
          }}
        >
          {error}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <span style={{ fontFamily: FONT_MONO, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em" }}>
          POSTS DE ESTA CAMPAÑA
        </span>

        {loading && <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, opacity: 0.6 }}>Cargando…</div>}
        {!loading && posts.length === 0 && (
          <div style={{ fontFamily: FONT_MONO, fontSize: 11.5, opacity: 0.6 }}>Todavía no hay posts.</div>
        )}

        {posts.map((post) => {
          const chip = statusChip(post.status);
          const editable = post.status === "draft" || post.status === "scheduled";

          return (
            <div key={post.id} style={{ ...cardShell, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: FONT_SANS, fontSize: 13, flex: 1 }}>{post.caption}</span>
                <span
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 9.5,
                    fontWeight: 700,
                    border: `2px solid ${INK}`,
                    padding: "3px 8px",
                    background: chip.bg,
                    color: chip.color,
                    whiteSpace: "nowrap",
                  }}
                >
                  {chip.label}
                </span>
              </div>

              <div style={{ fontFamily: FONT_MONO, fontSize: 10.5, opacity: 0.7 }}>
                {post.status === "published"
                  ? `Publicado ${formatDate(post.publishedAt)} · id ${post.externalPostId}`
                  : post.status === "failed"
                    ? `Error: ${post.errorMessage}`
                    : `Programado: ${formatDate(post.scheduledAt)}`}
              </div>

              {editable && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <input
                    type="datetime-local"
                    defaultValue={toDatetimeLocalValue(post.scheduledAt)}
                    onBlur={(e) => e.target.value && void rescheduleTo(post.id, e.target.value)}
                    style={{
                      fontFamily: FONT_MONO,
                      fontSize: 11.5,
                      padding: "6px 8px",
                      border: `1.5px solid ${INK}`,
                      borderRadius: RADIUS_SM,
                    }}
                  />
                  <button
                    onClick={() => void publishNow(post.id)}
                    className="nb-press"
                    style={{
                      fontFamily: FONT_SANS,
                      fontSize: 11.5,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      padding: "6px 12px",
                      border: `2px solid ${INK}`,
                      borderRadius: RADIUS_SM,
                      background: ACID,
                      cursor: "pointer",
                    }}
                  >
                    Publicar ahora
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
