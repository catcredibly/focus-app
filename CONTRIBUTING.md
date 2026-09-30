# Contributing to Shunhen

Contributions are welcome and always appreciated.

## Before you start

- For bugs or feature ideas, open an issue first when practical.
- Create changes on a separate branch and submit them through a pull request to `main`.
- Keep changes focused and avoid unrelated refactors.

## Development

Before submitting a pull request, run:

```powershell
npm ci
npm run format:check
npm run typecheck
npm test
npm run build
cargo check --locked --all-targets --manifest-path src-tauri/Cargo.toml
```

New or changed user-facing text should include translations for English, Simplified Chinese, Traditional Chinese, and Japanese.

Do not commit build output, installers, signing keys, credentials, or personal backup files.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
