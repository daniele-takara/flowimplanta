import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import { Outlet } from "react-router-dom";

export default function AppLayout() {
  const [isPresentation, setIsPresentation] = useState(() => window.location.hash === "#presentation");

  useEffect(() => {
    const handler = () => setIsPresentation(window.location.hash === "#presentation");
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-50">
      {!isPresentation && <Sidebar />}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}