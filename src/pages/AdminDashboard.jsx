import React, { useState, useEffect } from "react";
import API from "../api/client";

const SLICE_COLORS = [
  "#3182ce", "#38a169", "#dd6b20", "#805ad5", 
  "#d69e2e", "#319795", "#e53e3e", "#00b5d8",
  "#d53f8c", "#4fd1c5", "#667eea", "#ed8936"
];

export default function AdminDashboard({ currentAdminId, darkMode }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inspectUser, setInspectUser] = useState(null);
  const [inspectLogs, setInspectLogs] = useState([]);
  const [inspectLoading, setInspectLoading] = useState(false);
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [tempGoal, setTempGoal] = useState("");

  // Inspect Modal Inline Goal Edit
  const [isEditingInspectGoal, setIsEditingInspectGoal] = useState(false);
  const [inspectModalGoalInput, setInspectModalGoalInput] = useState("");

  const [hoveredSlice, setHoveredSlice] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const bgCard = darkMode ? "#1e293b" : "#ffffff";
  const textCol = darkMode ? "#f8fafc" : "#1e293b";
  const subText = darkMode ? "#94a3b8" : "#64748b";
  const borderCol = darkMode ? "#334155" : "#e2e8f0";

  const fetchUsers = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await API.get("/users");
      setUsers(res.data || []);
    } catch (err) {
      console.error("Failed to load users:", err);
      setError(err.response?.data?.error || "Failed to fetch user list from server");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  // FILTER OUT ADMIN ACCOUNTS: Keep only standard users
  const standardUsers = users.filter((u) => u.role !== "admin" && u._id !== currentAdminId);

  // Compute metrics exclusively for standard users
  const totalRegistered = standardUsers.length;
  const totalIntakeIntervals = standardUsers.reduce(
    (sum, u) => sum + (u.totalLogsCount || u.logsCount || (u.totalIntake > 0 ? Math.ceil(u.totalIntake / 250) : 0)),
    0
  );
  const totalIntakeAll = standardUsers.reduce((sum, u) => sum + (u.totalIntake || 0), 0);
  const avgIntake = totalRegistered > 0 ? Math.round(totalIntakeAll / totalRegistered) : 0;

  const handleInspect = async (userItem) => {
    setInspectUser(userItem);
    setInspectLoading(true);
    setHoveredSlice(null);
    setIsEditingInspectGoal(false);
    setInspectModalGoalInput(String(userItem.dailyGoal || 2000));
    try {
      const res = await API.get(`/intake/user/${userItem._id}`);
      setInspectLogs(res.data || []);
    } catch (err) {
      console.error("Failed to load user logs:", err);
      alert(err.response?.data?.error || "Could not fetch user intake details");
    } finally {
      setInspectLoading(false);
    }
  };

  const handleDeleteUser = async (userId, userEmail) => {
    const confirmDelete = window.confirm(
      `Are you sure you want to permanently delete user account: ${userEmail}?`
    );
    if (!confirmDelete) return;

    try {
      await API.delete(`/users/${userId}`);
      alert(`User ${userEmail} successfully deleted.`);
      fetchUsers();
      if (inspectUser && inspectUser._id === userId) {
        setInspectUser(null);
      }
    } catch (err) {
      alert(err.response?.data?.error || "Failed to delete user account");
    }
  };

  const handleSaveGoal = async (userId, customAmount) => {
    const goalNum = Number(customAmount !== undefined ? customAmount : tempGoal);
    if (!goalNum || goalNum <= 0) {
      return alert("Daily goal must be greater than 0 ml");
    }
    try {
      await API.put(`/users/${userId}/goal`, { dailyGoal: goalNum });
      setEditingGoalId(null);
      setIsEditingInspectGoal(false);
      fetchUsers();
      if (inspectUser && inspectUser._id === userId) {
        setInspectUser((prev) => ({ ...prev, dailyGoal: goalNum }));
      }
    } catch (err) {
      alert(err.response?.data?.error || "Failed to update daily goal");
    }
  };

  // Inspect Modal Donut Chart
  const renderInspectDonut = () => {
    const goal = inspectUser.dailyGoal || 2000;
    const total = inspectLogs.reduce((sum, l) => sum + (l.amount || 0), 0);
    const remaining = Math.max(0, goal - total);
    const chartTotal = Math.max(goal, total);
    const radius = 68;
    const circumference = 2 * Math.PI * radius;
    let accumulatedOffset = 0;

    const slices = inspectLogs.map((log, idx) => ({
      _id: log._id || idx,
      amount: log.amount,
      date: log.date,
      color: SLICE_COLORS[idx % SLICE_COLORS.length]
    }));

    if (remaining > 0) {
      slices.push({
        _id: "remaining",
        amount: remaining,
        date: null,
        isRemaining: true,
        color: darkMode ? "#374151" : "#e2e8f0"
      });
    }

    const percent = Math.min(100, Math.round((total / goal) * 100));

    return (
      <div style={{ position: "relative", width: "160px", height: "160px", margin: "0 auto" }}>
        <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: "rotate(-90deg)" }}>
          {slices.map((slice) => {
            const fraction = slice.amount / chartTotal;
            const strokeDasharray = `${fraction * circumference} ${circumference}`;
            const strokeDashoffset = -accumulatedOffset;
            accumulatedOffset += fraction * circumference;
            const isHovered = hoveredSlice && hoveredSlice._id === slice._id;

            return (
              <circle
                key={slice._id}
                cx="80"
                cy="80"
                r={radius}
                fill="transparent"
                stroke={slice.color}
                strokeWidth={isHovered ? "24" : "18"}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                style={{
                  cursor: "pointer",
                  transition: "stroke-width 0.2s ease",
                  opacity: hoveredSlice && !isHovered ? 0.45 : 1
                }}
                onMouseEnter={(e) => {
                  setHoveredSlice(slice);
                  setTooltipPos({ x: e.clientX, y: e.clientY });
                }}
                onMouseMove={(e) => setTooltipPos({ x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHoveredSlice(null)}
              />
            );
          })}
        </svg>

        <div style={{
          position: "absolute", top: 0, left: 0, width: "100%", height: "100%",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          pointerEvents: "none", textAlign: "center"
        }}>
          <span style={{ fontSize: "1.1rem", fontWeight: "800", color: "#3182ce" }}>{total} ml</span>
          <span style={{ fontSize: "0.7rem", color: "#a0aec0" }}>Goal: {goal} ml</span>
          <span style={{ fontSize: "0.75rem", fontWeight: "bold", color: "#38a169" }}>{percent}%</span>
        </div>
      </div>
    );
  };

  const getInspect7DaysSummary = () => {
    const days = [];
    const userGoal = inspectUser?.dailyGoal || 2000;
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString();

      const dayTotal = inspectLogs
        .filter((log) => new Date(log.date).toLocaleDateString() === dateStr)
        .reduce((sum, log) => sum + (log.amount || 0), 0);

      days.push({
        label: d.toLocaleDateString([], { weekday: "short" }),
        total: dayTotal,
        percent: Math.min(100, Math.round((dayTotal / userGoal) * 100)),
      });
    }
    return days;
  };

  return (
    <div style={{ maxWidth: "1000px", margin: "1.5rem auto", padding: "0 1rem", fontFamily: "sans-serif" }}>
      {hoveredSlice && (
        <div style={{
          position: "fixed",
          left: `${tooltipPos.x + 12}px`,
          top: `${tooltipPos.y + 12}px`,
          background: darkMode ? "#1e293b" : "#0f172a",
          color: "#ffffff",
          padding: "8px 12px",
          borderRadius: "8px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
          pointerEvents: "none",
          zIndex: 99999,
          fontSize: "0.85rem"
        }}>
          {hoveredSlice.isRemaining ? (
            <div>
              <div style={{ color: "#94a3b8" }}>⏳ Remaining Goal</div>
              <div style={{ fontWeight: "700" }}>{hoveredSlice.amount} ml</div>
            </div>
          ) : (
            <div>
              <div style={{ color: "#60a5fa", fontWeight: "700" }}>💧 Intake: +{hoveredSlice.amount} ml</div>
              <div style={{ fontSize: "0.75rem", color: "#cbd5e1" }}>
                ⏰ Time: {new Date(hoveredSlice.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap", gap: "0.5rem" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.5rem", fontWeight: "700" }}>👥 Admin Management Portal</h2>
          <span style={{ fontSize: "0.85rem", color: subText }}>Monitor registered hydration accounts, set targets, and audit logs.</span>
        </div>
        <button
          onClick={fetchUsers}
          style={{ background: "#2563eb", color: "white", border: "none", padding: "8px 16px", borderRadius: "6px", fontWeight: "600", cursor: "pointer", fontSize: "0.85rem" }}
        >
          🔄 Refresh Data
        </button>
      </div>

      {error && <div style={{ background: "#fee2e2", color: "#b91c1c", padding: "10px", borderRadius: "8px", marginBottom: "1rem" }}>{error}</div>}

      {/* METRIC CARDS (Standard Users Only) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
        <div style={{ background: bgCard, border: `1px solid ${borderCol}`, padding: "1.2rem", borderRadius: "10px" }}>
          <span style={{ fontSize: "0.8rem", color: subText, fontWeight: "600", textTransform: "uppercase" }}>Registered Users</span>
          <div style={{ fontSize: "1.8rem", fontWeight: "800", color: "#2563eb", marginTop: "4px" }}>{totalRegistered}</div>
          <span style={{ fontSize: "0.75rem", color: subText }}>Active user accounts</span>
        </div>

        <div style={{ background: bgCard, border: `1px solid ${borderCol}`, padding: "1.2rem", borderRadius: "10px" }}>
          <span style={{ fontSize: "0.8rem", color: subText, fontWeight: "600", textTransform: "uppercase" }}>Water Intake Intervals</span>
          <div style={{ fontSize: "1.8rem", fontWeight: "800", color: "#059669", marginTop: "4px" }}>
            {totalIntakeIntervals}
          </div>
          <span style={{ fontSize: "0.75rem", color: subText }}>Logged user drinking sessions</span>
        </div>

        <div style={{ background: bgCard, border: `1px solid ${borderCol}`, padding: "1.2rem", borderRadius: "10px" }}>
          <span style={{ fontSize: "0.8rem", color: subText, fontWeight: "600", textTransform: "uppercase" }}>Average Intake / User</span>
          <div style={{ fontSize: "1.8rem", fontWeight: "800", color: "#d97706", marginTop: "4px" }}>{avgIntake.toLocaleString()} ml</div>
          <span style={{ fontSize: "0.75rem", color: subText }}>Avg user hydration volume</span>
        </div>
      </div>

      {/* USERS DIRECTORY (Standard Users Only) */}
      <div style={{ background: bgCard, border: `1px solid ${borderCol}`, borderRadius: "10px", padding: "1.25rem" }}>
        <h3 style={{ margin: "0 0 1rem 0", fontSize: "1.1rem" }}>Registered Users Directory</h3>
        {loading ? (
          <p style={{ color: subText }}>Loading users...</p>
        ) : standardUsers.length === 0 ? (
          <p style={{ color: subText, margin: "0.5rem 0" }}>No standard user accounts found.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
              <thead>
                <tr style={{ borderBottom: `2px solid ${borderCol}`, textAlign: "left", color: subText }}>
                  <th style={{ padding: "10px 8px" }}>User Email</th>
                  <th style={{ padding: "10px 8px" }}>Daily Goal</th>
                  <th style={{ padding: "10px 8px" }}>Total Intake</th>
                  <th style={{ padding: "10px 8px", textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {standardUsers.map((u) => {
                  const isEditingGoal = editingGoalId === u._id;
                  return (
                    <tr key={u._id} style={{ borderBottom: `1px solid ${borderCol}` }}>
                      <td style={{ padding: "12px 8px" }}>
                        <div style={{ fontWeight: "600" }}>
                          {u.email}
                        </div>
                      </td>
                      <td style={{ padding: "12px 8px" }}>
                        {isEditingGoal ? (
                          <div style={{ display: "flex", gap: "6px" }}>
                            <input
                              type="number"
                              value={tempGoal}
                              onChange={(e) => setTempGoal(e.target.value)}
                              style={{ width: "70px", padding: "4px", borderRadius: "4px", border: `1px solid ${borderCol}`, background: darkMode ? "#0f172a" : "#fff", color: textCol }}
                            />
                            <button onClick={() => handleSaveGoal(u._id)} style={{ background: "#059669", color: "white", border: "none", padding: "4px 8px", borderRadius: "4px", cursor: "pointer" }}>Save</button>
                            <button onClick={() => setEditingGoalId(null)} style={{ background: borderCol, color: textCol, border: "none", padding: "4px 8px", borderRadius: "4px", cursor: "pointer" }}>✕</button>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontWeight: "700", color: "#2563eb" }}>{u.dailyGoal || 2000} ml</span>
                            <button onClick={() => { setEditingGoalId(u._id); setTempGoal(String(u.dailyGoal || 2000)); }} style={{ background: "transparent", border: "none", cursor: "pointer" }}>✏️</button>
                          </div>
                        )}
                      </td>
                      <td style={{ padding: "12px 8px", fontWeight: "700", color: "#059669" }}>{u.totalIntake || 0} ml</td>
                      <td style={{ padding: "12px 8px", textAlign: "center" }}>
                        <div style={{ display: "flex", justifyContent: "center", gap: "8px" }}>
                          <button onClick={() => handleInspect(u)} style={{ background: darkMode ? "#334155" : "#e0f2fe", color: darkMode ? "#93c5fd" : "#0369a1", border: "none", padding: "6px 12px", borderRadius: "6px", fontWeight: "600", cursor: "pointer" }}>🔍 Inspect</button>
                          <button onClick={() => handleDeleteUser(u._id, u.email)} style={{ background: "#fee2e2", color: "#dc2626", border: "none", padding: "6px 12px", borderRadius: "6px", fontWeight: "600", cursor: "pointer" }}>🗑️ Delete</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* INSPECT MODAL WINDOW */}
      {inspectUser && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.7)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1400 }}>
          <div style={{ background: bgCard, color: textCol, padding: "1.5rem", borderRadius: "14px", width: "92%", maxWidth: "540px", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 40px rgba(0,0,0,0.5)", border: `1px solid ${borderCol}`, overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "700" }}>🔍 User Intake Audit & Logs</h3>
                <span style={{ fontSize: "0.8rem", color: subText }}>{inspectUser.email}</span>
              </div>
              <button onClick={() => setInspectUser(null)} style={{ background: "transparent", border: "none", color: subText, fontSize: "1.4rem", cursor: "pointer" }}>✕</button>
            </div>

            {/* DONUT CHART */}
            <div style={{ padding: "0.5rem 0", textAlign: "center" }}>
              {renderInspectDonut()}
              <span style={{ fontSize: "0.75rem", color: subText, display: "block", marginTop: "4px" }}>Hover over slices to view intake time & amount</span>
            </div>

            {/* METRICS WITH INLINE EDITABLE GOAL */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem", margin: "0.75rem 0" }}>
              <div style={{ background: darkMode ? "#0f172a" : "#f8fafc", padding: "8px", borderRadius: "8px", border: `1px solid ${borderCol}` }}>
                <span style={{ fontSize: "0.75rem", color: subText }}>Assigned Goal</span>
                {isEditingInspectGoal ? (
                  <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
                    <input
                      type="number"
                      value={inspectModalGoalInput}
                      onChange={(e) => setInspectModalGoalInput(e.target.value)}
                      style={{ width: "75px", padding: "4px", borderRadius: "4px", border: `1px solid ${borderCol}`, fontSize: "0.85rem", background: darkMode ? "#1e293b" : "#fff", color: textCol }}
                    />
                    <button
                      onClick={() => handleSaveGoal(inspectUser._id, inspectModalGoalInput)}
                      style={{ background: "#059669", color: "white", border: "none", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", fontSize: "0.75rem", fontWeight: "bold" }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setIsEditingInspectGoal(false)}
                      style={{ background: borderCol, color: textCol, border: "none", padding: "4px 6px", borderRadius: "4px", cursor: "pointer", fontSize: "0.75rem" }}
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
                    <div style={{ fontSize: "1.1rem", fontWeight: "800", color: "#2563eb" }}>{inspectUser.dailyGoal || 2000} ml</div>
                    <button
                      onClick={() => setIsEditingInspectGoal(true)}
                      title="Edit Assigned Goal"
                      style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: "0.9rem" }}
                    >
                      ✏️
                    </button>
                  </div>
                )}
              </div>
              <div style={{ background: darkMode ? "#0f172a" : "#f8fafc", padding: "8px", borderRadius: "8px", border: `1px solid ${borderCol}` }}>
                <span style={{ fontSize: "0.75rem", color: subText }}>Total Intake</span>
                <div style={{ fontSize: "1.1rem", fontWeight: "800", color: "#059669", marginTop: "2px" }}>{inspectLogs.reduce((sum, l) => sum + (l.amount || 0), 0)} ml</div>
              </div>
            </div>

            {/* PAST 7 DAYS BAR CHART */}
            <div style={{ background: darkMode ? "#0f172a" : "#f8fafc", padding: "10px", borderRadius: "8px", border: `1px solid ${borderCol}`, marginBottom: "1rem" }}>
              <span style={{ fontSize: "0.85rem", fontWeight: "700", display: "block", marginBottom: "8px" }}>📊 Past 7 Days Activity</span>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", height: "100px", gap: "6px" }}>
                {getInspect7DaysSummary().map((day, idx) => (
                  <div key={idx} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
                    <span style={{ fontSize: "0.65rem", color: subText, marginBottom: "2px" }}>{day.total > 0 ? `${day.total}ml` : "0"}</span>
                    <div style={{ width: "100%", maxWidth: "22px", background: day.percent >= 100 ? "#059669" : "#2563eb", height: `${Math.max(day.percent, 8)}%`, borderRadius: "4px 4px 0 0" }} />
                    <span style={{ fontSize: "0.7rem", marginTop: "4px", fontWeight: "bold" }}>{day.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* INTERVALS TABLE */}
            <h4 style={{ margin: "0 0 0.4rem 0", fontSize: "0.9rem" }}>Logged Intervals</h4>
            <div style={{ maxHeight: "140px", overflowY: "auto", border: `1px solid ${borderCol}`, borderRadius: "8px", padding: "6px" }}>
              {inspectLoading ? (
                <p style={{ color: subText, fontSize: "0.85rem", textAlign: "center" }}>Loading...</p>
              ) : inspectLogs.length === 0 ? (
                <p style={{ color: subText, fontSize: "0.85rem", textAlign: "center" }}>No logs recorded yet.</p>
              ) : (
                <table style={{ width: "100%", fontSize: "0.8rem", borderCollapse: "collapse" }}>
                  <tbody>
                    {inspectLogs.map((log, idx) => (
                      <tr key={log._id || idx} style={{ borderBottom: `1px solid ${borderCol}` }}>
                        <td style={{ padding: "4px" }}><span style={{ display: "inline-block", width: "8px", height: "8px", borderRadius: "50%", background: SLICE_COLORS[idx % SLICE_COLORS.length] }} /></td>
                        <td style={{ padding: "4px" }}>{new Date(log.date).toLocaleDateString()}</td>
                        <td style={{ padding: "4px", color: subText }}>{new Date(log.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td style={{ padding: "4px", textAlign: "right", fontWeight: "700", color: "#2563eb" }}>+{log.amount} ml</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <button onClick={() => setInspectUser(null)} style={{ marginTop: "1rem", width: "100%", background: "#2563eb", color: "white", border: "none", padding: "9px", borderRadius: "6px", fontWeight: "700", cursor: "pointer" }}>
              Close Window
            </button>
          </div>
        </div>
      )}
    </div>
  );
}