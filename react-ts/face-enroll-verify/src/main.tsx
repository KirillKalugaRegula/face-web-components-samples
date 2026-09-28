import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";

const routeTitles: Record<string, string> = {
  "/": "Enroll & Verify samples",
  "/original": "Original Enroll & Verify sample",
  "/enhanced": "Extended Enroll & Verify sample",
};

document.title = routeTitles[window.location.pathname] || routeTitles["/"];

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
