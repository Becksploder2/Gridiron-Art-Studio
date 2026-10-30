# Gridiron Art Studio

A standalone desktop AI design workshop for **CFB 27**, **Madden**, and **Axis Football 27**.

Generate original football franchise logos, endzone lettering, helmet stripes, and jersey/pants graphics using ordinary English prompts. **Endzone artwork is art only — no field or turf.**

## Features (initial build)
- Native Electron desktop window (not a browser-based UI)
- AI image creation through the OpenAI Images API (model `gpt-image-1.5`)
- Reference image import, revision of generated designs, and transparent PNG save
- Four category-specific generation prompts and three game profiles
- Private API-key entry and OS-encrypted local storage where supported
- Windows installer/portable EXE and macOS DMG/ZIP builds through GitHub Actions

## Install
Download the Windows or macOS build artifact from the latest successful [Actions run](../../actions/workflows/build.yml). These are currently **unsigned test builds** and may show operating-system warnings. On first launch, open **API Settings** and enter an [OpenAI API key](https://platform.openai.com/api-keys). API usage is billed separately from a ChatGPT subscription.

## Developer
```bash
npm install
npm start
```

Build: `npm run dist:win` on Windows or `npm run dist:mac` on macOS.

## Important limitations
- The AI service requires internet access, an API key, and available API billing/permissions.
- The app does **not** modify games or inject assets. Exported PNGs may require further adjustments to meet individual game or mod-tool import specifications; game-specific presets are planned.
- AI-generated typography, exact striping geometry, and transparency may need revision. Verify saved images before importing.
- This is an initial working implementation, not yet tested across all target games.
- Never commit API keys or generated secret settings to GitHub.
