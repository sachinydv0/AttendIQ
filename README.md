# AttendIQ — Smart Attendance Tracker

A smart attendance tracker for attendance data. Logs into the real data automatically and gives you real data with smart insights — built better than Attendance Mate.

---

## Features

- **Live Login** — logs  with your Admission ID and Password
- **Attendance Overview** — total classes, present, absent, percentage with animated ring
- **Smart Insights** — safe bunk count, classes needed for 75%, classes needed for 60%
- **Scenario Simulator** — drag sliders to see "what if I attend X more classes"
- **Date-wise Attendance** — pick any date to see every class with faculty, room, and Present/Absent status
- **Auto Light/Dark Theme** — follows your device theme automatically
- **No data stored** — credentials are used only to fetch data, never saved anywhere

---

## Project Structure

```
attendiq/
├── frontend/
│   └── index.html        ← Complete single-file frontend app
├── backend/
│   ├── server.js         ← Node.js backend (ERP scraper)
│   └── package.json
└── README.md
```

---

## How It Works

```
User enters ID + Password
        ↓
Backend (Node.js) logs into real data.
        ↓
        
returns HTML with attendance data.
        ↓
Backend parses data and returns clean JSON
        ↓
Frontend shows dashboard with smart features
```


---

## Local Setup

### Requirements
- Node.js 18+
- A browser

### Steps

**1. Clone or download the project**
```bash
git clone https://github.com/YOUR_USERNAME/attendiq.git
cd attendiq
```

**2. Install backend dependencies**
```bash
cd backend
npm install
```

**3. Start the backend server**
```bash
node server.js
```
You should see: `Server running on http://localhost:3001`

**4. Open the frontend files html,css,app.js**

Open `frontend/index.html` in Chrome. That's it.

**5. Login**

Enter your Admission ID and Password. Your real attendance data will load.

---

## Deployment (Free)

### Backend → Render.com

1. Push the `backend/` folder to a GitHub repository
2. Go to [render.com](https://render.com) → Sign up with GitHub
3. New → Web Service → connect your repo
4. Set:
   - **Build Command:** `npm install`
   - **Start Command:** `node server.js`
   - **Plan:** Free
5. Click Deploy → wait ~3 minutes
6. Copy your URL e.g. `https://backend.url.com`

### Frontend → GitHub Pages

1. Open `frontend/index.html`
2. Find this line at the top of the script:
   ```javascript
   const API_BASE = 'http://localhost:3001';
   ```
3. Replace with your Render URL:
   ```javascript
   const API_BASE = 'https://url.onrender.com';
   ```
4. Push the `frontend/` folder to another GitHub repository
5. Go to repo Settings → Pages → Source: main branch → root
6. Your app is live at `https://YOUR_USERNAME.github.io/attendiq`

### Android App → Capacitor

To convert the frontend into a real installable APK:

```bash
npm install -g @capacitor/cli
npm install @capacitor/core @capacitor/android
npx cap init AttendIQ com.attendiq.app
npx cap add android
npx cap copy
npx cap open android
```

Then in Android Studio: Build → Generate Signed APK.

---

### POST /api/login

**Request body:**
```json
{
  "admission_no": "YOUR_ADMISSION_ID",
  "password": "YOUR_PASSWORD"
}
```

---

## Security Notes

- Credentials are sent directly from the frontend to your own backend server
- The backend uses them only to make a single data request, then discards them
- Sessions are stored in memory only — cleared after 5 minutes
- No database, no logging of credentials, no third-party services

---

## Known Limitations

- Date-wise data shows "Not Taken Yet" for classes where faculty hasn't marked attendance
- Schedule tab was removed as data returns class names only without faculty info from that endpoint

---

## Built With

- **Frontend:** Pure HTML + CSS + Vanilla JS (single file, no frameworks)
- **Backend:** Node.js + Express + Axios + Cheerio

---

## License

Built for personal use by an student. Not affiliated with any college.