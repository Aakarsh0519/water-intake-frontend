import React, { useState, useEffect } from "react";
import API from "../api/client";

export default function SettingsModal({
  isOpen,
  onClose,
  currentGoal,
  onGoalUpdated,
  darkMode,
  setDarkMode,
  unit,
  setUnit,
  reminderInterval,
  setReminderInterval
}) {
  // Local state for all fields so changes apply cleanly on clicking Save
  const [goal, setGoal] = useState(currentGoal || 2000);
  const [tempUnit, setTempUnit] = useState(unit || "ml");
  const [tempDarkMode, setTempDarkMode] = useState(darkMode);
  const [tempReminder, setTempReminder] = useState(reminderInterval);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  // Sync internal state when modal opens
  useEffect(() => {
    if (isOpen) {
      setGoal(currentGoal || 2000);
      setTempUnit(unit || "ml");
      setTempDarkMode(darkMode);
      setTempReminder(reminderInterval);
      setStatus("");
    }
  }, [isOpen, currentGoal, unit, darkMode, reminderInterval]);

  if (!isOpen) return null;

  // Single Save Handler for all preferences
  const handleSaveAll = async (e) => {
    if (e) e.preventDefault();
    if (!goal || Number(goal) <= 0) {
      setStatus("Please enter a valid goal greater than 0.");
      return;
    }

    setSaving(true);
    setStatus("");

    try {
      // 1. Update goal in the backend
      await API.put("/users/profile/goal", { dailyGoal: Number(goal) });
      onGoalUpdated(Number(goal));

      // 2. Commit all preferences to global state & local storage
      setUnit(tempUnit);
      setDarkMode(tempDarkMode);
      setReminderInterval(tempReminder);

      setStatus("Settings saved successfully!");

      // 3. Close the modal after brief confirmation
      setTimeout(() => {
        setStatus("");
        onClose();
      }, 500);
    } catch (err) {
      setStatus(err.response?.data?.error || "Failed to update settings.");
    } finally {
      setSaving(false);
    }
  };

  const modalBg = tempDarkMode ? "#2d3748" : "#ffffff";
  const textColor = tempDarkMode ? "#f7fafc" : "#1a202c";
  const borderColor = tempDarkMode ? "#4a5568" : "#e2e8f0";

  return (
    <div style={{
      position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      display: "flex", justifyContent: "center", alignItems: "center",
      zIndex: 1000
    }}>
      <div style={{
        background: modalBg, color: textColor,
        padding: "2rem", borderRadius: "12px", width: "90%", maxWidth: "420px",
        boxShadow: "0 10px 25px rgba(0,0,0,0.2)"
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <h3 style={{ margin: 0, fontSize: "1.25rem" }}>⚙️ App Preferences</h3>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", color: textColor, fontSize: "1.2rem", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>

        {/* Daily Goal */}
        <div style={{ marginBottom: "1.2rem" }}>
          <label style={{ display: "block", fontSize: "0.9rem", marginBottom: "0.5rem", fontWeight: "600" }}>
            Personal Daily Goal (ml)
          </label>
          <input
            type="number"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            style={{
              width: "100%", padding: "8px 12px", borderRadius: "6px",
              border: `1px solid ${borderColor}`,
              background: tempDarkMode ? "#1a202c" : "#ffffff",
              color: textColor, boxSizing: "border-box"
            }}
          />
        </div>

        <hr style={{ border: "none", borderTop: `1px solid ${borderColor}`, margin: "1rem 0" }} />

        {/* Hydration Reminder */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
          <span style={{ fontSize: "0.95rem", fontWeight: "500" }}>⏰ Hydration Reminder</span>
          <select
            value={String(tempReminder)}
            onChange={(e) => {
              const val = e.target.value;
              setTempReminder(val === "auto" ? "auto" : Number(val));
            }}
            style={{
              padding: "6px 10px", borderRadius: "6px",
              border: `1px solid ${borderColor}`,
              background: tempDarkMode ? "#1a202c" : "#ffffff",
              color: textColor
            }}
          >
            <option value="auto">🤖 Auto (Smart Adaptive)</option>
            <option value="0">Off</option>
            <option value="1">Every 1 min (Demo test)</option>
            <option value="30">Every 30 mins</option>
            <option value="45">Every 45 mins</option>
            <option value="60">Every 60 mins</option>
          </select>
        </div>

        {/* Measurement Unit */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.2rem" }}>
          <span style={{ fontSize: "0.95rem", fontWeight: "500" }}>Measurement Unit</span>
          <select
            value={tempUnit}
            onChange={(e) => setTempUnit(e.target.value)}
            style={{
              padding: "6px 12px", borderRadius: "6px",
              border: `1px solid ${borderColor}`,
              background: tempDarkMode ? "#1a202c" : "#ffffff",
              color: textColor
            }}
          >
            <option value="ml">Milliliters (ml)</option>
            <option value="glasses">Glasses (250ml ea)</option>
          </select>
        </div>

        {/* Dark Theme Toggle */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <span style={{ fontSize: "0.95rem", fontWeight: "500" }}>Dark Mode</span>
          <button
            type="button"
            onClick={() => setTempDarkMode(!tempDarkMode)}
            style={{
              background: tempDarkMode ? "#4a5568" : "#edf2f7",
              color: textColor, border: "none", padding: "6px 14px",
              borderRadius: "20px", cursor: "pointer", fontWeight: "600", fontSize: "0.85rem"
            }}
          >
            {tempDarkMode ? "🌙 ON" : "☀️ OFF"}
          </button>
        </div>

        {/* Status Message */}
        {status && (
          <p style={{
            fontSize: "0.85rem", textAlign: "center", marginBottom: "1rem",
            color: status.includes("successfully") ? "#38a169" : "#e53e3e"
          }}>
            {status}
          </p>
        )}

        {/* Bottom Action Buttons: Save & Close */}
        <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving}
            style={{
              flex: 1, background: "#3182ce", color: "white", border: "none",
              padding: "10px", borderRadius: "6px", fontWeight: "600", cursor: "pointer"
            }}
          >
            {saving ? "Saving..." : "💾 Save & Close"}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent", border: `1px solid ${borderColor}`,
              color: textColor, padding: "10px 16px", borderRadius: "6px", cursor: "pointer"
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}