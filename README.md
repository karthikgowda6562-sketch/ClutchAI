# ⚡ Clutch.ai — The Autonomous AI Executive Assistant
### *Crush your deadlines before they crush you.*

[![Vibe2Ship Hackathon Winner](https://img.shields.io/badge/Hackathon-Winner_Vibe2Ship-cyan?style=for-the-badge&logo=google)](https://ai.studio/build)
[![Google Cloud Run](https://img.shields.io/badge/Compute-Cloud_Run-blue?style=for-the-badge&logo=google-cloud)](https://cloud.google.com)
[![Gemini API](https://img.shields.io/badge/Intelligence-Gemini_3.5_Flash-indigo?style=for-the-badge&logo=google-gemini)](https://ai.google.dev)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript_5.8-blue?style=for-the-badge&logo=typescript)](https://typescriptlang.org)

**Clutch.ai** is an elite, full-stack, AI-first productivity workstation designed to rescue students, entrepreneurs, and busy professionals from cold-start procrastination and missed deadlines. Instead of behaving like a standard passive to-do list that relies on ignorable alarms, Clutch.ai actively steps in to do the heavy lifting: **predicting scheduling risks, automatically planning your calendar, decomposing complex assignments into atomic sequential steps, and drafting starter work assets (code templates, emails, and outline frameworks) to defeat initial cognitive drag.**

---

## 🛠️ Key Architectural Pillars

```
                     ┌───────────────────────────┐
                     │     React + Vite Client   │
                     └─────────────┬─────────────┘
                                   │ HTTPS REST
                                   ▼
                     ┌───────────────────────────┐
                     │    Express Proxy Server   │
                     ├───────────────────────────┤
                     │ • Risk Assessment Engine  │
                     │ • JSON Local Persistence  │
                     └─────────────┬─────────────┘
                                   │ @google/genai SDK
                                   ▼
                     ┌───────────────────────────┐
                     │    Gemini 3.5 API Proxy   │
                     └───────────────────────────┘
```

1. **Autonomous Risk-Delay Classifier**: Evaluates remaining lead-time against historical complexity to generate live risk ratings (0–100%) and delay warnings.
2. **Proactive Task-Breakdown Agent**: Leverages **Gemini 3.5** to decompose tasks into timed sub-steps, producing custom boilerplate work drafts (procrastination killers).
3. **Emergency "Clutch Mode" Triage**: Generates an immediate minute-by-minute battleplan and a stakeholder extension request letter for high-risk, near-deadline tasks.
4. **Constraint-Based Calendar Allocation**: Auto-blocks calendar slots (9:00 to 18:00) using Gemini reasoning, adjusting for task weights and mental energy curves.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js v18+ 
- A **Gemini API Key** (configured in your project environment)

### Installation
1. Clone the repository and navigate to the root directory:
   ```bash
   git clone https://github.com/your-username/clutch-ai.git
   cd clutch-ai
   ```
2. Install the necessary full-stack dependencies:
   ```bash
   npm install
   ```
3. Configure your API credentials inside a `.env` file:
   ```env
   GEMINI_API_KEY="your-actual-api-key-here"
   ```
4. Fire up the high-performance local development server:
   ```bash
   npm run dev
   ```
5. Open your browser and navigate to `http://localhost:3000` to interact with Clutch.ai.

---

## 🏗️ Production Build & Deployment

To compile the application for optimized hosting on serverless platforms (such as **Google Cloud Run**):

```bash
# Builds the Vite client & bundles the Express backend server with esbuild
npm run build

# Boots the compiled full-stack server
npm run start
```

This production pipeline compiles our frontend into high-performance static bundles and wraps our backend server inside a single, high-efficiency CJS bundle (`dist/server.cjs`), eliminating file I/O latency.

---

## 📦 Core Directory Structure

```
├── server.ts               # Express Full-Stack Server & Gemini API router
├── data.json               # Local persistent database file
├── src/
│   ├── App.tsx             # Main dashboard orchestration component
│   ├── types.ts            # Common data model schemas
│   ├── index.css           # Global custom CSS & Tailwind v4 styling
│   ├── main.tsx            # React application entry point
│   └── components/
│       ├── Sidebar.tsx     # Workspace navigation sidebar
│       ├── StatsGrid.tsx   # Stripe-style performance indicators
│       ├── TaskCard.tsx    # Card component with micro-checklists & artifact drawers
│       ├── FocusMode.tsx   # Pomodoro focus screen with equalizer animations
│       ├── Scheduler.tsx   # Constraint-based calendar block scheduler
│       ├── CoachChat.tsx   # ChatGPT-style advisor center with quick chips
│       ├── NewTaskModal.tsx# Task escalation form overlay
│       └── HabitsTracker.tsx# Atomic routine builders
```

---

*Crafted for excellence at the Vibe2Ship Hackathon.*
