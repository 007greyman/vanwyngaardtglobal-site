# VWG Staff — Van Wyngaardt Global staff app

A mobile staff app for Van Wyngaardt Global: sign in, staff info, shifts and clock in / out. The layout follows a standard security-workforce app: a dark sign-in screen, a side menu, and weekly shift lists that open into roster detail pages.

It is a Progressive Web App built with plain HTML, CSS and JavaScript. There is no build step. On a phone, open it and choose **Add to Home Screen** to install it like a normal app.

## Screens

**Sign in.** The gold ring logo sits on a navy background. Staff sign in with their email address and password, and can show or hide the password. The screen also has **Forgot Password** (sends a reset request to managers) and **Log In with Domain** (checks the company domain). Four intro slides show on first launch.

**Side menu** (opened with the ☰ button):
- A profile photo with a camera button to change it.
- **CLOCK IN / CLOCK OUT** and **QR / NFC** buttons.
- The menu items:

| Menu item | What it does |
| --- | --- |
| Dashboard | Live clock, shift timer, breaks, quick tiles, and today's and upcoming shifts. After signing in, the app opens on **My Shifts**; change `startPage` in `CONFIG` to open somewhere else. |
| Occurrence Log | Timestamped site log. Clock-ins, checkpoints, visitors and forms are added to it automatically. |
| My Shifts | Week picker (`Sep 28 - Oct 04`) and shift cards. Tapping one opens **My Roster Detail**: notes, **Open in Maps**, **View Contacts**, clock in, and offer the shift for cover. |
| Offered Shifts | Open shifts for each week. **Accept Shift** sends the shift to a manager to confirm. |
| Submit Leave | Month calendar (Previous / Next). Tap a day to request leave, or to mark yourself Unavailable. Pending leave shows as a hollow blue circle and approved leave as a filled circle. Shows the fixed leave balance (allowance minus approved annual leave). |
| Incident / Forms | Search by location, site, ID or form name. **Add** opens a list of forms: Incident Report, Near Miss, Patrol Report, Vehicle Check, Lost Property, Maintenance Issue. Each submission gets an ID such as `F00001`. |
| Document Library | Tabs: **Shift Docs** (documents for the sites and customers of your upcoming shifts), **Company**, **Customer**, **Site**. Keyword search. Status shows View Only, Signature Required or Signed. Admins use **Add**. |
| Team Message | Search, plus conversations: All Staff, one group per site, and direct messages. |
| Electronic Sign On Register | Week picker and a day strip. For the chosen site (tap the site name to change it), each rostered or signed-on staff member with their licence number and sign-on / sign-out times. **Share** sends the register, or downloads a CSV where sharing isn't supported. Visitor sign-in is further down the page. |
| Welfare Check | **I'M OK** check-in, due every 60 minutes while on shift, and **I NEED HELP**, which alerts managers and calls 999. |
| VWG Support | Chat-style help desk. It opens with a welcome message giving the daytime and out-of-hours phone numbers. Common questions (password, clocking, QR, leave, shifts, pay) get an instant answer. Staff can attach photos. Managers reply from **Admin → Requests → Support chats**. |
| My Profile | Photo with camera button. Editable First Name, Last Name, Email, Mobile and Pin, with **Save Changes** and **Logout**. **My Documents**: upload ID, licence card or certificates (images, or PDFs under 1 MB). **My Compliance**: SIA licence, Right to Work, BS7858 vetting, DBS and First Aid, each shown as Valid, Expiring Soon, Expired or Missing. **Company Compliance**: policies still to sign and training still to finish. |
| Training Module | Video list, each with a film icon, title and description. Built-in modules: Clock Out with Customer Approval, Submitting Leave & Unavailability, Clocking into Shifts, My Roster page. Opening one plays the video (YouTube, Vimeo or .mp4 link) and shows a written guide and a quick quiz. Admins can add or delete videos. |
| My Timesheet | Hours for this week, last week or this month, estimated pay, and CSV export. |
| Admin Dashboard (admins only) | Live (who's on shift, who's missing, welfare alerts), Staff, Sites (address, contacts, QR/NFC code), Roster, Requests (confirm shifts, leave, incidents, password resets), Reports (hours, wage cost, CSV exports, backup and restore). |

**Clock out with customer approval.** CLOCK OUT opens a screen where the customer's representative can type their name and sign with a finger. This is optional. The approval and signature are saved with the hours, shown on the timesheet (tap to view the signature) and included in the CSV export.

**QR / NFC.** Scan a site's QR code with the camera, tap an NFC tag, or type the site code. If you are not clocked in, this clocks you in at that site. If you are already on shift, it logs a patrol checkpoint. Camera scanning works on Chrome/Android and uses `BarcodeDetector`. NFC works on Chrome/Android. Typing the code works everywhere. To make a QR code for a site, put its site code (for example `VWG-NG01`) into any QR code generator and print it.

The app saves your GPS location when you clock in and when you do a welfare check, if you allow it.

## Demo logins

The password for all demo accounts is `Password1`.

| Email | Access |
| --- | --- |
| jack@vanwyngaardtglobal.com | Admin |
| sarah@vanwyngaardtglobal.com | Admin |
| daniel@, emma@, liam@vanwyngaardtglobal.com | Staff |

## Settings

The `CONFIG` block at the top of `app.js` holds:
- company name
- domain
- currency
- support phone numbers (daytime and out of hours) and email
- emergency number
- welfare check interval
- `startPage`: the first screen after signing in
- `loginBackground`: an optional team photo shown behind the sign-in screen and menu header. Put the image file (for example `login-bg.jpg`) in `staff-app/` and set its name here. It's tinted navy automatically.

Brand colours are CSS variables at the top of `styles.css`: navy `#16263f` and gold `#b09244`.

## Run locally

```bash
cd staff-app
python3 -m http.server 8080
# open http://localhost:8080
```

## Deploy

Upload the `staff-app/` folder to any static host: GitHub Pages, Netlify, Vercel, cPanel or similar. Serve it over **HTTPS**, which the camera, NFC, GPS, installing as an app and offline mode all need.

## Important: data storage

This version saves all data **on the device** in the browser's localStorage. That works for a demo, or for one shared device such as a gatehouse tablet. It does **not** sync between staff phones.

For live use across many phones, connect a backend such as Supabase, Firebase or your own API. In `app.js`, all reads and writes go through the `db` object and `save()`, so that is the one place to change. Until then, admins can use **Reports → Backup / Restore** to move data between devices.
