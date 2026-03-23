# AttendIQ — IMS Ghaziabad Attendance Tracker

A smart attendance tracker for IMS Ghaziabad students. Logs into the college ERP automatically and gives you real data with smart insights — built better than Attendance Mate.

---

## Features

- **Live ERP Login** — logs into `erp.imsuc.ac.in` with your Admission ID and Password
- **Attendance Overview** — total classes, present, absent, percentage with animated ring
- **Smart Insights** — safe bunk count, classes needed for 75%, classes needed for 90%
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
Backend (Node.js) logs into erp.imsuc.ac.in
        ↓
ERP returns HTML with attendance data in ng-init
        ↓
Backend parses data and returns clean JSON
        ↓
Frontend shows dashboard with smart features
```

The ERP login flow (discovered by inspecting browser network requests):
- `GET /` — get initial session cookie
- `POST /` with `email` + `password` fields — login (returns 303 redirect on success)
- `GET /admission/view_attendance` — get attendance page with ng-init data
- `GET /admission/scheduler` — get today's class schedule
- `POST /admission/view_schduleAttendence` with `selectDate=DD-MM-YYYY` — get date-wise attendance

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

**4. Open the frontend**

Open `frontend/index.html` in Chrome. That's it.

**5. Login**

Enter your IMS Admission ID and Password. Your real attendance data will load.

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
6. Copy your URL e.g. `https://attendiq-backend.onrender.com`

### Frontend → GitHub Pages

1. Open `frontend/index.html`
2. Find this line at the top of the script:
   ```javascript
   const API_BASE = 'http://localhost:3001';
   ```
3. Replace with your Render URL:
   ```javascript
   const API_BASE = 'https://attendiq-backend.onrender.com';
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

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/login` | Login to ERP and get attendance data |
| GET | `/api/datewise` | Get attendance for a specific date |
| GET | `/` | Health check |

### POST /api/login

**Request body:**
```json
{
  "admission_no": "YOUR_ADMISSION_ID",
  "password": "YOUR_PASSWORD"
}
```

**Response:**
```json
{
  "success": true,
  "student": {
    "name": "Student Name",
    "admission_no": "A2024XXX",
    "course": "BCA",
    "semester": "4",
    "section": "BCA1"
  },
  "attendance": {
    "total": 180,
    "present": 141,
    "absent": 39,
    "percentage": 78,
    "label": "Satisfactory"
  },
  "schedule": [...],
  "datewise": [...],
  "fetchedAt": "2026-03-23T10:00:00.000Z"
}
```

### GET /api/datewise?date=23-03-2026&admission_no=YOUR_ID

**Response:**
```json
{
  "success": true,
  "date": "23-03-2026",
  "records": [
    {
      "subject": "OPERATING SYSTEM (OS)",
      "faculty": "Purnima Gupta",
      "code": "402",
      "room": "307",
      "status": "present"
    }
  ]
}
```

---

## Security Notes

- Credentials are sent directly from the frontend to your own backend server
- The backend uses them only to make a single ERP request, then discards them
- Sessions are stored in memory only — cleared when server restarts
- No database, no logging of credentials, no third-party services

---

## Known Limitations

- Date-wise data shows "Not Taken Yet" for classes where faculty hasn't marked attendance
- Schedule tab was removed as ERP returns class names only without faculty info from that endpoint

---

## Built With

- **Frontend:** Pure HTML + CSS + Vanilla JS (single file, no frameworks)
- **Backend:** Node.js + Express + Axios + Cheerio
- **ERP:** erp.imsuc.ac.in (IMS Ghaziabad)

---

## License

Built for personal use by an IMS Ghaziabad student. Not affiliated with IMS Ghaziabad.