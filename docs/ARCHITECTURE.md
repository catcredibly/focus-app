# Shihen Architecture

## Current runtime guarantees

- Shihen is single-instance. A second launch focuses the existing main window.
- The main window and compact popout share one authoritative active Timer through persisted state and cross-window updates.
- Running, Paused, Finished, recovery, checkpoint, note, and save-failure state is kept in the active Timer record until it is finalized or explicitly discarded.
- Completed Sessions may include focus intervals so daily and weekly goals allocate focused time correctly across local day and Monday-based week boundaries.
- The popout can target the current monitor or an explicit display. Native Windows work-area coordinates keep docking clear of the taskbar and support negative multi-monitor coordinates.
- English, Simplified Chinese, Traditional Chinese, and Japanese are selectable persisted locales. User-created names and notes are never translated.

## Technology stack

- **Tauri 2 and Rust** provide the Windows desktop shell and native integrations.
- **React 19 and TypeScript** implement the application UI and domain logic.
- **Vite** builds and serves the frontend.
- **Tailwind CSS 4** is available through the Vite integration alongside the app's shared CSS.
- **Dexie 4 and IndexedDB** provide local-first persistence and reactive queries.
- **Recharts** renders the standard analytics charts; custom React/CSS views render heatmaps and other specialized visualizations.
- **Vitest** covers data, timer, analytics, settings, and import/export behavior.

## Runtime structure

```text
Windows
  -> Tauri 2 application
       -> Main React WebView window
       -> Compact timer React WebView popout
```

Both windows load the same Vite bundle. `App.tsx` selects the compact popout UI when the window URL contains `#/popout`; otherwise it renders the main application and its page navigation.

Application and domain behavior lives in TypeScript. Native Windows behavior is implemented through Tauri APIs, Rust commands, and narrowly scoped Tauri plugins where needed.

## Persistence

Shihen uses one local IndexedDB database through Dexie. Its main stores are:

- `academicYears`
- `subjects`
- `sessions`
- `settings`

Dexie schema versions define indexes and migrate older Sessions to the current backwards-compatible shape. Settings are stored as string key/value records and exposed through typed TypeScript helpers.

The active in-progress timer is transient recovery state rather than study history. It is stored separately in `localStorage` until it is cleared or completed; completed Sessions are written to IndexedDB.

The production Dexie database name is `focus`. A fresh installation creates the schema with empty study tables and default settings supplied by application code; no development database is bundled.

## Data relationships

```text
Academic Year
  -> Subjects
       -> Sessions
```

A Subject stores its parent `academicYearId`. A Session stores its `subjectId`, plus the Academic Year ID and display-name snapshots needed for history and backwards compatibility.

Archiving retains records. Permanent deletion uses Dexie transactions and follows the current deletion rules: deleting a Subject removes its Sessions, while deleting an Academic Year removes its Subjects and their Sessions. This prevents orphaned dependent records.

## Timer architecture

The user-facing timer states are:

- Idle
- Running
- Paused
- Expired/Finished

Pure functions in `timerState.ts` perform timer calculations from timestamps. The `useTimer` hook owns the live React state, persists recoverable active-timer state, and coordinates completion behavior.

There is one authoritative active timer shared by the main window and popout. The windows synchronize updates through a `BroadcastChannel` and recover from the same stored timer state. The popout does not run an independent timer, and closing it does not stop or alter the active Session.

## Analytics

```text
IndexedDB Sessions
  -> apply effective Subject/Academic Year archive status and filters
  -> pure TypeScript aggregation utilities
  -> React Analytics pages
  -> Recharts and custom heatmaps
```

The Analytics UI reads the Dexie stores with live queries, so persisted changes flow into the dashboard without a separate analytics database or cache. Aggregation utilities group completed focus time by date, Subject, Academic Year, session length, and other displayed dimensions.

## Import / Export

- **JSON full backup and restore** includes Academic Years, Subjects, Sessions, and Settings. Restore data is validated and applied transactionally using merge or replace behavior.
- **CSV Session import and export** supports Shihen's CSV format and mapped generic CSV data, including duplicate and invalid-row checks.

In the desktop app, Tauri file dialogs and filesystem access read and write these files. Browser development mode uses download and file-input fallbacks.

## Native Windows integration

The repository currently implements these native features:

- Native open/save file dialogs and filesystem access for import/export
- A configured compact timer popout window
- Popout always-on-top, taskbar visibility, sizing, positioning, and monitor-bound checks
- Native close handling that hides the popout without changing timer state
- Desktop completion notifications
- Launch-at-startup control
- Main-window maximize and restore controls through the Tauri window API

Rust in `src-tauri/src/lib.rs` owns the custom window commands and lifecycle handling. Tauri plugins provide dialogs, filesystem access, notifications, and autostart support.

## Release identity

- Visible brand: `Shihen`
- Internal product name: `Focus` (retained for installation compatibility)
- Version: `1.2.0`
- Tauri application identifier: `com.focus.timer`
- Dexie database name: `focus`
- Windows installer: NSIS

The application identifier and database name are stable V1 identities. Future installers must retain them so upgrades continue to use the same installed application and local data store.

The Orange leaf is the permanent Windows application icon. In-app leaf artwork follows the selected accent using approved packaged variants.

## Main source structure

```text
src/
  analytics/        Pure aggregation utilities, development data, and tests
  assets/           Frontend-owned packaged assets
  components/       Pages, dialogs, navigation, timer, and settings UI
  hooks/            Shared React hooks for timer and settings state
  importExport/     JSON backup/restore and CSV import/export
  App.tsx           Main-window routing and popout entry selection
  db.ts             Dexie database and schema versions
  types.ts          Persistent data model types
  settings.ts       Typed settings defaults and persistence helpers
  timerState.ts     Pure timer state calculations
  timerCompletion.ts Completion sound, notification, and popout effects
  management.ts     Transactional archive and deletion operations
  styles.css        Shared application styling

src-tauri/
  src/              Rust entry point and native window commands
  capabilities/     Allowed Tauri plugin and window capabilities
  icons/            Packaged Windows/application icons
  tauri.conf.json   Application and window configuration
```


## Release notes and updater metadata

Use one UTF-8 Markdown notes file for the GitHub Release body and updater manifest.
After the existing signed release build, run (with the actual current-version artifact):

```powershell
node tools/generate-updater-manifest.mjs --notes RELEASE_NOTES.md --artifact "src-tauri/target/release/bundle/nsis/Focus_<version>_x64-setup.exe" --repository catcredibly/shihen
gh release create "v<version>" --repo catcredibly/shihen --notes-file RELEASE_NOTES.md <installer> <installer.sig> <latest.json>
```

The helper reads the authoritative package version and existing matching `.sig`;
it does not build, sign, upload, or change the embedded updater endpoint/public key.
Use `--platform linux-x86_64 --artifact <signed AppImage>` to add Linux updater
metadata to the same output with `--output <latest.json>`. Only same-version platform
entries are retained, preventing stale signatures from carrying into another release.
Never commit generated manifests, signatures or bundles. JSON serialization preserves
quotes/newlines in notes. The frontend escapes all text and supports only headings,
paragraphs, lists, bold, inline code and HTTP(S) links; it never renders raw HTML.

## Experimental desktop capabilities

One React application and Tauri project serve Windows and Linux. Windows native
window constraints and display-message handling remain target-gated. Linux uses
GTK's selected backend and monitor signals behind Rust capability queries, not UI
OS checks. X11/XWayland supports placement where the window manager permits it.
Native Wayland uses compositor placement and keeps popouts visible instead of hiding
them behind an unplaceable reveal tab; global shortcuts are unavailable without an
appropriate backend. Existing preferences remain saved. Real Linux desktop testing
is still needed for mixed-DPI monitors, docking, autostart and notifications. The
Linux workflow is manually run by the maintainer; headless checks do not establish
native desktop parity.

## Platform architecture

Keep Shihen as one shared Tauri/React codebase. Do not create separate Windows and Linux application implementations.

For platform differences, use this order of preference:

1. Use Tauri's cross-platform API when it provides the required behavior.
2. For small OS-specific differences, use narrowly scoped Rust `#[cfg(...)]` branches.
3. For substantial native behavior that differs between Windows and Linux, isolate it behind a shared interface with platform-specific Rust implementations/modules.
4. If exact parity is not available, especially under Wayland, use a graceful fallback rather than forcing Windows-specific behavior or allowing the feature to fail.

Keep React/UI code platform-neutral wherever practical. The frontend should request capabilities such as reveal, dock, or determine work area without needing to know the OS-specific implementation.

Where behavior genuinely depends on environment capabilities rather than simply the OS, prefer capability-based handling over scattered checks such as `platform === "linux"`.

Keep Windows-specific dependencies and imports target-gated so they are not unnecessarily compiled/imported on Linux. Add Linux-specific native dependencies only when Tauri/cross-platform APIs are insufficient.

Do not refactor working Windows-native implementations merely for architectural symmetry. Introduce platform abstraction where it meaningfully isolates substantial platform differences.

For Linux, account for both X11 and Wayland. If a feature such as precise window positioning/docking cannot be implemented reliably under a particular environment, degrade gracefully and document the limitation rather than treating it as a build/runtime failure.

The goal is:

- one repository
- one shared React application
- one Tauri project
- shared behavior by default
- small `#[cfg]` branches for small differences
- platform modules/adapters for substantial native differences
- graceful capability-based fallbacks where exact parity is impossible