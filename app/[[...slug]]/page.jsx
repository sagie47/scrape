"use client";

import dynamic from "next/dynamic";

const LegacyClient = dynamic(() => import("../legacy-client.jsx"), {
  ssr: false,
  loading: () => (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#030303",
        color: "#fff",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      Loading workspace...
    </main>
  ),
});

export default function CatchAllPage() {
  return <LegacyClient />;
}
