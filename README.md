# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      ...tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      ...tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      ...tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Tailwind CSS v4

This project uses Tailwind CSS v4 with PostCSS. Styles are processed through Vite's explicit PostCSS config in `vite.config.ts` and the Tailwind config lives in `tailwind.config.ts` (ESM). If the UI appears unstyled, restart the dev server so Vite picks up PostCSS and ensure dependencies are installed.
You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Testing

Playwright smoke tests validate core UI flows (sidebar toggle, tab switching, visualizer selection, timeline scrub, volume change).

Install browsers then run tests:

```
npm run test:install
npm test
```

Open interactive UI mode:

```
npm run test:ui
```

## Visualization Plug‑in System (WMP-Style)

This project includes a modular music visualization architecture inspired by Windows Media Player's visualization DLL workflow. Each visualization is a self-contained plug‑in living under `src/plugins/<pluginId>/plugin.ts` and exporting a factory `createPlugin()` that returns an object implementing `IVisualizationPlugin`.

### Core Concepts

- `VisualizationManager` dynamically discovers plug‑ins via `import.meta.glob('../plugins/*/plugin.ts')`.
- Each plug‑in declares metadata (`meta`) plus lifecycle methods analogous to COM objects:
  - `initialize(graphicsContext)` – prepare scene / resources.
  - `renderFrame(audioFrame)` – draw one frame given audio analysis.
  - `resize?(w,h,dpr)` – optional resize handling.
  - `shutdown()` – cleanup GPU/DOM resources.
- Graphics contexts: Three.js (`kind: 'three'`) or Canvas2D (`kind: 'canvas2d'`). A plug‑in chooses its kind via `meta.kind` and the manager provisions the appropriate context.

### Audio Frame Data
`VisualizationAudioFrame` delivers synchronized analysis each frame:
```
{
  time, dt, bpm, beat, beatProgress,
  bands: { low, mid, high },
  fft: Float32Array,           // normalized frequency magnitudes
  waveform: Float32Array,      // time-domain samples
  amplitude                    // overall loudness
}
```

### Usage Example
```ts
import { VisualizationManager } from './visualization'

const container = document.getElementById('viz-container')!
const manager = new VisualizationManager({ container })
await manager.discover()            // enumerate available plug‑ins
await manager.loadPlugin('musicalColors')

// On each audio analysis tick (e.g., from Web Audio / Spotify SDK):
manager.submitAudioFrame({
  bpm: 122,
  beat: isBeat,
  beatProgress: beatPhase,
  bands: { low, mid, high },
  fft, waveform, amplitude
})
```
The internal render loop owns `time` and `dt`; feed new audio data as it arrives.

### Adding a New Plug‑in
1. Create folder: `src/plugins/myVisualizer/`.
2. Add `plugin.ts` exporting `createPlugin()` that returns an object implementing `IVisualizationPlugin`.
3. Set `meta.kind` to `'three'` or `'canvas2d'`.
4. (Optional) Extend `manifest.json` for documentation / external discovery.
5. The manager will pick it up automatically on next refresh.

### Sample Plug‑in Included
`musicalColors` – Three.js shapes whose colors & transforms react to bass/mid/high bands, amplitude, and beat pulses.

### Hot Swapping
Call `loadPlugin('otherId')` to hot‑swap without reloading the page. The manager shuts down the previous plug‑in and mounts the new one, preserving the container element.

### Extensibility Ideas
- Add a worker-based FFT fallback if upstream analysis missing.
- Provide a capability negotiation layer (e.g., a plug‑in requests `fft|beat`; manager downgrades if unavailable).
- Implement screenshot / recording hooks (WebGL readPixels, WebCodecs).
- Add settings injection (`setPluginConfig(pluginId, config)`).

See `src/visualization/` and `src/plugins/musicalColors/` for reference implementations.

