# VWG Staff — Van Wyngaardt Global staff app

A mobile-first staff app for Van Wyngaardt Global. Staff can sign in, clock in and out of shifts, see their roster and hours, and request leave. Managers get an admin dashboard.

It is a Progressive Web App built with plain HTML, CSS and JavaScript. There is no build step and nothing to install. On a phone, open it and choose **Add to Home Screen** to install it like a normal app.

## Screens

| Screen | What it does |
| --- | --- |
| Intro slides | 4 swipeable onboarding slides, shown on first launch. You can replay them from Profile. |
| Login | Employee number plus a 4–6 digit PIN. PINs are stored salted and hashed with SHA-256. |
| Home | Greeting, live clock, a big **Clock in** button, break start/end, a running shift timer, this week's stats, quick actions, upcoming shifts and announcements. |
| Roster | Week-by-week calendar strip, shifts per day, weekly total, shift-swap requests. |
| Hours | Timesheet for this week, last week or this month, with total hours, estimated gross pay and CSV export. |
| Team | Searchable staff directory showing who is on shift now, with tap-to-call and email. |
| Profile | Staff info (employee no., start date, contact, emergency contact, address), editing your own details, leave requests, PIN change and sign out. |
| Admin (admins only) | **Live**: who is clocked in and who is late. **Staff**: add, edit, deactivate or delete staff, reset PINs, set rates. **Roster**: add or edit shifts, with Mon–Fri repeat. **Requests**: approve leave and swaps. **Reports**: weekly hours and wage cost, CSV export, announcements, backup and restore. |

The centre button in the bottom bar clocks you in or out from any screen. When you clock in, the app also saves your GPS location if you allow it.

## Demo logins

| Employee no. | PIN | Access |
| --- | --- | --- |
| VWG001 | 1234 | Admin |
| VWG002 | 1234 | Admin |
| VWG003 – VWG005 | 1234 | Staff |

## Run locally

```bash
cd staff-app
python3 -m http.server 8080
# open http://localhost:8080
```

## Deploy

Upload the `staff-app/` folder to any static host: GitHub Pages, Netlify, Vercel, cPanel or similar. Serve it over HTTPS so that installing it as an app, working offline and GPS all work.

## Important: data storage

This version saves all data **on the device** in the browser's localStorage. That works well for one shared device, such as a tablet at the entrance used as a clock-in kiosk, or for a demo. It does **not** sync between different phones.

For each staff member to use their own phone, connect a backend such as Supabase, Firebase or a small API. In `app.js`, all reads and writes go through the `db` object and `save()`, so that is the one place to swap in the backend. Admins can use **Reports → Backup data / Restore** to move data between devices in the meantime.

## Files

- `index.html`: app shell
- `styles.css`: all styling (brand colours are at the top as CSS variables: navy `#0b1f3a`, gold `#d4a93c`)
- `app.js`: screens, data and logic
- `manifest.webmanifest`, `sw.js`, `icon.svg`: install and offline support
