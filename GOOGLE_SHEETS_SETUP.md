
# Google Sheets Backend Integration Guide

Follow these strictly to migrate your portal from LocalStorage to Google Sheets.

## Phase 1: Google Sheet Setup

1.  **Create New Sheet**: Go to [sheets.new](https://sheets.new) and create a sheet named regarding your project (e.g., "InternPortal DB").
2.  **Create Tabs**: Rename/Create the following sheet tabs (at the bottom) exactly:
    *   `Interns`
    *   `Domains`
    *   `Submissions`
    *   `Settings`

## Phase 2: Deploy Backend Script

1.  Open the Sheet you just created.
2.  Go to top menu: **Extensions > Apps Script**.
3.  Delete any code in the editor (`function myFunction()...`).
4.  Copy the **entire content** of the `code.gs` file I provided (check your project folder) and paste it there.
5.  Click the **Deploy** button (blue button, top right) -> **New deployment**.
6.  **Configuration**:
    *   **Select type**: Web app.
    *   **Description**: "v1".
    *   **Execute as**: Me (your email).
    *   **Who has access**: **Anyone** (This is critical for the portal to work without login prompts).
7.  Click **Deploy**.
8.  **Authorize**: It will ask for permissions. Active -> Advanced -> Go to (project name) (unsafe) -> Allow.
9.  **Copy URL**: Apps Script will give you a "Web App URL" (ends in `/exec`). **COPY THIS URL.**

## Phase 3: Connect Frontend

1.  Open `db.js` in your code editor.
2.  Find the variable `GOOGLE_SCRIPT_URL` (I will add it in the next step).
3.  Paste the URL you copied inside the quotes.
    *   Example: `const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx.../exec";`
4.  Save `db.js`.

## Phase 4: Data Migration (One-Time)

The first time you run this, your Sheet is empty.
1.  Open `index.html`.
2.  The system will detect empty sheets and might show loading or blank data.
3.  Login as Admin.
4.  Go to **Manage Domains** -> Add your domains again (or they might use defaults).
5.  Go to **Settings** -> Click Save to initialize settings.
6.  Add your interns.

**Note on Auto-Sync**: 
Every time you Add/Update/Delete an intern, task, or setting, the system will now:
1.  Update the local view instantly (for speed).
2.  Send the data to Google Sheets in the background.
3.  If you refresh, it pulls fresh data from Sheets.
