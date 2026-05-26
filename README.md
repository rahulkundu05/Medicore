# 🏥 MediCore — Healthcare Management System

Full-stack app with **Node.js + Express + MongoDB** backend and a single-file HTML frontend.

---

## 📁 Project Structure

```
medicore-backend/
├── server.js                  ← Express entry point
├── package.json
├── .env.example               ← Copy to .env and fill in values
│
├── models/
│   ├── User.js                ← User schema (bcrypt password hashing)
│   ├── Doctor.js              ← Doctor + slot map
│   ├── LabTest.js             ← Lab test + slot map
│   ├── Appointment.js         ← Doctor appt, Lab appt, Emergency booking
│   ├── Medicine.js            ← Medicine + Order
│   └── Hospital.js            ← Hospital with coordinates & slots
│
├── routes/
│   ├── auth.js                ← POST /register, POST /login, GET /me
│   ├── users.js               ← GET/PUT /profile
│   ├── doctors.js             ← GET /doctors, GET /doctors/:id/slots
│   ├── labTests.js            ← GET /labtests, GET /labtests/:id/slots
│   ├── appointments.js        ← Doctor & lab booking + cancellation
│   ├── medicines.js           ← GET medicines, POST order, GET orders
│   └── emergency.js           ← GET nearby hospitals, POST book, GET bookings
│
├── middleware/
│   └── auth.js                ← JWT verification middleware
│
├── seed/
│   └── seed.js                ← Populates MongoDB with initial data
│
└── public/
    └── index.html             ← Complete frontend (drop-in replacement)
```

---

## ⚡ Quick Start

### 1. Prerequisites
- **Node.js** v18+ — https://nodejs.org
- **MongoDB** — either local install or [MongoDB Atlas](https://www.mongodb.com/atlas) (free tier)

### 2. Install dependencies
```bash
cd medicore-backend
npm install
```

### 3. Configure environment
```bash
cp .env.example .env
```
Edit `.env`:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/medicore
JWT_SECRET=change_this_to_a_long_random_string
JWT_EXPIRES_IN=7d
```
> **MongoDB Atlas**: Replace `MONGODB_URI` with your Atlas connection string, e.g.:
> `mongodb+srv://user:pass@cluster.mongodb.net/medicore?retryWrites=true&w=majority`

### 4. Seed the database
```bash
npm run seed
```
This creates all doctors, lab tests, medicines, and hospitals in MongoDB.

### 5. Start the server
```bash
# Production
npm start

# Development (auto-restart on changes)
npm run dev
```

### 6. Open the app
Visit **http://localhost:5000** in your browser.

---

## 🔑 API Reference

All protected endpoints require: `Authorization: Bearer <token>`

### Auth
| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `/api/auth/register` | `{name,age,mobile,email,password}` | Create account |
| POST | `/api/auth/login` | `{email,password}` | Login, returns JWT |
| GET  | `/api/auth/me` | — | Verify token, get current user |

### Users
| Method | Path | Description |
|--------|------|-------------|
| GET  | `/api/users/profile` | Get profile |
| PUT  | `/api/users/profile` | Update name/age/mobile |

### Doctors
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/doctors` | All doctors (optional `?specialization=`) |
| GET | `/api/doctors/:id/slots?date=YYYY-MM-DD` | Available slots |

### Lab Tests
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/labtests` | All lab tests |
| GET | `/api/labtests/:id/slots?date=YYYY-MM-DD` | Available slots |

### Appointments
| Method | Path | Description |
|--------|------|-------------|
| POST  | `/api/appointments/doctor` | Book doctor appointment |
| GET   | `/api/appointments/doctor` | My doctor appointments |
| PATCH | `/api/appointments/doctor/:id/cancel` | Cancel + restore slot |
| POST  | `/api/appointments/lab` | Book lab test |
| GET   | `/api/appointments/lab` | My lab appointments |
| PATCH | `/api/appointments/lab/:id/cancel` | Cancel + restore slot |

### Medicines
| Method | Path | Description |
|--------|------|-------------|
| GET  | `/api/medicines` | All medicines with stock |
| POST | `/api/medicines/order` | Place order (deducts stock) |
| GET  | `/api/medicines/orders` | My orders |

### Emergency
| Method | Path | Description |
|--------|------|-------------|
| GET  | `/api/emergency/hospitals?x=&y=` | 3 nearest hospitals |
| POST | `/api/emergency/book` | Book emergency slot |
| GET  | `/api/emergency/bookings` | My emergency bookings |

---

## 🌐 Deploying to Production

### Option A — Railway (easiest)
1. Push code to GitHub
2. Create new Railway project → connect repo
3. Add environment variables in Railway dashboard
4. Done — Railway auto-detects Node.js

### Option B — Render
1. Push to GitHub
2. New Web Service on Render → connect repo
3. Build command: `npm install`
4. Start command: `npm start`
5. Add env vars

### Option C — VPS (DigitalOcean / EC2)
```bash
# Install Node + PM2
npm install -g pm2
pm2 start server.js --name medicore
pm2 save && pm2 startup
```

---

## 🛡️ Security Notes
- Passwords are hashed with **bcryptjs** (salt rounds: 12)
- JWT tokens expire in **7 days** (configurable)
- All data routes are **protected** — unauthenticated requests return 401
- Change `JWT_SECRET` to a long random string in production

---

## 🔄 Re-seeding
If you want fresh data (clears existing doctors/labs/medicines/hospitals):
```bash
npm run seed
```
> This does **not** delete user accounts or bookings.
