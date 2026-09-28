# Shihen Release Build Guide

Use this process for Windows production releases of Shihen.

## Release version

The current release version used by this guide is:

```text
2.2.3
```

When preparing the next release, use **Ctrl+H** in this file and replace every occurrence of the current release version with the new version.

This updates the version-specific examples in this guide, such as expected installer filenames and manifest checks. Do not use this replacement on historical compatibility references that intentionally refer to an older release.

Then update the actual application version from the repository root:

```powershell
npm run version:set -- 2.2.3
npm run version:check
```

Replace `2.2.3` with the new release version before running the command. `package.json` is authoritative; `version:set` synchronizes the required npm/Cargo metadata and Tauri reads the package version.

Run all commands from the **repository root** unless stated otherwise.

## 1. Prepare the release notes

Create or update:

```text
RELEASE_NOTES.md
```

Place it in the repository root alongside `package.json`:

```text
shihen/
├── RELEASE_NOTES.md
├── package.json
├── tools/
├── src/
└── src-tauri/
```

Write the release notes in normal UTF-8 Markdown.

`RELEASE_NOTES.md` is the single source for:

- the GitHub Release description
- the updater's **What's new** content in `latest.json`

Do **not** manually copy the release notes into `latest.json`.

Use the release-version process above before building. Root `package.json` is authoritative; `npm run version:set -- <version>` synchronizes the required npm/Cargo metadata and Tauri reads that package file. Do not edit historical release notes or compatibility fixtures.

Before publishing the renamed installer, complete the disposable Windows upgrade verification in `src-tauri/windows/README.md`.

---

## 2. Load the updater signing key

In PowerShell:

```powershell
$env:TAURI_SIGNING_PRIVATE_KEY="$HOME\.tauri\focus.key"

$secure = Read-Host "Updater signing key password" -AsSecureString
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD = [System.Net.NetworkCredential]::new("", $secure).Password
```

Use the same PowerShell window for the rest of the build.

Confirm that both environment variables exist without printing their contents:

```powershell
Test-Path Env:TAURI_SIGNING_PRIVATE_KEY
Test-Path Env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

Both should return:

```text
True
True
```

Never commit or share `focus.key` or its password.

---

## 3. Build the Windows release

From the repository root:

```powershell
npm run tauri build
```

The NSIS release files are created under:

```text
src-tauri\target\release\bundle\nsis\
```

For Shihen 2.2.3, expect:

```text
Shihen_2.2.3_x64-setup.exe
Shihen_2.2.3_x64-setup.exe.sig
```

The `.sig` belongs to that exact build.

If you rebuild the installer for any reason, always use the newly generated `.sig` and regenerate `latest.json`.

---

## 4. Generate `latest.json`

Still from the repository root:

```powershell
$version = (Get-Content package.json -Raw | ConvertFrom-Json).version
$installer = "Shihen_${version}_x64-setup.exe"
$dir = "src-tauri\target\release\bundle\nsis"

node tools/generate-updater-manifest.mjs --notes RELEASE_NOTES.md --artifact "$dir\$installer" --repository catcredibly/shihen
```

The helper should:

- read the current version
- read `RELEASE_NOTES.md`
- read the matching installer signature
- generate the updater download URL
- write the release notes into the `notes` field
- emit UTF-8 JSON without a BOM

Do **not** manually edit the generated `latest.json`.

---

## 5. Verify `latest.json`

Check the generated version:

```powershell
$manifest = Get-Content "$dir\latest.json" -Raw | ConvertFrom-Json

$manifest.version
$manifest.notes
```

For this release it should report:

```text
2.2.3

Release Notes:
```

You can also inspect the generated manifest:

```powershell
Get-Content "$dir\latest.json" -Raw |
ConvertFrom-Json |
Format-List
```

Confirm that the version, download URL, signature, and release notes are for the current release.

### Optional BOM check

```powershell
$bytes = [System.IO.File]::ReadAllBytes("$dir\latest.json")
$bytes[0..2]
```

The file should begin with `{` (`123`) and must **not** begin with the UTF-8 BOM:

```text
239
187
191
```

---

## 6. Create the GitHub Release

Create a GitHub release using the same `RELEASE_NOTES.md`.

If using GitHub CLI:

```powershell
gh release create "v$version" `
  "$dir\$installer" `
  "$dir\$installer.sig" `
  "$dir\latest.json" `
  --repo catcredibly/shihen `
  --title "Shihen $version" `
  --notes-file RELEASE_NOTES.md
```

This creates the release and uploads:

```text
Shihen_<version>_x64-setup.exe
Shihen_<version>_x64-setup.exe.sig
latest.json
```

GitHub automatically provides the source `.zip` and `.tar.gz` archives.

If you create the release manually through GitHub instead, use the contents of `RELEASE_NOTES.md` as the release description and upload the same three files.

---

## 7. Final release check

After publishing, confirm that the GitHub Release contains:

```text
Shihen_<version>_x64-setup.exe
Shihen_<version>_x64-setup.exe.sig
latest.json
```

Also confirm:

- the GitHub Release notes match `RELEASE_NOTES.md`
- `latest.json` contains the same release notes
- `latest.json` points to the correct release installer
- the version is correct
- the installer and `.sig` are from the same build

Do not regenerate or modify any of these files after publishing without replacing the corresponding release assets together.
