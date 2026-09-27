## What's new

- Added a new **Stopwatch** mode for open-ended Focus Sessions, with the same Subject, note, pause/resume, History, Analytics, goals, Fullscreen, and Popout support as timers.
- Added a split **Start** button so Stopwatch Sessions can be started without changing the normal Timer-first workflow.
- Added an **Academic Year summary** to Analytics with Sessions, Subjects, Active days, and Average Session for the selected date range.
- Improved Subject color assignment so new Subjects use the least-used palette color within their Academic Year while existing colors stay stable.

## Fixes

- Fixed Timer completion so reaching `00:00:00` keeps the Session active until it is finished, voided, or extended.
- Fixed Timers that expire while Focus is closed so they restore to the normal finished state without auto-saving, replaying completion alerts, or counting closed-app time.
- Fixed Default Subject behavior so configured Subjects apply reliably, update immediately for inactive Sessions, and stay scoped to the current Academic Year.
- Fixed invalid configured Subjects by safely falling back to **Remember last used** instead of leaving an unusable default.
- Reworked the Popout lifecycle so it closes when a Session is actually finalized rather than simply when a Timer reaches zero.
- Improved the Popout Reveal shortcut system, including safer registration, replacement, clearing, and migration to the new **Ctrl + Alt + F** default.
- Fixed Analytics minimum-width handling on Windows so restoring or unsnapping the window cannot leave Analytics below its required width.

## Other improvements

- Updated Session length distribution ranges to clearer 30-minute buckets, with separate ranges for 2–2:59 hour and 3+ hour Sessions.
- Renamed **Average** to **Average Session** in Subject Analytics for clearer meaning.
- Refined the Academic Years Analytics layout while preserving the existing comparison bars and Sessions indicators.
- Removed the obsolete **Close popout when timer finishes** setting in favor of consistent Session-based Popout behavior.
- Added a development-only updater preview tool for testing the real update dialog without publishing or installing an update.
- Improved Windows/Linux separation for window sizing behavior while preserving the existing Linux minimum-size path.
- Renamed the app from **Focus** to **Shihen** across user-facing branding.
