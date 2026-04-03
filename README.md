# ByteSky Cloud

ByteSky Cloud is a Node.js + Express + MongoDB application with a static frontend.

The backend serves the frontend directly, so you only need to run one process (`backend/server.js`).

## Tech Stack

- Backend: Node.js, Express, Mongoose
- Database: MongoDB
- Frontend: Static HTML/CSS/JS (served by backend)

## Project Structure

```text
bytesky-cloud/
  backend/
    server.js
    routes/
    models/
    .env
    package.json
  frontend/
    index.html
    css/
    js/
```

## Prerequisites

Install these on your PC first:

- Node.js LTS: https://nodejs.org/en/download/
- Git: https://git-scm.com/install/windows
- MongoDB Community Server: https://www.mongodb.com/try/download/community
- MongoDB Shell (mongosh): https://www.mongodb.com/try/download/shell

## 1. Get the Project

If using Git:

```powershell
git clone <your-repo-url>
cd bytesky-cloud
```

If using ZIP, extract it and open PowerShell in the extracted `bytesky-cloud` folder.

## 2. Install Backend Dependencies

```powershell
cd backend
npm install
```

## 3. Install and Start MongoDB (Local)

After installing MongoDB Community Server on Windows:

1. Open `services.msc`
2. Find service `MongoDB`
3. Ensure it is `Running` and Startup Type is `Automatic`

Or via PowerShell:

```powershell
Get-Service MongoDB
Start-Service MongoDB
```

Quick DB ping test:

```powershell
mongosh --eval "db.runCommand({ ping: 1 })"
```

## 4. Configure Environment Variables

Create `backend/.env`:

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/bytesky
JWT_SECRET=change_this_to_a_strong_secret
NODE_ENV=development
```

Notes:

- `MONGO_URI` points to local MongoDB.
- Use a strong `JWT_SECRET` in production.

## 5. Run the App

From `backend` folder:

```powershell
npm start
```

Expected logs include:

- `ByteSky Server started on http://localhost:5000`
- `MongoDB Connected Successfully`

## 6. Open in Browser

- App: http://localhost:5000
- Health check: http://localhost:5000/api/health

## Default Admin Login (Seeded on first run)

The server seeds an admin account if it does not exist:

- Email: `admin@bytesky.cloud`
- Password: `Admin@2024Secure!`

Important: change this password immediately for real deployments.

## Useful Commands

From `backend`:

```powershell
npm start
```

## Troubleshooting

### MongoDB connection error

- Confirm `MongoDB` service is running:

```powershell
Get-Service MongoDB
```

- Re-check `MONGO_URI` in `backend/.env`.

### Port 5000 already in use

Change `PORT` in `backend/.env`, for example:

```env
PORT=5001
```

Then open `http://localhost:5001`.

### `npm install` fails

- Make sure Node.js is installed and updated:

```powershell
node -v
npm -v
```

- Delete `backend/node_modules` and `backend/package-lock.json`, then reinstall:

```powershell
cd backend
Remove-Item -Recurse -Force node_modules
Remove-Item -Force package-lock.json
npm install
```

## Production Notes

- Do not use the seeded default admin password in production.
- Set strong secrets and production-grade DB credentials.
- Put the app behind HTTPS + reverse proxy (for example Nginx/Caddy) before public access.


MongoDB Setup Guide (Windows)
1. Install MongoDB
Go to: https://www.mongodb.com/try/download/community
Select:
Version: 6.0.x (Important for compatibility)
Platform: Windows
Download and run the installer
During installation:
Choose Complete Setup
Enable Install MongoDB as a Service
Install MongoDB Compass (GUI)
2. Add MongoDB to PATH

Navigate to MongoDB installation folder:

C:\Program Files\MongoDB\Server\6.0\bin
Copy the above path
Open:
Search: Environment Variables
Click: Edit the system environment variables
Click Environment Variables
Under System Variables:
Select Path
Click Edit

Click New and paste:

C:\Program Files\MongoDB\Server\6.0\bin
Click OK → OK → OK
Restart terminal
3. Verify Installation

Open Command Prompt and run:

mongod --version
mongosh
4. Create Data Directory

MongoDB requires a data folder.

Run:

mkdir C:\data\db
5. Start MongoDB Server

Run:

mongod

Expected output:

Waiting for connections on port 27017
6. Open MongoDB Shell

Open a new terminal and run:

mongosh
7. Test Database

Run the following commands:

use mydb
db.users.insertOne({ name: "test", age: 20 })
db.users.find()
8. (Optional) Use MongoDB Compass
Open MongoDB Compass

Use connection string:

mongodb://localhost:27017
Click Connect
Notes
Always ensure MongoDB server (mongod) is running before using mongosh
If mongod fails, check:
PATH configuration
Data directory exists


🔧 Backend Dependencies (Node.js)

This project uses the following backend dependencies for building a secure and scalable API.

📦 Production Dependencies

Install all at once:

npm install express mongoose bcryptjs jsonwebtoken cors dotenv pdfkit speakeasy qrcode

Details

Package	Version	Purpose
express	^4.18.2	Web framework for API routes
mongoose	^7.5.0	MongoDB ODM (database models)
bcryptjs	^2.4.3	Password hashing & encryption
jsonwebtoken	^9.0.2	JWT authentication
cors	^2.8.5	Cross-Origin Resource Sharing
dotenv	^16.3.1	Environment variable management
pdfkit	^0.13.0	PDF invoice generation
speakeasy	^2.0.0	Two-Factor Authentication (2FA)
qrcode	^1.5.3	QR code generation for 2FA
🛠️ Development Dependencies

Install:

npm install --save-dev nodemon
Details
Package	Version	Purpose
nodemon	^3.0.1	Auto-restart server on file changes