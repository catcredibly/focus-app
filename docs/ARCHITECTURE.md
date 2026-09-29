# Shunhen Architecture

## Current runtime guarantees

- Shunhen runs as a single-instance application. A second launch focuses the existing main window.
- The main window and compact popout share one authoritative active Timer through persisted state and cross-window updates.
- Running, Paused, Finished, recovery, checkpoint, note, and save-failure state remains in the active Timer record until it is finalized or explicitly discarded.
- Completed Sessions may include focus intervals so daily and weekly goals allocate focused time correctly across local-day and Monday-based week boundaries.
- The popout can target either the current monitor or an explicitly selected display. Native Windows work-area coordinates keep docking clear of the taskbar and support negative coordinates in multi-monitor layouts.
- English, Simplified Chinese, Traditional Chinese, and Japanese are available as persisted locales. User-created names and notes are not translated.

## Technology stack

- **Tauri 2 and Rust** provide the desktop shell and native integrations.
- **React 19 and TypeScript** implement the application UI and domain logic.
- **Vite** builds and serves the frontend.
- **Tailwind CSS 4** is available through the Vite integration alongside the application's shared CSS.
- **Dexie 4 and IndexedDB** provide local-first persistence and reactive queries.
- **Recharts** renders standard analytics charts, while custom React/CSS views handle heatmaps and other specialized visualizations.
- **Vitest** covers data, timer, analytics, settings, and import/export behavior.

## Runtime structure

```text
Windows
  -> Tauri 2 application
       -> Main React WebView window
       -> Compact timer React WebView popout
```

Both windows load the same Vite bundle. `App.tsx` selects the compact popout UI when the window URL contains `#/popout`; otherwise, it renders the main application and page navigation.

Application and domain behavior resides primarily in TypeScript. Native desktop behavior is implemented through Tauri APIs, Rust commands, and narrowly scoped Tauri plugins where required.

## Persistence

Shunhen uses a single local IndexedDB database through Dexie. Its primary stores are:

- `academicYears`
- `subjects`
- `sessions`
- `settings`

Dexie schema versions define indexes and migrate older Sessions to the current backwards-compatible shape. Settings are stored as string key/value records and exposed through typed TypeScript helpers.

The active in-progress timer is treated as transient recovery state rather than study history. It is stored separately in `localStorage` until cleared or completed. Completed Sessions are written to IndexedDB.

The production Dexie database is named `focus`. A fresh installation creates an empty study schema and uses application-defined default settings. No development database is bundled.

## Data relationships

```text
Academic Year
  -> Subjects
       -> Sessions
```

A Subject stores its parent `academicYearId`. A Session stores its `subjectId` together with Academic Year ID and display-name snapshots used for history and backwards compatibility.

Archiving retains records. Permanent deletion follows the application's current relational rules and is performed using Dexie transactions. Deleting a Subject also removes its Sessions, while deleting an Academic Year removes its Subjects and their Sessions. This prevents orphaned dependent records.

## Timer architecture

The user-facing timer states are:

- Idle
- Running
- Paused
- Expired/Finished

Pure functions in `timerState.ts` calculate timer state from timestamps. The `useTimer` hook owns the live React state, persists recoverable active-timer state, and coordinates completion behavior.

The application maintains one authoritative active timer shared between the main window and popout. Both windows synchronize through a `BroadcastChannel` and recover from the same persisted timer state. The popout does not maintain an independent timer, and closing it does not stop or otherwise alter the active Session.

## Analytics

```text
IndexedDB Sessions
  -> effective Subject/Academic Year archive status and filters
  -> pure TypeScript aggregation utilities
  -> React Analytics pages
  -> Recharts and custom heatmaps
```

The Analytics UI reads Dexie stores through live queries, allowing persisted changes to flow directly into the dashboard without a separate analytics database or cache.

Aggregation utilities group completed focus time by date, Subject, Academic Year, session length, and other dimensions displayed by the analytics interface.

## Import / Export

- **JSON full backup and restore** covers Academic Years, Subjects, Sessions, and Settings. Restore data is validated and applied transactionally using either merge or replace behavior.
- **CSV Session import and export** supports Shunhen's native CSV format as well as mapped generic CSV data, with checks for duplicate and invalid rows.

In the desktop application, Tauri file dialogs and filesystem APIs handle file access. Browser development mode uses download and file-input fallbacks.

## Native Windows integration

The current Windows implementation includes:

- Native open/save dialogs and filesystem access for import/export
- A configured compact timer popout window
- Popout always-on-top behavior, taskbar visibility control, sizing, positioning, and monitor-bound checks
- Native close handling that hides the popout without altering timer state
- Desktop completion notifications
- Launch-at-startup support
- Main-window maximize and restore controls through the Tauri window API

Custom window commands and lifecycle handling reside in `src-tauri/src/lib.rs`. Tauri plugins provide dialogs, filesystem access, notifications, and autostart support.

## Release identity

- Visible brand: `Shunhen`
- Bundle/display product name: `Shunhen`
- Legacy installation identifiers: retained for upgrade compatibility; see [Windows installer compatibility](../src-tauri/windows/README.md)
- Canonical version source: root `package.json`
- Tauri application identifier: `com.focus.timer`
- Dexie database name: `focus`
- Windows installer format: NSIS

The application identifier and database name are stable V1 identities. They remain unchanged across future installers so upgrades continue to use the existing application identity and local data store.

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

GitHub Release notes and updater metadata use the same UTF-8 Markdown notes file.

Following creation of a signed release build, updater metadata can be generated from the current-version artifact:

```powershell
node tools/generate-updater-manifest.mjs --notes RELEASE_NOTES.md --artifact "src-tauri/target/release/bundle/nsis/Shunhen_<version>_x64-setup.exe" --repository catcredibly/shunhen

gh release create "v<version>" --repo catcredibly/shunhen --notes-file RELEASE_NOTES.md <installer> <installer.sig> <latest.json>
```

The manifest helper reads the authoritative package version and the existing matching `.sig`. It does not build or sign the application, upload release assets, or modify the embedded updater endpoint or public key.

Linux updater metadata can be added to the same output using:

```text
--platform linux-x86_64 --artifact <signed AppImage>
```

together with:

```text
--output <latest.json>
```

Only same-version platform entries are retained, preventing stale signatures from being carried into another release.

Generated manifests, signatures, and bundles are release artifacts rather than repository source files and are excluded from commits.

JSON serialization preserves quotes and line breaks in release notes. The frontend escapes rendered text and supports headings, paragraphs, lists, bold text, inline code, and HTTP(S) links. Raw HTML is not rendered.

## Experimental desktop capabilities

Windows and Linux share a single React application and Tauri project.

Windows-specific window constraints and display-message handling are target-gated. Linux uses GTK's selected backend and monitor signals exposed through Rust capability queries rather than UI-level operating-system checks.

Under X11/XWayland, window placement is available where permitted by the window manager. Under native Wayland, placement is controlled by the compositor. In environments where precise popout positioning is unavailable, Shunhen keeps the popout visible rather than relying on an unplaceable reveal tab.

Global shortcuts depend on backend support and may be unavailable in environments without an appropriate implementation. Existing preferences remain persisted regardless of capability availability.

Real Linux desktop testing is still required for mixed-DPI monitors, docking, autostart, and notifications. The Linux workflow is run manually by the maintainer. Headless checks establish build and source compatibility but do not demonstrate full native desktop parity.

## Platform architecture

Shunhen uses one shared Tauri/React codebase across supported desktop platforms rather than separate Windows and Linux application implementations.

Platform-specific behavior follows a layered architecture:

1. Tauri's cross-platform APIs provide the default implementation where they support the required behavior.
2. Small operating-system-specific differences are handled with narrowly scoped Rust `#[cfg(...)]` branches.
3. Substantial native differences are isolated behind shared interfaces with platform-specific Rust implementations or modules.
4. Where exact parity is unavailable, particularly under Wayland, capability-aware fallbacks preserve usable application behavior.

React and other frontend code remains platform-neutral wherever practical. The frontend requests capabilities such as popout reveal, docking, or work-area detection without depending on the operating-system-specific implementation behind them.

Environment capabilities are preferred over operating-system identity when behavior depends on factors such as display-server support. This avoids spreading checks such as `platform === "linux"` through UI code.

Windows-specific dependencies and imports are target-gated so they are not unnecessarily compiled on Linux. Linux-specific native dependencies are used only where Tauri or other cross-platform APIs do not provide the required functionality.

Existing Windows-native implementations remain unchanged where additional abstraction would provide no practical isolation benefit. Platform abstractions are introduced where native behavior differs substantially enough to justify a shared interface.

Linux support accounts for both X11 and Wayland. Features such as precise positioning or docking may degrade gracefully when they cannot be implemented reliably under the active desktop environment. Such limitations are treated as capability differences rather than application failures.

The resulting platform model consists of:

- one repository
- one shared React application
- one Tauri project
- shared behavior by default
- small `#[cfg]` branches for limited platform differences
- platform modules or adapters for substantial native differences
- capability-based fallbacks where exact parity is unavailable

## Release metadata and branding compatibility

The root `package.json` is the canonical source of the application version. `npm run version:set -- <version>` updates npm and Cargo version metadata together.

Tauri reads the version from `../package.json`. The About interface, backups, and updater manifest use the same package metadata. `npm run version:check` detects version drift and runs before production frontend builds.
