export default function DemoPage() {
  return (
    <main style={{ height: "100dvh", margin: 0, overflow: "hidden" }}>
      <iframe
        src="/voice-demo/index.html"
        title="Polyedro /abs voice campaign demo"
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
