"use client";

import App from "../client/src/App.jsx";
import { AuthProvider } from "../client/src/contexts/AuthContext.jsx";

export default function LegacyClient() {
  return (
    <AuthProvider>
      <App />
    </AuthProvider>
  );
}
