\# 💧 Water Intake Tracker — React Frontend



\## 1. Project Description and Features



\### Description

A responsive, high-contrast single-page web application (SPA) built with React 18 and Vite. It offers visual hydration tracking, environmental and health target calculation, dual-mode circadian schedule silencing, and an administrative inspection portal.



\### Key Features



\- \*\*Dynamic SVG Donut Chart\*\*:

&#x20; - Renders logged consumption intervals as distinct proportional colored slices.

&#x20; - Interactive hover tooltips displaying the exact volume and time of consumption.

&#x20; - Dynamic center label showing total intake against target goal without overlapping.



\- \*\*Smart Physiological Calculation Engine\*\*:



&#x20; - Formulates daily hydration targets based on biological sex, body weight, activity level, and health conditions (e.g., kidney stones flush buffer, pregnancy).

&#x20; - Fetches local temperature via Open-Meteo API to adjust targets for hot weather.



\- \*\*Dual Unit Conversion\*\*:



&#x20; - One-click toggle between milliliters (ml) and glasses (1 glass = 250 ml) across progress rings, preset buttons, and entry logs.



\- \*\*Circadian Schedule \& Reminder Control\*\*:



&#x20; - Automatically mutes hydration notifications during defined sleep windows.

&#x20; - Dual-mode support: \*\*🤖 Auto Sync\*\* (syncs to real-time clock) and \*\*✋ Manual Lock\*\* (instant one-click toggle).



\- \*\*Physiological Alert Banners\*\*:



&#x20; - Real-time warnings for excess water intake (>300 ml over goal) and rapid bolus drinking (>800 ml in 45 minutes).



\- \*\*Administrative Inspection Portal\*\*:



&#x20; - Metrics dashboard displaying registered users, session counts, and average intake.

&#x20; - Deep inspection modal containing interactive donut rings, 7-day retrospective bar graphs, and timestamped interval lists.

&#x20; - Inline target goal adjustment and account deletion capabilities.



\---



\## 2. Setup and Installation Steps

## Setup and installation steps



\### Prerequisites

\- Node.js (v18.x or later installed)

\- Backend API running on `http://localhost:5000` (or a hosted URL)



\### Step-by-Step Installation

1\. Clone the repository and navigate to the frontend directory:

&#x20;  ```bash

&#x20;  git clone \[https://github.com/Aakarsh0519/water-intake-frontend.git](https://github.com/Aakarsh0519/water-intake-frontend.git)

&#x20;  cd water-intake-frontend

