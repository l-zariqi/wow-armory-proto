# WoW Armory Proto

This project contains a React frontend and an Express backend that talk to the Blizzard API to fetch character, realm, and item data for a WoW Classic-style armory experience.

## Requirements

Before you start, make sure you have the following installed:

- Node.js 18+ or 20+
- npm
- A Blizzard Developer account with a client ID and client secret

You can create a Blizzard API app here:
https://develop.battle.net/

## Repository structure

- `wow-armory-frontend/` — React app
- `wow-armory-backend/` — Express API server
- `package.json` — root script that runs both apps together

## 1) Install dependencies

From the project root:

```bash
npm install
cd wow-armory-backend && npm install
cd ../wow-armory-frontend && npm install
```

If you prefer to run the frontend and backend separately, install dependencies in each directory individually.

## 2) Configure environment variables

Create a `.env` file in the backend folder:

```bash
cd wow-armory-backend
copy .env.example .env
```

Then update the values in `.env`:

```env
CLIENT_ID=your_blizzard_client_id
CLIENT_SECRET=your_blizzard_client_secret
REGION=us
LOCALE=en_US
PORT=3001
```

Notes:

- `CLIENT_ID` and `CLIENT_SECRET` are required.
- `REGION` is usually `us` or `eu`.
- `LOCALE` can be values like `en_US`, `en_GB`, or `es_ES` depending on the Blizzard API data you need.
- `PORT` defaults to `3001` if you do not set it.

## 3) Run the project locally

### Option A: Run both apps together

From the project root:

```bash
npm start
```

This starts:

- Backend: http://localhost:3001
- Frontend: http://localhost:3000

### Option B: Run each app manually

Terminal 1:

```bash
cd wow-armory-backend
npm run dev
```

Terminal 2:

```bash
cd wow-armory-frontend
npm start
```

The frontend will typically open in the browser automatically. If it does not, open:

```text
http://localhost:3000
```

## 4) Common issues

### Backend fails with missing environment variables

Make sure `wow-armory-backend/.env` exists and contains valid Blizzard API credentials.

### Frontend cannot reach the API

Check that the backend is running on port 3001 and that the frontend is calling:

```text
http://localhost:3001/api
```

If you changed the backend port in `.env`, update the frontend API base URL accordingly in `wow-armory-frontend/src/App.js`.

### Blizzard API authentication errors

Double-check that:

- your client ID and secret are correct
- your app is active in the Blizzard Developer portal
- you have not exceeded API rate limits

## 5) Production build

To create a production build of the frontend:

```bash
cd wow-armory-frontend
npm run build
```

This creates a `build/` directory that can be deployed or served by a static host.

## 6) Useful commands

From the project root:

```bash
npm start
```

From backend:

```bash
npm run dev
npm start
```

From frontend:

```bash
npm start
npm test
npm run build
```

## Troubleshooting checklist

- Verify Node.js is installed: `node -v`
- Verify npm is installed: `npm -v`
- Confirm backend `.env` is populated
- Confirm backend is running before loading the app
- Confirm the frontend is pointing to the correct backend port

If you run into issues, the backend console usually logs the most helpful error details during startup and API requests.
