import React from "react";

export default function Navbar({ role, onLogout, onOpenSettings, darkMode }) {
  return (
    <nav style={{
      background: darkMode ? "#1a202c" : "#2b6cb0",
      padding: "1rem 2rem",
      display: "flex", justifyContent: "space-between", alignItems: "center",
      color: "white", fontFamily: "sans-serif",
      boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <h2 style={{ fontSize: "1.25rem", fontWeight: "bold" }}>💧 Water Intake Tracker</h2>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        <span style={{ fontSize: "0.85rem", background: "rgba(255,255,255,0.2)", padding: "4px 8px", borderRadius: "4px", textTransform: "uppercase" }}>
          Role: {role}
        </span>
        {role === "user" && (
          <button
            onClick={onOpenSettings}
            style={{ background: "rgba(255,255,255,0.15)", border: "none", color: "white", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem" }}
          >
            ⚙️ Settings
          </button>
        )}
        <button
          onClick={onLogout}
          style={{ background: "#e53e3e", border: "none", color: "white", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontSize: "0.85rem" }}
        >
          Logout
        </button>
      </div>
    </nav>
  );
}