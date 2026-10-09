import React, { useState, useEffect, useRef } from "react";
import API from "./api/client";
import AdminDashboard from "./pages/AdminDashboard";

const SLICE_COLORS = [
  "#3182ce", "#38a169", "#dd6b20", "#805ad5", 
  "#d69e2e", "#319795", "#e53e3e", "#00b5d8",
  "#d53f8c", "#4fd1c5", "#667eea", "#ed8936"
];

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem("token") || "");
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || null;
    } catch {
      return null;
    }
  });

  // Auth Inputs
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState("user");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);

  // Settings & Profile Modal State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);

  const [weightKg, setWeightKg] = useState(() => localStorage.getItem("weightKg") || "68");
  const [wakeTime, setWakeTime] = useState(() => localStorage.getItem("wakeTime") || "07:00");
  const [bedTime, setBedTime] = useState(() => localStorage.getItem("bedTime") || "23:00");
  const [gender, setGender] = useState(() => localStorage.getItem("gender") || "male");
  const [workType, setWorkType] = useState(() => localStorage.getItem("workType") || "desk");
  const [healthCondition, setHealthCondition] = useState(() => localStorage.getItem("healthCondition") || "normal");

  // App Preferences
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("darkMode") === "true");
  const [unit, setUnit] = useState(() => localStorage.getItem("unit") || "ml");
  const [reminderInterval, setReminderInterval] = useState(() => localStorage.getItem("reminderInterval") || "auto");

  const [temperature, setTemperature] = useState(27);

  // Window State
  const [windowMode, setWindowMode] = useState(() => localStorage.getItem("windowControlMode") || "auto");
  const [isWakingWindow, setIsWakingWindow] = useState(() => {
    const saved = localStorage.getItem("manualWakingState");
    return saved !== null ? saved === "true" : true;
  });

  const [todayData, setTodayData] = useState({ totalIntake: 0, dailyGoal: 2000, logs: [] });
  const [historyData, setHistoryData] = useState([]);
  const [customAmount, setCustomAmount] = useState("");
  const [streakDays, setStreakDays] = useState(0);

  // Safeguards
  const [shortIntervalWarning, setShortIntervalWarning] = useState(null);
  const [overGoalWarning, setOverGoalWarning] = useState(null);

  const [hoveredSlice, setHoveredSlice] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const currentRole = (user?.role || localStorage.getItem("role") || "user").toLowerCase();
  const isAdmin = currentRole === "admin";

  // AUTO SCHEDULE EVALUATION
  useEffect(() => {
    if (windowMode !== "auto") return;

    const evaluateSchedule = () => {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const [wH, wM] = (wakeTime || "07:00").split(":").map(Number);
      const [bH, bM] = (bedTime || "23:00").split(":").map(Number);
      const wakeMinutes = (wH || 7) * 60 + (wM || 0);
      const bedMinutes = (bH || 23) * 60 + (bM || 0);

      let inActiveHours = false;
      if (bedMinutes > wakeMinutes) {
        inActiveHours = currentMinutes >= wakeMinutes && currentMinutes <= bedMinutes;
      } else {
        inActiveHours = currentMinutes >= wakeMinutes || currentMinutes <= bedMinutes;
      }
      setIsWakingWindow(inActiveHours);
    };

    evaluateSchedule();
    const interval = setInterval(evaluateSchedule, 30000);
    return () => clearInterval(interval);
  }, [wakeTime, bedTime, windowMode]);

  const handleToggleState = () => {
    const nextState = !isWakingWindow;
    setIsWakingWindow(nextState);
    setWindowMode("manual");
    localStorage.setItem("windowControlMode", "manual");
    localStorage.setItem("manualWakingState", String(nextState));
  };

  const handleResetToAuto = (e) => {
    e.stopPropagation();
    setWindowMode("auto");
    localStorage.setItem("windowControlMode", "auto");

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [wH, wM] = (wakeTime || "07:00").split(":").map(Number);
    const [bH, bM] = (bedTime || "23:00").split(":").map(Number);
    const wakeMinutes = (wH || 7) * 60 + (wM || 0);
    const bedMinutes = (bH || 23) * 60 + (bM || 0);

    const inActiveHours = bedMinutes > wakeMinutes
      ? (currentMinutes >= wakeMinutes && currentMinutes <= bedMinutes)
      : (currentMinutes >= wakeMinutes || currentMinutes <= bedMinutes);

    setIsWakingWindow(inActiveHours);
  };

  // Weather Fetch
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`);
            const data = await res.json();
            if (data.current_weather?.temperature) {
              setTemperature(Math.round(data.current_weather.temperature));
            }
          } catch (err) {}
        },
        () => {},
        { timeout: 8000 }
      );
    }
  }, []);

  // Fetch Intake Data
  const fetchTodayData = async () => {
    if (!token || isAdmin) return;
    try {
      const res = await API.get("/intake/today");
      const data = res.data || { totalIntake: 0, dailyGoal: 2000, logs: [] };
      setTodayData(data);

      const histRes = await API.get("/intake/history");
      const logs = histRes.data || [];
      setHistoryData(logs);

      let streak = 0;
      const now = new Date();
      for (let i = 0; i < 30; i++) {
        const d = new Date();
        d.setDate(now.getDate() - i);
        const dStr = d.toLocaleDateString();
        const dayTotal = logs.filter((l) => new Date(l.date).toLocaleDateString() === dStr).reduce((sum, l) => sum + (l.amount || 0), 0);
        if (dayTotal >= (data.dailyGoal || 2000)) streak++;
        else if (i > 0) break;
      }
      setStreakDays(streak);

      const goal = data.dailyGoal || 2000;
      if (data.totalIntake > goal + 300) {
        setOverGoalWarning({
          title: "⚠️ High Daily Fluid Over-Intake Detected",
          cause: `You have surpassed your daily target by ${data.totalIntake - goal} ml (beyond the safe +300 ml threshold).`,
          physiologicalEffects: "Chronic over-hydration carries a medical risk of Hyponatremia (Water Intoxication). Excess fluid dilutes your blood's sodium levels below normal ranges, causing cellular over-saturation. Symptoms include dizziness, headaches, confusion, and muscle cramping. Reduce water consumption for the rest of today to allow your kidneys to re-establish electrolyte balance."
        });
      } else {
        setOverGoalWarning(null);
      }
    } catch (err) {
      console.error("Intake fetch error:", err);
    }
  };

  useEffect(() => {
    if (token) fetchTodayData();
  }, [token]);

  // SMART AUTO HYDRATION REMINDER LOOP
  const reminderTimerRef = useRef(null);
  useEffect(() => {
    if (reminderTimerRef.current) clearInterval(reminderTimerRef.current);
    if (!token || reminderInterval === "off") return;

    if (!isWakingWindow) {
      console.log("Reminders paused: Waking window is OFF (Sleep Mode active).");
      return;
    }

    let minutes = 60;
    if (reminderInterval === "auto") {
      const goal = todayData.dailyGoal || 2000;
      const remaining = Math.max(0, goal - (todayData.totalIntake || 0));
      const isHot = temperature >= 30;

      if (remaining > 1500) {
        minutes = isHot ? 30 : 40;
      } else if (remaining > 600) {
        minutes = isHot ? 45 : 50;
      } else {
        minutes = 60;
      }
    } else {
      minutes = Number(reminderInterval) || 60;
    }

    reminderTimerRef.current = setInterval(() => {
      if (!isWakingWindow) return;

      if ("Notification" in window && Notification.permission === "granted") {
        const doseText = unit === "glass" ? "1 glass of water (250 ml)" : "250 ml of water";
        new Notification("💧 Smart Hydration Reminder", {
          body: `Time to drink ${doseText} to keep up with your daily target!`
        });
      }
    }, minutes * 60 * 1000);

    return () => clearInterval(reminderTimerRef.current);
  }, [token, reminderInterval, temperature, isWakingWindow, todayData, unit]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  const formatVol = (ml) => {
    const val = Number(ml) || 0;
    if (unit === "glass") {
      const glasses = (val / 250).toFixed(1);
      return `${glasses} ${Number(glasses) === 1 ? "glass" : "glasses"}`;
    }
    return `${val} ml`;
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError("");
    setLoading(true);
    try {
      const endpoint = isRegister ? "/auth/register" : "/auth/login";
      const payload = isRegister ? { email, password, role } : { email, password };
      const res = await API.post(endpoint, payload);

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));
      localStorage.setItem("role", res.data.user.role || "user");

      setToken(res.data.token);
      setUser(res.data.user);
    } catch (err) {
      setAuthError(err.response?.data?.error || err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    setToken("");
    setUser(null);
  };

  const handleAddLog = async (valInCurrentUnit) => {
    let amountInMl = unit === "glass" ? Number(valInCurrentUnit) * 250 : Number(valInCurrentUnit);

    if (!amountInMl || amountInMl <= 0) {
      return alert(unit === "glass" ? "Please enter at least 0.5 glasses." : "Water intake must be greater than 0 ml.");
    }

    const fortyFiveMinsAgo = new Date(Date.now() - 45 * 60 * 1000);
    const recentLogsSum = (todayData.logs || [])
      .filter((l) => new Date(l.date) >= fortyFiveMinsAgo)
      .reduce((sum, l) => sum + (l.amount || 0), 0);

    if (recentLogsSum + amountInMl > 800) {
      setShortIntervalWarning({
        title: "⚠️ Rapid Intake Warning (Kidney Filtration Threshold Exceeded)",
        cause: `You logged ${recentLogsSum + amountInMl} ml in under 45 minutes.`,
        physiologicalEffects: "Healthy kidneys can only filter approximately 800 ml to 1,000 ml of fluid per hour. Ingesting large volumes in short intervals causes fluid build-up faster than kidney excretion rate, which may cause bloating, nausea, and acute fluid retention. Space your sips steadily across the waking hours."
      });
    } else {
      setShortIntervalWarning(null);
    }

    try {
      await API.post("/intake", { amount: amountInMl });
      setCustomAmount("");
      fetchTodayData();
    } catch (err) {
      console.error("Add log error:", err);
      alert(err.response?.data?.error || "Failed to log intake");
    }
  };

  const handleDeleteLog = async (logId) => {
    try {
      await API.delete(`/intake/${logId}`);
      fetchTodayData();
    } catch (err) {
      alert("Failed to delete log");
    }
  };

  const handleAdjustGoal = async (deltaMl) => {
    const newGoal = Math.max(500, (todayData.dailyGoal || 2000) + deltaMl);
    try {
      await API.put("/users/profile/goal", { dailyGoal: newGoal });
      setTodayData((prev) => ({ ...prev, dailyGoal: newGoal }));
    } catch (err) {
      setTodayData((prev) => ({ ...prev, dailyGoal: newGoal }));
    }
  };

  const handleCalculateRecommendedGoal = async () => {
    const w = Number(weightKg) || 70;
    let base = Math.round(w * (gender === "female" ? 31 : 35));
    if (workType === "standing") base += 250;
    if (workType === "labor") base += 500;
    if (workType === "athlete") base += 750;

    if (healthCondition === "kidney_stones") base += 700;
    if (healthCondition === "pregnancy") base += 300;
    if (healthCondition === "breastfeeding") base += 700;
    if (healthCondition === "fever") base += 400;
    if (healthCondition === "kidney") base = Math.min(base, 1800);

    if (temperature >= 32) base += 500;
    else if (temperature >= 26) base += 300;

    base = Math.round(base / 50) * 50;

    localStorage.setItem("weightKg", String(w));
    localStorage.setItem("wakeTime", wakeTime);
    localStorage.setItem("bedTime", bedTime);
    localStorage.setItem("gender", gender);
    localStorage.setItem("workType", workType);
    localStorage.setItem("healthCondition", healthCondition);

    setTodayData((prev) => ({ ...prev, dailyGoal: base }));
    setShowProfileModal(false);

    try {
      await API.put("/users/profile/goal", {
        dailyGoal: base,
        weight: w,
        wakeTime,
        bedTime,
        gender,
        workType,
        healthCondition
      });
    } catch (err) {
      console.warn("Server profile sync non-blocking:", err);
    }

    const summaryText = unit === "glass" 
      ? `${(base / 250).toFixed(1)} glasses (${base} ml)` 
      : `${base} ml (${(base / 250).toFixed(1)} glasses)`;
    alert(`🎯 Profile updated! Target Goal set to ${summaryText}.`);
  };

  const getPast7DaysSummary = () => {
    const days = [];
    const activeGoal = todayData.dailyGoal || 2000;
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString();

      const dayTotal = (historyData || [])
        .filter((log) => new Date(log.date).toLocaleDateString() === dateStr)
        .reduce((sum, log) => sum + (log.amount || 0), 0);

      days.push({
        label: d.toLocaleDateString([], { weekday: "short" }),
        total: dayTotal,
        percent: Math.min(100, Math.round((dayTotal / activeGoal) * 100)),
      });
    }
    return days;
  };

  const renderDonutChart = () => {
    const goal = todayData.dailyGoal || 2000;
    const total = todayData.totalIntake || 0;
    const remaining = Math.max(0, goal - total);
    const chartTotal = Math.max(goal, total);
    const radius = 78;
    const circumference = 2 * Math.PI * radius;
    let accumulatedOffset = 0;

    const slices = (todayData.logs || []).map((log, idx) => ({
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
      <div style={{ position: "relative", width: "210px", height: "210px", margin: "0 auto" }}>
        <svg width="210" height="210" viewBox="0 0 210 210" style={{ transform: "rotate(-90deg)" }}>
          {slices.map((slice) => {
            const fraction = slice.amount / chartTotal;
            const strokeDasharray = `${fraction * circumference} ${circumference}`;
            const strokeDashoffset = -accumulatedOffset;
            accumulatedOffset += fraction * circumference;
            const isHovered = hoveredSlice && hoveredSlice._id === slice._id;

            return (
              <circle
                key={slice._id}
                cx="105"
                cy="105"
                r={radius}
                fill="transparent"
                stroke={slice.color}
                strokeWidth={isHovered ? "22" : "16"}
                strokeDasharray={strokeDasharray}
                strokeDashoffset={strokeDashoffset}
                style={{ cursor: "pointer", transition: "stroke-width 0.2s ease" }}
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

        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            textAlign: "center",
            boxSizing: "border-box",
            padding: "16px"
          }}
        >
          <span style={{ fontSize: "1.1rem", fontWeight: "800", color: "#2563eb", lineHeight: "1.1" }}>
            {formatVol(total)}
          </span>
          <span style={{ fontSize: "0.72rem", color: subText, marginTop: "2px" }}>
            Goal: {formatVol(goal)}
          </span>
          {unit === "glass" && (
            <span style={{ fontSize: "0.68rem", color: subText }}>
              ({total} / {goal} ml)
            </span>
          )}
          <span style={{ fontSize: "0.78rem", fontWeight: "800", color: "#16a34a", marginTop: "3px" }}>
            {percent}%
          </span>
        </div>
      </div>
    );
  };
  const bg = darkMode ? "#0f172a" : "#f1f5f9";
  const cardBg = darkMode ? "#1e293b" : "#ffffff";
  const textCol = darkMode ? "#f8fafc" : "#1e293b";
  const subText = darkMode ? "#94a3b8" : "#64748b";
  const borderCol = darkMode ? "#334155" : "#e2e8f0";

  // LOGIN & REGISTER SCREEN WITH HIGH-CONTRAST INPUTS & SHOW/HIDE PASSWORD
  if (!token) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f4f8", padding: "1rem", fontFamily: "sans-serif" }}>
        <div style={{ background: "#ffffff", padding: "2.2rem 2rem", borderRadius: "14px", width: "100%", maxWidth: "390px", boxShadow: "0 8px 24px rgba(0,0,0,0.08)", boxSizing: "border-box" }}>
          <h2 style={{ textAlign: "center", margin: "0 0 0.5rem 0", color: "#2563eb", fontWeight: "800" }}>💧 Water Tracker</h2>
          <h4 style={{ textAlign: "center", margin: "0 0 1.5rem 0", color: "#334155", fontWeight: "600" }}>{isRegister ? "Create an Account" : "Sign In to Your Account"}</h4>
          
          {authError && (
            <div style={{ background: "#fee2e2", color: "#b91c1c", border: "1px solid #fecaca", padding: "10px 12px", borderRadius: "8px", marginBottom: "1.2rem", fontSize: "0.85rem", textAlign: "center" }}>
              {authError}
            </div>
          )}

          <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: "1.1rem" }}>
            {/* EMAIL INPUT WITH EXPLICIT HIGH-CONTRAST TEXT & BG */}
            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: "700", color: "#334155", display: "block", marginBottom: "5px" }}>Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{
                  width: "100%",
                  padding: "11px 12px",
                  borderRadius: "8px",
                  border: "1.5px solid #cbd5e1",
                  background: "#ffffff",
                  color: "#0f172a",
                  fontSize: "0.95rem",
                  boxSizing: "border-box",
                  outline: "none"
                }}
              />
            </div>

            {/* PASSWORD INPUT WITH SHOW/HIDE TOGGLE */}
            <div>
              <label style={{ fontSize: "0.85rem", fontWeight: "700", color: "#334155", display: "block", marginBottom: "5px" }}>Password</label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  style={{
                    width: "100%",
                    padding: "11px 45px 11px 12px",
                    borderRadius: "8px",
                    border: "1.5px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#0f172a",
                    fontSize: "0.95rem",
                    boxSizing: "border-box",
                    outline: "none"
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? "Hide password" : "Show password"}
                  style={{
                    position: "absolute",
                    right: "10px",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "1.15rem",
                    color: "#64748b",
                    padding: "4px 6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {/* REGISTER ROLE DROPDOWN WITH HIGH CONTRAST */}
            {isRegister && (
              <div>
                <label style={{ fontSize: "0.85rem", fontWeight: "700", color: "#334155", display: "block", marginBottom: "5px" }}>Register As</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "11px 12px",
                    borderRadius: "8px",
                    border: "1.5px solid #cbd5e1",
                    background: "#ffffff",
                    color: "#0f172a",
                    fontSize: "0.9rem",
                    boxSizing: "border-box",
                    outline: "none",
                    cursor: "pointer"
                  }}
                >
                  <option value="user" style={{ color: "#0f172a", background: "#ffffff" }}>User (Standard Hydration Tracker)</option>
                  <option value="admin" style={{ color: "#0f172a", background: "#ffffff" }}>Admin (Portal Management)</option>
                </select>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                background: "#2563eb",
                color: "#ffffff",
                padding: "12px",
                borderRadius: "8px",
                border: "none",
                fontWeight: "700",
                fontSize: "0.95rem",
                cursor: "pointer",
                marginTop: "0.4rem",
                boxShadow: "0 2px 6px rgba(37,99,235,0.3)"
              }}
            >
              {loading ? "Processing..." : isRegister ? "Create Account" : "Sign In"}
            </button>
          </form>

          <p style={{ textAlign: "center", marginTop: "1.4rem", fontSize: "0.85rem", color: "#64748b" }}>
            {isRegister ? "Already have an account?" : "Need an account?"}{" "}
            <span
              onClick={() => { setIsRegister(!isRegister); setAuthError(""); }}
              style={{ color: "#2563eb", cursor: "pointer", fontWeight: "700" }}
            >
              {isRegister ? "Sign In" : "Register"}
            </span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: bg, color: textCol, fontFamily: "sans-serif" }}>
      {/* HOVER TOOLTIP */}
      {hoveredSlice && (
        <div style={{ position: "fixed", left: `${tooltipPos.x + 12}px`, top: `${tooltipPos.y + 12}px`, background: "#0f172a", color: "#fff", padding: "8px 12px", borderRadius: "6px", pointerEvents: "none", zIndex: 9999, fontSize: "0.8rem", border: "1px solid rgba(255,255,255,0.2)" }}>
          {hoveredSlice.isRemaining ? (
            <div>
              <div style={{ color: "#94a3b8" }}>⏳ Remaining Goal</div>
              <div style={{ fontWeight: "700" }}>{formatVol(hoveredSlice.amount)} ({hoveredSlice.amount} ml)</div>
            </div>
          ) : (
            <div>
              <div style={{ color: "#60a5fa", fontWeight: "700" }}>💧 Intake: +{formatVol(hoveredSlice.amount)} ({hoveredSlice.amount} ml)</div>
              <div style={{ fontSize: "0.75rem", color: "#cbd5e1", marginTop: "2px" }}>
                ⏰ Time: {new Date(hoveredSlice.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* NAVBAR */}
      <header style={{ background: "#2563eb", color: "white", padding: "0.75rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "1.3rem" }}>💧</span>
          <span style={{ fontWeight: "700", fontSize: "1.1rem" }}>Water Intake Tracker</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ background: "rgba(255, 255, 255, 0.2)", padding: "4px 8px", borderRadius: "4px", fontSize: "0.75rem", fontWeight: "700" }}>
            ROLE: {currentRole.toUpperCase()}
          </span>
          <button 
            type="button"
            onClick={() => setShowSettingsModal(true)} 
            title="Settings & Reminders" 
            style={{ background: "rgba(255,255,255,0.2)", color: "white", border: "none", padding: "6px 10px", borderRadius: "4px", cursor: "pointer", fontSize: "1rem" }}
          >
            ⚙️
          </button>
          <button onClick={handleLogout} style={{ background: "#ef4444", color: "white", border: "none", padding: "5px 10px", borderRadius: "4px", cursor: "pointer", fontWeight: "600", fontSize: "0.75rem" }}>Logout</button>
        </div>
      </header>

      {/* VIEW */}
      {isAdmin ? (
        <AdminDashboard currentAdminId={user?._id || user?.id} darkMode={darkMode} />
      ) : (
        <main style={{ maxWidth: "700px", margin: "1rem auto", padding: "0 0.75rem" }}>
          
          {/* WARNING BANNERS */}
          {shortIntervalWarning && (
            <div style={{ background: "#fff5f5", color: "#c53030", border: "1px solid #feb2b2", padding: "12px 14px", borderRadius: "10px", marginBottom: "1rem", boxShadow: "0 2px 8px rgba(229,62,62,0.15)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <strong style={{ fontSize: "0.95rem" }}>{shortIntervalWarning.title}</strong>
                  <div style={{ fontSize: "0.85rem", fontWeight: "600", marginTop: "2px" }}>{shortIntervalWarning.cause}</div>
                  <p style={{ margin: "4px 0 0 0", fontSize: "0.8rem", lineHeight: "1.4", color: "#742a2a" }}>
                    {shortIntervalWarning.physiologicalEffects}
                  </p>
                </div>
                <button onClick={() => setShortIntervalWarning(null)} style={{ background: "transparent", border: "none", color: "#c53030", fontSize: "1.1rem", cursor: "pointer" }}>✕</button>
              </div>
            </div>
          )}

          {overGoalWarning && (
            <div style={{ background: "#fffaf0", color: "#c05621", border: "1px solid #fbd38d", padding: "12px 14px", borderRadius: "10px", marginBottom: "1rem", boxShadow: "0 2px 8px rgba(221,107,32,0.15)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <strong style={{ fontSize: "0.95rem" }}>{overGoalWarning.title}</strong>
                  <div style={{ fontSize: "0.85rem", fontWeight: "600", marginTop: "2px" }}>{overGoalWarning.cause}</div>
                  <p style={{ margin: "4px 0 0 0", fontSize: "0.8rem", lineHeight: "1.4", color: "#7b341e" }}>
                    {overGoalWarning.physiologicalEffects}
                  </p>
                </div>
                <button onClick={() => setOverGoalWarning(null)} style={{ background: "transparent", border: "none", color: "#c05621", fontSize: "1.1rem", cursor: "pointer" }}>✕</button>
              </div>
            </div>
          )}

          {/* DUAL MODE AUTO & MANUAL CONTROL BANNER */}
          <div style={{ background: cardBg, border: `1px solid ${borderCol}`, borderRadius: "10px", padding: "0.75rem 1rem", marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <span style={{ fontWeight: "700", fontSize: "0.9rem" }}>⛅ Live Weather: {temperature}°C</span>
              
              <button
                type="button"
                onClick={handleToggleState}
                title="Click to toggle between Active Waking Window (Reminders ON) and Sleep Window (Reminders MUTED)"
                style={{
                  background: isWakingWindow ? "rgba(56, 161, 105, 0.15)" : "rgba(229, 62, 62, 0.15)",
                  color: isWakingWindow ? "#38a169" : "#e53e3e",
                  border: `1px solid ${isWakingWindow ? "#38a169" : "#e53e3e"}`,
                  padding: "5px 12px",
                  borderRadius: "20px",
                  fontSize: "0.8rem",
                  fontWeight: "700",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                {isWakingWindow ? "⚡ Active Window (ON)" : "🌙 Sleep Window (MUTED)"}
                <span style={{ fontSize: "0.75rem", opacity: 0.9 }}>
                  [{windowMode === "auto" ? "🤖 Auto Sync" : "✋ Manual Lock"}]
                </span>
              </button>

              {windowMode === "manual" && (
                <button
                  type="button"
                  onClick={handleResetToAuto}
                  title="Return to automatic schedule tracking using your profile wake & sleep times"
                  style={{
                    background: "transparent",
                    color: "#3182ce",
                    border: `1px dashed ${borderCol}`,
                    padding: "4px 8px",
                    borderRadius: "6px",
                    fontSize: "0.75rem",
                    cursor: "pointer",
                    fontWeight: "600"
                  }}
                >
                  ↩️ Reset to Auto Sync
                </button>
              )}
            </div>

            <button onClick={() => setShowProfileModal(true)} style={{ background: "#ebf8ff", color: "#2b6cb0", border: "1px solid #bee3f8", padding: "6px 12px", borderRadius: "6px", fontWeight: "600", fontSize: "0.8rem", cursor: "pointer" }}>
              Update Profile & Routine
            </button>
          </div>

          {/* PROGRESS CARD */}
          <div style={{ background: cardBg, padding: "1.2rem", borderRadius: "12px", border: `1px solid ${borderCol}`, marginBottom: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem" }}>Today's Hydration Progress</h3>
              <div style={{ background: "#fefcbf", color: "#975a16", padding: "4px 10px", borderRadius: "20px", fontSize: "0.8rem", fontWeight: "bold" }}>🔥 {streakDays} Day Streak</div>
            </div>
            
            <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
              {renderDonutChart()}
              <div>
                <span style={{ fontSize: "0.85rem", color: subText }}>Daily Target Goal</span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "1.4rem", fontWeight: "800", color: "#3182ce" }}>
                    {formatVol(todayData.dailyGoal)}
                  </span>
                  <button onClick={() => handleAdjustGoal(unit === "glass" ? -250 : -50)} style={{ border: "none", padding: "4px 8px", cursor: "pointer", background: borderCol, borderRadius: "4px" }}>-</button>
                  <button onClick={() => handleAdjustGoal(unit === "glass" ? 250 : 50)} style={{ border: "none", padding: "4px 8px", cursor: "pointer", background: borderCol, borderRadius: "4px" }}>+</button>
                </div>
                {unit === "glass" && (
                  <div style={{ fontSize: "0.75rem", color: subText }}>
                    ({todayData.dailyGoal} ml)
                  </div>
                )}
                <div style={{ fontSize: "0.8rem", color: subText, marginTop: "6px" }}>
                  Logged: <strong>{formatVol(todayData.totalIntake)}</strong> {unit === "glass" && `(${todayData.totalIntake} ml)`}
                </div>
                <div style={{ fontSize: "0.8rem", color: subText }}>
                  Remaining: <strong>{formatVol(Math.max(0, todayData.dailyGoal - todayData.totalIntake))}</strong>
                </div>
              </div>
            </div>

            {/* PRESETS */}
            <div style={{ marginTop: "1.2rem" }}>
              <span style={{ fontSize: "0.8rem", color: subText }}>Quick Add Presets:</span>
              <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
                {unit === "glass" ? (
                  <>
                    <button onClick={() => handleAddLog(1)} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: `1px solid ${borderCol}`, background: darkMode ? "#334155" : "#ebf8ff", color: darkMode ? "#93c5fd" : "#2b6cb0", cursor: "pointer", fontWeight: "600" }}>+1 Glass (250ml)</button>
                    <button onClick={() => handleAddLog(2)} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: `1px solid ${borderCol}`, background: darkMode ? "#334155" : "#ebf8ff", color: darkMode ? "#93c5fd" : "#2b6cb0", cursor: "pointer", fontWeight: "600" }}>+2 Glasses (500ml)</button>
                    <button onClick={() => handleAddLog(3)} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: `1px solid ${borderCol}`, background: darkMode ? "#334155" : "#ebf8ff", color: darkMode ? "#93c5fd" : "#2b6cb0", cursor: "pointer", fontWeight: "600" }}>+3 Glasses (750ml)</button>
                  </>
                ) : (
                  <>
                    <button onClick={() => handleAddLog(250)} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: `1px solid ${borderCol}`, background: darkMode ? "#334155" : "#ebf8ff", color: darkMode ? "#93c5fd" : "#2b6cb0", cursor: "pointer", fontWeight: "600" }}>+250 ml</button>
                    <button onClick={() => handleAddLog(500)} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: `1px solid ${borderCol}`, background: darkMode ? "#334155" : "#ebf8ff", color: darkMode ? "#93c5fd" : "#2b6cb0", cursor: "pointer", fontWeight: "600" }}>+500 ml</button>
                    <button onClick={() => handleAddLog(750)} style={{ flex: 1, padding: "8px", borderRadius: "6px", border: `1px solid ${borderCol}`, background: darkMode ? "#334155" : "#ebf8ff", color: darkMode ? "#93c5fd" : "#2b6cb0", cursor: "pointer", fontWeight: "600" }}>+750 ml</button>
                  </>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", marginTop: "0.75rem" }}>
              <input 
                type="number" 
                step={unit === "glass" ? "0.5" : "50"}
                placeholder={unit === "glass" ? "Custom glasses (e.g. 1.5)" : "Custom ml (e.g. 300)"} 
                value={customAmount} 
                onChange={(e) => setCustomAmount(e.target.value)} 
                style={{ flex: 1, padding: "8px", borderRadius: "6px", border: `1px solid ${borderCol}`, background: darkMode ? "#0f172a" : "#fff", color: textCol }} 
              />
              <button onClick={() => handleAddLog(customAmount)} style={{ background: "#2563eb", color: "white", border: "none", padding: "8px 16px", borderRadius: "6px", fontWeight: "bold", cursor: "pointer" }}>Add</button>
            </div>
          </div>

          {/* TODAY'S LOGS */}
          <div style={{ background: cardBg, padding: "1.2rem", borderRadius: "12px", border: `1px solid ${borderCol}`, marginBottom: "1rem" }}>
            <h4 style={{ margin: "0 0 0.75rem 0" }}>Today's Log Entries</h4>
            {(!todayData.logs || todayData.logs.length === 0) ? (
              <p style={{ fontSize: "0.85rem", color: subText, margin: 0 }}>No water logged yet today.</p>
            ) : (
              <div style={{ maxHeight: "150px", overflowY: "auto" }}>
                <table style={{ width: "100%", fontSize: "0.85rem", borderCollapse: "collapse" }}>
                  <tbody>
                    {todayData.logs.map((log) => (
                      <tr key={log._id} style={{ borderBottom: `1px solid ${borderCol}` }}>
                        <td style={{ padding: "6px 0" }}>{new Date(log.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                        <td style={{ padding: "6px 0", textAlign: "right", fontWeight: "bold", color: "#3182ce" }}>
                          +{formatVol(log.amount)} {unit === "glass" && `(${log.amount} ml)`}
                        </td>
                        <td style={{ padding: "6px 0", textAlign: "right", width: "40px" }}>
                          <button onClick={() => handleDeleteLog(log._id)} style={{ border: "none", background: "transparent", color: "#e53e3e", cursor: "pointer" }}>🗑️</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* PAST 7 DAYS BAR CHART */}
          <div style={{ background: cardBg, padding: "1.2rem", borderRadius: "12px", border: `1px solid ${borderCol}` }}>
            <h4 style={{ margin: "0 0 0.75rem 0" }}>📊 Past 7 Days Activity</h4>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", height: "120px", gap: "8px", paddingTop: "0.5rem" }}>
              {getPast7DaysSummary().map((day, idx) => (
                <div key={idx} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end" }}>
                  <span style={{ fontSize: "0.7rem", color: subText, marginBottom: "4px" }}>
                    {day.total > 0 ? (unit === "glass" ? `${(day.total / 250).toFixed(1)}g` : `${day.total}ml`) : "0"}
                  </span>
                  <div style={{ width: "100%", maxWidth: "28px", background: day.percent >= 100 ? "#059669" : "#2563eb", height: `${Math.max(day.percent, 8)}%`, borderRadius: "4px 4px 0 0" }} />
                  <span style={{ fontSize: "0.75rem", marginTop: "6px", fontWeight: "bold" }}>{day.label}</span>
                </div>
              ))}
            </div>
          </div>
        </main>
      )}

      {/* UPDATE PROFILE & ROUTINE MODAL */}
      {showProfileModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.7)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1300 }}>
          <div style={{ background: cardBg, color: textCol, padding: "1.5rem", borderRadius: "14px", width: "92%", maxWidth: "500px", maxHeight: "90vh", overflowY: "auto", border: `1px solid ${borderCol}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "700" }}>📋 Smart Profile & Hydration Routine</h3>
              <button onClick={() => setShowProfileModal(false)} style={{ background: "transparent", border: "none", color: subText, fontSize: "1.4rem", cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: "600", color: subText, display: "block" }}>Biological Sex</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: `1px solid ${borderCol}`, background: darkMode ? "#0f172a" : "#fff", color: textCol }}>
                    <option value="male">👨 Male</option>
                    <option value="female">👩 Female</option>
                    <option value="other">🧑 Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: "600", color: subText, display: "block" }}>Weight (kg)</label>
                  <input type="number" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: `1px solid ${borderCol}`, background: darkMode ? "#0f172a" : "#fff", color: textCol, boxSizing: "border-box" }} />
                </div>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: "600", color: subText, display: "block" }}>Work Type</label>
                <select value={workType} onChange={(e) => setWorkType(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: `1px solid ${borderCol}`, background: darkMode ? "#0f172a" : "#fff", color: textCol }}>
                  <option value="desk">💻 Desk / Office (Sedentary)</option>
                  <option value="standing">🚶 Standing / Retail (Moderate)</option>
                  <option value="labor">🔨 Physical Labor (High)</option>
                  <option value="athlete">🏃 Athlete (Intense)</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "0.8rem", fontWeight: "600", color: subText, display: "block" }}>Health Condition</label>
                <select value={healthCondition} onChange={(e) => setHealthCondition(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: `1px solid ${borderCol}`, background: darkMode ? "#0f172a" : "#fff", color: textCol }}>
                  <option value="normal">🟢 General Health (Normal)</option>
                  <option value="kidney_stones">💎 Kidney Stones (+700 ml Flush Buffer)</option>
                  <option value="pregnancy">🤰 Pregnancy (+300 ml)</option>
                  <option value="breastfeeding">🤱 Breastfeeding (+700 ml)</option>
                  <option value="fever">🩹 Fever Recovery (+400 ml)</option>
                  <option value="kidney">⚠️ Fluid Restriction (Capped)</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: "600", color: subText, display: "block" }}>🌅 Wake-Up Time</label>
                  <input type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: `1px solid ${borderCol}`, background: darkMode ? "#0f172a" : "#fff", color: textCol, boxSizing: "border-box" }} />
                </div>
                <div>
                  <label style={{ fontSize: "0.8rem", fontWeight: "600", color: subText, display: "block" }}>🌙 Sleeping Time</label>
                  <input type="time" value={bedTime} onChange={(e) => setBedTime(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: `1px solid ${borderCol}`, background: darkMode ? "#0f172a" : "#fff", color: textCol, boxSizing: "border-box" }} />
                </div>
              </div>

              <button onClick={handleCalculateRecommendedGoal} style={{ width: "100%", background: "#2563eb", color: "white", border: "none", padding: "10px", borderRadius: "8px", fontWeight: "700", cursor: "pointer", marginTop: "0.5rem" }}>
                Calculate & Save Target Goal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS MODAL */}
      {showSettingsModal && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.7)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 99999 }}>
          <div style={{ background: "#1e2430", color: "#e2e8f0", padding: "1.75rem", borderRadius: "14px", width: "92%", maxWidth: "470px", border: "1px solid #2d3748", boxShadow: "0 20px 40px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
              <h3 style={{ margin: 0, fontSize: "1.2rem", color: "#fff", fontWeight: "700" }}>⚙️ Settings & Preferences</h3>
              <button 
                type="button"
                onClick={() => setShowSettingsModal(false)} 
                style={{ background: "transparent", border: "none", color: "#94a3b8", fontSize: "1.4rem", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>

            {/* HYDRATION REMINDER */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px", marginBottom: "1.25rem" }}>
              <span style={{ fontSize: "0.9rem", fontWeight: "600", color: "#cbd5e1", whiteSpace: "nowrap" }}>
                ⏰ Hydration Reminder
              </span>
              <select
                value={reminderInterval}
                onChange={(e) => {
                  setReminderInterval(e.target.value);
                  localStorage.setItem("reminderInterval", e.target.value);
                }}
                style={{
                  background: "#151a23", color: "#cbd5e1", border: "1px solid #334155",
                  borderRadius: "8px", padding: "7px 10px", fontSize: "0.8rem", outline: "none",
                  cursor: "pointer", maxWidth: "230px", flex: 1
                }}
              >
                <option value="auto">🤖 Auto (Adaptive)</option>
                <option value="30">Every 30 Minutes</option>
                <option value="45">Every 45 Minutes</option>
                <option value="60">Every 60 Minutes</option>
                <option value="90">Every 90 Minutes</option>
                <option value="120">Every 2 Hours</option>
                <option value="off">Off (Disabled)</option>
              </select>
            </div>

            {/* MEASUREMENT UNIT */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px", marginBottom: "1.25rem" }}>
              <span style={{ fontSize: "0.9rem", fontWeight: "600", color: "#cbd5e1", whiteSpace: "nowrap" }}>
                📏 Measurement Unit
              </span>
              <select
                value={unit}
                onChange={(e) => {
                  setUnit(e.target.value);
                  localStorage.setItem("unit", e.target.value);
                }}
                style={{
                  background: "#151a23", color: "#cbd5e1", border: "1px solid #334155",
                  borderRadius: "8px", padding: "7px 10px", fontSize: "0.8rem", outline: "none",
                  cursor: "pointer", maxWidth: "230px", flex: 1
                }}
              >
                <option value="ml">Milliliters (ml)</option>
                <option value="glass">Glasses (1 glass = 250 ml)</option>
              </select>
            </div>

            {/* DARK THEME */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.75rem" }}>
              <span style={{ fontSize: "0.9rem", fontWeight: "600", color: "#cbd5e1" }}>Dark Theme</span>
              <button
                type="button"
                onClick={() => {
                  const val = !darkMode;
                  setDarkMode(val);
                  localStorage.setItem("darkMode", String(val));
                }}
                style={{
                  padding: "6px 14px", borderRadius: "20px", border: "none", cursor: "pointer",
                  background: darkMode ? "#334155" : "#cbd5e1", color: darkMode ? "#fbbf24" : "#1e293b",
                  fontWeight: "700", fontSize: "0.8rem"
                }}
              >
                {darkMode ? "🌙 ON" : "☀️ OFF"}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowSettingsModal(false)}
              style={{ width: "100%", background: "#2563eb", color: "white", border: "none", padding: "10px", borderRadius: "8px", fontWeight: "700", cursor: "pointer" }}
            >
              Save & Apply
            </button>
          </div>
        </div>
      )}

    </div>
  );
}