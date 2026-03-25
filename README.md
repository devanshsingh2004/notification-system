# 🚀 Notification System

A scalable notification system using queue-based architecture.

---

## 🧠 Architecture

Client → API → Redis → Worker → AWS SES → DB

---

## ⚙️ Requirements

- Node.js (v18+)
- Redis (running on localhost:6379)
- PostgreSQL (local or AWS RDS)

---

## 🚀 Setup

### 1. Clone repo

git clone https://github.com/devanshsingh2004/notification-system.git  
cd notification-system

---

### 2. Setup env

cp .env.example .env

Fill your credentials.

---

### 3. Install dependencies

```bash
cd api-service
npm install

cd ../worker-service
npm install
```
---

### 4. Start Redis
```bash
redis-server
```
---

### 5. Start API
```bash
cd api-service
npm run dev
```
---

### 6. Start Worker (IMPORTANT)
```bash
cd worker-service
node src/worker.js
```
---

### 7. Open app

http://localhost:3000

---

📬 Test API

POST /api/v1/notifications
```json
{
  "type": "EMAIL",
  "payload": {
    "email": "test@gmail.com",
    "subject": "Hello",
    "message": "Test message"
  }
}
```
⚠️ Notes
Redis must be running before worker
AWS SES must be configured
Verified email required (or production access)

---

# 🚀 Fix hardcoded configs (IMPORTANT)

Right now your worker uses:

```js
host: "127.0.0.1"
```

👉 Replace everywhere:

```js 
const connection = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
});
```
Same for DB:

```js
DATABASE_URL from env only
```
---
🚀 Helper scripts 

Inside root, create:

start.sh (Linux / EC2)
```bash 
#!/bin/bash

echo "Starting API..."
cd api-service && npm run dev &

echo "Starting Worker..."
cd ../worker-service && node src/worker.js

```
```bat 
start.bat (Windows)
echo Starting API...
cd api-service
start cmd /k npm run dev

echo Starting Worker...
cd ../worker-service
start cmd /k node src/worker.js
```
👉 Now user just runs:
```bash
./start.sh
```

cd ../worker-service
npm install
