# Range Group Web Component

## ⚠️ Disclaimer: Proof-of-Concept

This component is a **proof-of-concept** and a technical demonstration. It is built to explore the ideas proposed in the **[Open UI Community Group's Enhanced Range Input Explainer](https://open-ui.org/components/enhanced-range-input.explainer/)**.

**It is NOT production-ready and should not be used in production applications.** The API is subject to change, and it has not been tested for robustness, cross-browser compatibility, or performance at scale. Its primary purpose is for experimentation and discussion around the future of web standards.

---

A highly customizable, multi-handle range slider web component built with [Lit](https://lit.dev/). This component is inspired by the WICG `<rangegroup>` proposal and provides a flexible foundation for creating complex range selection UIs.

The demo site is built with [Astro](https://astro.build/) and published as static files to GitHub Pages.

## Features

- **Multiple Handles**: Use any number of handles on a single track.
- **Datalist Integration**: Automatically displays tick marks and labels from a `<datalist>` element.
- **`stepbetween`**: Enforces a minimum distance between adjacent handles.
- **Easy Styling**: Uses CSS Shadow Parts (`::part`) for extensive styling of the track, segments, and thumbs.
- **Rich JavaScript API**: Programmatically get and set values.
- **Accessibility**: Implements ARIA roles and attributes for keyboard and screen reader support.
- **Touch Friendly**: Optimized for a smooth experience on mobile devices.

## Demo

The demo lives in `src/pages/index.astro` and showcases various configurations.

---

## Local Development

To run the demo page locally and start developing, follow these steps:

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```

2.  **Install dependencies:**
    ```bash
    pnpm install
    ```

3.  **Start the development server:**
    ```bash
    pnpm dev
    ```
    This will open a local server, typically at `http://localhost:4321`.

4.  **Build for production:**
    ```bash
    pnpm build
    ```
    This command builds the static demo site into the `/dist` folder, ready for GitHub Pages deployment.

---

## Usage

Once published to NPM, you can use it in your project like any other package.

```bash
npm install range-group-component
```

```html
<script type="module" src="/node_modules/range-group-component/dist/range-group.js"></script>

<range-group min="0" max="1000">
    <input type="range" value="250">
    <input type="range" value="750">
</range-group>
```

---

## API Reference

### Attributes / Properties

| Attribute     | Property      | Type     | Default | Description                                             |
|---------------|---------------|----------|---------|---------------------------------------------------------|
| `min`         | `min`         | `Number` | `0`     | The minimum allowed value for the range.                |
| `max`         | `max`         | `Number` | `100`   | The maximum allowed value for the range.                |
| `stepbetween` | `stepbetween` | `Number` | `0`     | The minimum gap required between any two adjacent thumbs. |
| `list`        | `list`        | `String` | `''`    | The `id` of a `<datalist>` to associate with the range.   |


### Public Properties (Read-only)

| Property | Type                 | Description                                    |
|----------|----------------------|------------------------------------------------|
| `values` | `number[]`           | Returns an array of the current numeric values.  |
| `inputs` | `HTMLInputElement[]` | Returns an array of the slotted `<input>` elements. |

### Public Methods

- **`getRangeInput(index: number): HTMLInputElement | undefined`**
  - Returns the slotted `<input type="range">` element at the specified index.

- **`setRangeValue(index: number, value: number)`**
  - Programmatically sets the value of the handle at the specified index.

- **`addThumb(value?: number, options?: { min?: number; max?: number; name?: string; label?: string }): HTMLInputElement`**
  - Adds a new handle (a real `<input type="range">`) at the given value and returns it. Because handles are backed by slotted inputs, this is a convenience over creating and appending an input yourself.

- **`removeThumb(index: number)`**
  - Removes the handle (and its backing `<input>`) at the specified index.

### Events

- **`change`**
  - Fires when any of the handle values change. The new values can be accessed from the `event.detail.values` property.

### Styling with CSS Parts

You can style the component from outside its shadow DOM using the `::part()` pseudo-element.

| Part Name         | Description                                        |
|-------------------|----------------------------------------------------|
| `track`           | The main track element.                            |
| `segment`         | Styles all segments between and outside thumbs.    |
| `segment-{n}`     | Styles an individual segment (e.g., `segment-1`).  |
| `thumb`           | Styles all thumb (handle) elements.                |
| `thumb-{n}`       | Styles an individual thumb (e.g., `thumb-1`).      |
| `ticks`           | The container for all tick marks.                  |
| `tick`            | Styles all tick marks.                             |
| `tick-{n}`        | Styles an individual tick mark (e.g., `tick-1`).   |
| `tick-labels`     | The container for all tick mark labels.            |
| `tick-label`      | Styles all tick mark labels.                       |
| `tick-label-{n}`  | Styles an individual tick label (e.g., `tick-label-1`). |

**Example:**
```css
range-group::part(track) {
  background-color: #e5e7eb;
}

/* Style the third tick mark */
range-group::part(tick-3) {
  background-color: dodgerblue;
  height: 12px;
}

range-group::part(thumb) {
  border: 2px solid white;
}

range-group::part(segment-2) {
  background-color: steelblue;
}
```

### Custom track shapes (no component changes)

Each thumb exposes its position along the track as an inline `--thumb-left` custom property (the proposed standardized name is `--slider-thumb-position`), and each segment exposes `--segment-left` / `--segment-width`. Opt-in CSS can use these with `offset-path` to lay thumbs out along any path — a wave, an arc, or a full circle — without touching the component. The `wavy-track` and `circular-track` examples demonstrate this.

```css
range-group::part(slider-thumb) {
  offset-path: path("M0,40 Q40,15 80,40 T160,40 T240,40 T320,40");
  offset-distance: var(--thumb-left);
}
```

---
