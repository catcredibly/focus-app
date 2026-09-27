<p align="center">
  <img src="src/assets/focus-logo-orange.png" alt="Shihen leaf logo" width="112" />
</p>

# Shihen

**Time well spent.**

Shihen is a desktop focus timer and study tracker. It combines a clean countdown with Subjects, Academic Years, history, study goals, and long-term analytics without requiring a Shihen account or cloud service.

## Features

- Focus timer with pause, extend, recovery, notes, and completion notifications
- Compact always-on-top timer popout with corner docking and auto-hide features
- Subjects grouped into Academic Years
- Searchable, editable Session history
- Daily and weekly study goals
- Analytics for trends, streaks, Subjects, Academic Years, and study patterns
- Dark and light themes with six accent colours
- English, Simplified Chinese, Traditional Chinese, and Japanese interfaces
- Full JSON backup/restore and CSV Session import/export

## Privacy

Shihen is local-first. Academic Years, Subjects, Sessions, settings, and notes are stored in IndexedDB on the device where Shihen runs.
The application does not upload study data to a Shihen account or bundled cloud service.

Export regular backups if the data matters to you.
Removing the application or its WebView storage may remove local data.

## Availability

Shihen is available for Windows and Linux on x86-64 systems.

Linux releases are provided as AppImage and Debian (`.deb`) packages and are currently experimental.
Please note some platform-specific features may behave differently or be unavailable on Linux.
Support for additional platforms may be considered in the future.

## Development

### Prerequisites

- Node.js LTS and npm
- Rust stable with the MSVC toolchain
- Visual Studio Build Tools with Desktop development with C++ and a Windows SDK
- Microsoft Edge WebView2 Runtime

### Setup

```powershell
npm ci
npm run tauri dev
```

### Checks

```powershell
npm run typecheck
npm test
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
```

### Windows installer

```powershell
npm run tauri build
```

Set release metadata with `npm run version:set -- <version>`. The root package version drives Tauri and is checked before production builds. See [installer compatibility](src-tauri/windows/README.md) for the Focus-to-Shihen upgrade verification.

Generated installers and executables belong outside source control.

## Technology

- Tauri 2 and Rust
- React and TypeScript
- Vite
- Dexie and IndexedDB
- Recharts

See [Architecture](docs/ARCHITECTURE.md) for implementation details and [release packaging](docs/ARCHITECTURE.md#release-notes-and-updater-metadata) for the release workflow.

## Security

Never commit personal Shihen backups, signing keys, certificates, or credentials. See [SECURITY.md](SECURITY.md) for reporting and handling guidance.

## License

Shihen is available under the [MIT License](LICENSE).
