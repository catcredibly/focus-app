# Windows installer compatibility

`installer.nsi` is the Tauri CLI 2.11.5 NSIS template, with a narrow compatibility patch. Upstream: https://github.com/tauri-apps/tauri/blob/tauri-cli-v2.11.5/crates/tauri-bundler/src/bundle/windows/nsis/installer.nsi

Shunhen remains the same installed application. Keep the uninstall key `Software\Microsoft\Windows\CurrentVersion\Uninstall\Focus`, the installation-location key `Software\focus\Focus`, the existing Focus installation folder, `focus.exe`, and `com.focus.timer`. The visible product and shortcut names are Shunhen. Existing owned Start Menu/Desktop links are renamed before update-mode shortcut handling; unrelated shortcuts are not touched. Autostart retains its original Focus key/file name.

The full template is needed because Tauri does not offer configuration overrides for these registry constants. When upgrading the CLI, compare with its upstream template and retain these small changes. The remaining installer, updater, signing, and uninstall logic is upstream.

Release gate (requires a disposable Windows environment): install the original signed Focus 2.2.0, populate each data category, enable startup, update through its existing endpoint to a signed Shunhen build, and check the same install folder, one uninstall entry, renamed shortcuts, data continuity, subsequent updates, and clean uninstall. Never run this destructive install/uninstall verification against a user's live study data. Source checks and compiling an installer do not prove that real upgrade path.

Shunhen also upgrades existing Shihen installations through the same keys and endpoint. Both legacy Focus and Shihen shortcut names are migrated only when their targets belong to this installation. Validate the Shihen-to-Shunhen update in the same disposable environment. Linux Debian packages declare that they replace, conflict with, and provide both prior package names (`focus` and `shihen`).

The custom template includes `Win\RestartManager.nsh` because newer Tauri bundler helpers call its Restart Manager macros when checking running applications. NSIS supplies this header; omitting the include causes `RestartManager_StartSession` macro-not-found errors during installer compilation. Keep this include when updating the vendored template.
