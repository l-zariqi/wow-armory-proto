# WoW Armory Proto

This project contains a React frontend and an Express backend that talk to the Blizzard API to fetch character, realm, and item data for a WoW Classic-style armory experience.

WoW Forever live suggestions default to all supported regions (US, EU, KR, and TW) using the existing suggestion provider. Choose a suggestion to open it in its region, or choose a specific region for a direct full-name search. Suggestions are limited to the provider's index.

The Stats tab displays values reported by Blizzard's character statistics endpoint. Fields not returned by the API are shown as N/A.
For Classic Era and TBC Anniversary, item levels are loaded from Blizzard's item data when absent from equipment; gearscore is unavailable if a scored item's level cannot be loaded. PROGWOW realms, Classic Era EU4/EU5 realms, and the TBC Anniversary EU realm are excluded from the realm selector. Blizzard's TBC equipment responses may omit socket and equipped gem data.
The PvP tab displays the available Blizzard PvP summary, battleground statistics, and rated bracket records. Some characters or game versions may not provide these fields.
The Talents tab omits nodes with invalid Blizzard grid positions and displays a notice when this occurs.
The Guild tab loads the Blizzard guild roster on demand and shows the member details returned by the API, sorted by rank by default. Member names open their armory pages in a new tab when the required name and realm are available. Select a column heading to sort, and select it again to reverse the order. Rank 0 is labeled Guild Master and rank 1 Officer; other ranks remain numeric because Blizzard's roster does not provide their titles. Unavailable fields are shown as N/A; some guilds or game versions may not have an accessible roster.
The selected character tab is included in the URL so it remains selected after a refresh.

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

## Troubleshooting checklist

- Verify Node.js is installed: `node -v`
- Verify npm is installed: `npm -v`
- Confirm backend `.env` is populated
- Confirm backend is running before loading the app
- Confirm the frontend is pointing to the correct backend port

If you run into issues, the backend console usually logs the most helpful error details during startup and API requests.
