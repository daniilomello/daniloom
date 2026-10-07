import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DesktopRegionSelector } from './desktop/DesktopRegionSelector';
import App from "./App.tsx";
import { DialogProvider } from "./context/DialogContext";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import { DesktopAuth } from "./desktop/DesktopAuth";
import { DesktopControls } from "./desktop/DesktopControls";
import { ProjectsAdmin } from "./features/admin/components/ProjectsAdmin";
import { ProjectDetailView } from "./features/admin/components/ProjectDetailView";
import { MediaView } from "./features/media/components/MediaView";

// Register PWA Service Worker
if ("serviceWorker" in navigator && !window.daniloomDesktop) {
  registerSW({ immediate: true });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DialogProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/desktop-region" element={<DesktopRegionSelector />} />
          <Route path="/desktop-auth" element={<DesktopAuth />} />
          <Route path="/desktop-controls" element={<DesktopControls />} />
          <Route path="/projects" element={<ProjectsAdmin />} />
          <Route path="/projects/:projectId" element={<ProjectDetailView />} />
          <Route path="/media" element={<MediaView />} />
          <Route path="*" element={<App />} />
        </Routes>
      </BrowserRouter>
    </DialogProvider>
  </StrictMode>,
);
