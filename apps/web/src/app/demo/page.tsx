import { env } from "@Polyedro-abs/env/web";

// Bump cuando cambie public/voice-demo/index.html para evitar cache del navegador.
const DEMO_VERSION = "3";

export default function DemoPage() {
  const params = new URLSearchParams({ api: env.NEXT_PUBLIC_SERVER_URL, v: DEMO_VERSION });
  const src = `/voice-demo/index.html?${params.toString()}`;

  return (
    <main style={{ height: "100dvh", margin: 0, overflow: "hidden" }}>
      <iframe
        src={src}
        title="Polyedro /abs voice campaign demo"
        allow="microphone; autoplay; clipboard-write"
        style={{
          border: 0,
          display: "block",
          height: "100%",
          width: "100%",
        }}
      />
    </main>
  );
}
