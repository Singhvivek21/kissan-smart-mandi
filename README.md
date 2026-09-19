# 🌾 KISSAN — Procure Smart Mandi
### Digital Public Infrastructure (DPI) for Agricultural Procurement & Real-Time Queue Management
> **Smart India Hackathon (SIH 2026)** · Problem Statement `#26032`  
> *Rethinking the mandi procurement experience for Indian farmers through digital scheduling, transparent queue management, and instant DBT tracking.*

---

## 🎯 Problem Statement
Farmers in India often endure **long waiting times (12–48 hours)** outside APMC mandis, congested roadways with tractor trolleys, complete uncertainty regarding procurement schedules, and delayed information about weighment and Direct Benefit Transfer (DBT) payments.

### The KISSAN Solution
1. **Digital Slot Booking**: Farmers schedule mandi visits within 14-day windows from their smartphones.
2. **Instant Digital Gate Pass & QR Token**: Unique tokens (e.g. `KSM-104`) eliminate physical entry registration and paper paperwork.
3. **Live Mandi Queue Tracking**: Real-time visualization of queue progression, current token being served, and "farmers ahead" countdown.
4. **Automated Multichannel Notifications**: Dual-mode SMS notifications (Zero-cost mock mode & production MSG91) keeping farmers informed at every milestone.
5. **Form J Digital Certificate**: Electronic weighbridge readings, quality moisture grade testing, and instant digital Form J receipts at guaranteed Govt. MSP rates.
6. **DBT Payment Tracking**: Transparent end-to-end status tracking of Direct Benefit Transfers to farmers' bank accounts.
7. **KISSAN Saathi (Multilingual AI Assistant)**: Built on Google Gemini with voice input and audio synthesis, answering questions in Hindi, Punjabi, and English.

---

## 🏛️ System Architecture

```
                               ┌──────────────────────────────────────────────┐
                               │             KISSAN Frontend (Web)            │
                               │  HTML5 · CSS3 Design System v2.0 · JavaScript │
                               └──────────────────────┬───────────────────────┘
                                                      │
                       ┌──────────────────────────────┴──────────────────────────────┐
                       │                                                             │
                       ▼                                                             ▼
         ┌───────────────────────────┐                                 ┌───────────────────────────┐
         │       Farmer Portal       │                                 │      Officer Console      │
         │  • Dynamic Dashboard      │                                 │  • Real-Time Queue Caller │
         │  • Visual Slot Booking    │                                 │  • Weighbridge Entry Form │
         │  • Live Token Chain       │                                 │  • DBT Settlement Logger  │
         │  • Saathi Multilingual AI │                                 │  • SMS Gateway Console    │
         └─────────────┬─────────────┘                                 └─────────────┬─────────────┘
                       │                                                             │
                       └──────────────────────────────┬──────────────────────────────┘
                                                      │ HTTP / REST API
                                                      ▼
                                       ┌─────────────────────────────┐
                                       │     Node.js Core Server     │
                                       │       (Port 8080)           │
                                       └──────────────┬──────────────┘
                                                      │
                       ┌──────────────────────────────┼──────────────────────────────┐
                       ▼                              ▼                              ▼
        ┌────────────────────────────┐  ┌───────────────────────────┐  ┌───────────────────────────┐
        │       Supabase DB          │  │     Google Gemini AI      │  │     SMS Notification      │
        │  PostgreSQL / Auth / RLS   │  │ Tool-calling Mandi Engine │  │ Dual-Engine (Mock/MSG91)  │
        └────────────────────────────┘  └───────────────────────────┘  └───────────────────────────┘
```

---

## 📱 User Journeys

### 🚜 Farmer Flow
```
Register / Login ➔ Book Procurement Slot ➔ Receive QR Token ➔ Track Live Queue from Home ➔ Arrive at Gate Bay ➔ Weighment & Form J ➔ DBT Payment Credited
```

### 🎛️ Mandi Officer Flow
```
Officer Login ➔ Monitor Operations Dashboard ➔ Call Next Token / Scan QR ➔ Record Gross/Tare Weight ➔ Generate Form J ➔ Log DBT Settlement
```

---

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or higher)
- No external npm packages required for core server! Standard Node.js library used for lightweight, zero-dependency deployment.

### 1. Clone the Repository
```bash
git clone https://github.com/<your-username>/kissan-smart-mandi.git
cd kissan-smart-mandi
```

### 2. Configure Environment
Copy the `.env.example` file to `.env`:
```bash
cp .env.example .env
```
Edit `.env` to supply your credentials:
```env
PORT=8080
GEMINI_API_KEY=your_gemini_api_key_here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SMS_MODE=mock
```

### 3. Run the Server
```bash
npm start
# or
node server.js
```
Open your browser and navigate to:
```
http://localhost:8080
```

### 4. Run Automated Test Suite
```bash
npm test
```
*Executes all SMS lifecycle, procurement-payment, and booking integration test suites.*

---

## 🔑 Demo Credentials

| Role | Portal | Username / Email / ID | Password | Action |
| :--- | :--- | :--- | :--- | :--- |
| **Farmer** | `/login.html` | `farmer@gmail.com` | `Password123` | Click **"⚡ Demo Quick Login"** for 1-click access |
| **Officer** | `/admin-login.html` | `ADM-01` | `admin123` | Access queue caller, weighbridge, and SMS console |

---

## 📊 Government Minimum Support Price (MSP) Rates Configured
- **Wheat (गेहूं)**: ₹2,275 / Quintal
- **Paddy Grade A (धान)**: ₹2,203 / Quintal
- **Mustard (सरसों)**: ₹5,650 / Quintal
- **Gram / Chana (चना)**: ₹5,440 / Quintal
- **Maize (मक्का)**: ₹2,090 / Quintal
- **Cotton (कपास)**: ₹6,620 / Quintal

---

## 🛡️ Security & Privacy
- **Strict Scoping**: Farmer endpoints and dashboards strictly filter bookings, procurements, and payouts to the authenticated user's ID/mobile number.
- **Privacy Masking**: Recipient phone numbers in public SMS delivery audit logs are masked (e.g. `98765*****`).
- **Secret Protection**: `.env` and sensitive API keys are ignored via `.gitignore`.

---

## 📄 License
This project is developed under the MIT License for the **Smart India Hackathon 2026**.
