import { LitElement, html, css } from "lit";
import type { PropertyValueMap } from "lit";
import { customElement, property, state, queryAssignedElements, queryAll } from "lit/decorators.js";

const shallowEqual = (arr1: number[], arr2: number[]) =>
    arr1?.length === arr2?.length && arr1.every((val, i) => val === arr2[i]);

/**
 * Configuration object accepted by `addThumb(value, options)`.
 */
export interface AddThumbOptions {
    /** Optional per-thumb minimum override. */
    min?: number;
    /** Optional per-thumb maximum override. */
    max?: number;
    /** Optional name used for form submission. */
    name?: string;
    /** Optional label text. When provided, the input is wrapped in `<label>`. */
    label?: string;
}

/**
 * Polyfill reference implementation for the proposed `<rangegroup>` HTML element.
 *
 * The custom element is registered as `<range-group>` because autonomous custom
 * elements must include a hyphen, while explainer examples use `<rangegroup>` to
 * model potential future native HTML syntax.
 *
 * The component keeps actual `<input type="range">` elements in light DOM so the
 * fallback remains functional and form-friendly. It renders one coordinated visual
 * control in shadow DOM with a styling surface aligned to CSS Forms naming:
 * `slider-track`, `slider-fill`, `slider-thumb`, and additional multi-thumb parts.
 *
 * Public API:
 * - `values`: normalized numeric values for all thumbs.
 * - `inputs`: light-DOM range inputs currently managed by the component.
 * - `getRangeInput(index)`: returns the light-DOM range input at index.
 * - `setRangeValue(index, value)`: programmatically updates one thumb.
 * - `addThumb(value, options)`: appends a new thumb/input pair.
 * - `removeThumb(index)`: removes a thumb/input pair.
 *
 * Events:
 * - `input`: dispatched while values are changing.
 * - `change`: dispatched when an interaction commits a new value.
 *
 * Slots:
 * - default slot: light-DOM `<input type="range">` elements (visually hidden in
 *   shadow render, still part of form and accessibility tree).
 * - `legend` slot: optional `<legend>` used as the group label.
 *
 * Styling API (`::part()`):
 * - `slider-track`
 * - `slider-segment`, `slider-segment-{n}`
 * - `slider-fill` (applied to fill segments between thumbs)
 * - `slider-thumb`, `slider-thumb-{n}`
 * - `slider-ticks`
 * - `slider-tick`, `slider-tick-{n}`
 * - `slider-tick-label`, `slider-tick-label-{n}`
 * - `slider-tick-labels`
 *
 * Host custom properties consumed by this implementation:
 * - `--thumb-size`
 * - `--track-height`
 * - `--slider-thumb-color`
 * - `--slider-track-color`
 * - `--slider-fill-color`
 * - `--slider-segment-color`
 * - `--slider-thumb-ring-color`
 *
 * Part-level custom properties exposed by this implementation:
 * - `--thumb-left` on `slider-thumb-{n}` parts (polyfill proxy for the proposed
 *   CSS Forms `--slider-thumb-position` variable).
 * - `--segment-left` and `--segment-width` on `slider-segment-{n}` parts.
 * - `--anchor-name` can be assigned by consumers and reused for anchored UI.
 *
 * Custom state:
 * - `:state(dragging)` while a pointer drag is active.
 *
 * Accessibility model:
 * - Grouped structure using `fieldset` + projected `legend`.
 * - Individual thumbs expose `role="slider"` with ARIA min/max/now/value text.
 * - Keyboard behavior follows existing range input conventions.
 */
@customElement("range-group")
export class RangeGroup extends LitElement {
    /** Group-level minimum for all thumbs unless a thumb overrides `min`. */
    @property({ type: Number }) min = 0;
    /** Group-level maximum for all thumbs unless a thumb overrides `max`. */
    @property({ type: Number }) max = 100;
    /** Minimum distance that adjacent thumbs must maintain. */
    @property({ type: Number, attribute: "stepbetween" }) stepBetween = 0;
    /** ID reference to a `<datalist>` used for shared snapping and ticks. */
    @property({ type: String }) list = "";
    /** Disables the entire group; reflected so CSS can style disabled state. */
    @property({ type: Boolean, reflect: true }) disabled = false;

    /** Formats `aria-valuetext` for each thumb. */
    @property({ attribute: false })
    valueTextFormatter: (value: number) => string = (value) => String(Math.round(value));

    @state() private _values: number[] = [];
    // used to determine if an event should fire.
    private _previousInputValues: number[] = [];
    private _previousChangeValues: number[] = [];
    @state() private _datalistOptions: { value: string; label: string }[] = [];

    private _inputs: HTMLInputElement[] = [];

    @queryAll(".thumb")
    private _thumbs!: HTMLButtonElement[];

    @queryAssignedElements({ slot: "legend", selector: "legend" })
    private _legendElements!: HTMLLegendElement[];

    private _activeThumbIndex: number | null = null;
    private _containerRect: DOMRect | null = null;
    private _pendingActivation: { indices: number[]; initialX: number } | null = null;
    private _uniqueId = Math.random().toString(36).substring(2, 9);
    private _internals: ElementInternals | null = null;

    constructor() {
        super();
        if (typeof this.attachInternals === "function") {
            this._internals = this.attachInternals();
        }
    }

    /** Current normalized values for all thumbs, ordered left to right. */
    get values(): number[] {
        return this._values;
    }
    /** Live list of light-DOM range inputs managed by the component. */
    get inputs(): HTMLInputElement[] {
        return this._inputs;
    }
    /** Returns the light-DOM range input at `index`, if present. */
    getRangeInput(index: number): HTMLInputElement | undefined {
        return this._inputs[index];
    }
    /** Programmatically sets a thumb value while honoring all constraints. */
    setRangeValue(index: number, value: number) {
        if (this._inputs[index]) {
            this._inputs[index].value = String(this._normalizeValue(value, index));
            this._updateValues();
        }
    }

    /** Adds a new thumb/input pair and dispatches input/change events. */
    addThumb(value: number = (this.min + this.max) / 2, options: AddThumbOptions = {}): HTMLInputElement {
        const input = document.createElement("input");
        input.type = "range";
        input.setAttribute("value", String(value));
        if (options.min !== undefined) input.min = String(options.min);
        if (options.max !== undefined) input.max = String(options.max);
        if (options.name) input.name = options.name;

        let nodeToAppend: HTMLElement = input;
        if (options.label) {
            const label = document.createElement("label");
            label.append(document.createTextNode(`${options.label} `), input);
            nodeToAppend = label;
        }

        this.appendChild(nodeToAppend);
        // Read the freshly assigned inputs synchronously; the async `slotchange`
        // event will run `_onSlotChange` again, which is idempotent.
        this._onSlotChange();
        this._dispatch("input");
        this._dispatch("change");
        return input;
    }

    /** Removes the thumb/input pair at `index` and dispatches input/change events. */
    removeThumb(index: number) {
        const input = this._inputs[index];
        if (!input) return;
        const nodeToRemove =
            input.parentElement instanceof HTMLLabelElement && input.parentElement.parentElement === this
                ? input.parentElement
                : input;
        nodeToRemove.remove();
        this._onSlotChange();
        this._dispatch("input");
        this._dispatch("change");
    }

    private _setDraggingState(isDragging: boolean) {
        if (!this._internals) return;
        if (isDragging) {
            this._internals.states.add("dragging");
            return;
        }
        this._internals.states.delete("dragging");
    }

    private get _isEffectivelyDisabled(): boolean {
        if (this.disabled) return true;
        return this._inputs.length > 0 && this._inputs.every((input) => input.disabled);
    }

    private _isThumbDisabled(index: number): boolean {
        if (this.disabled) return true;
        return this._inputs[index]?.disabled ?? false;
    }

    connectedCallback() {
        super.connectedCallback();
        window.addEventListener("pointermove", this._handlePointerMove);
        window.addEventListener("pointerup", this._handlePointerUp);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        window.removeEventListener("pointermove", this._handlePointerMove);
        window.removeEventListener("pointerup", this._handlePointerUp);
    }

    protected willUpdate(changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        if (changedProperties.has("list")) {
            this._parseDatalist();
        }
    }

    private _onSlotChange() {
        const slot = this.shadowRoot?.querySelector("slot:not([name])");
        // FIX: Check if the slot is an instance of HTMLSlotElement before accessing `assignedElements`.
        if (slot instanceof HTMLSlotElement) {
            const assignedElements = slot.assignedElements({ flatten: true });
            this._inputs = assignedElements.flatMap((el) =>
                el.matches('input[type="range"]')
                    ? [el as HTMLInputElement]
                    : Array.from(el.querySelectorAll('input[type="range"]')),
            );
        }
        this._initializeInputs();
    }

    private _getAccessibleName(input: HTMLInputElement, index: number): string {
        let controlLabel: string | null = null;
        if (input) {
            // 1. aria-labelledby
            const labelledby = input.getAttribute("aria-labelledby");
            if (labelledby) {
                const labelElement = document.getElementById(labelledby);
                controlLabel = labelElement?.textContent?.trim() || null;
            }

            // 2. aria-label
            if (!controlLabel) {
                controlLabel = input.getAttribute("aria-label");
            }

            // 3. Associated <label> element (via `input.labels`)
            if (!controlLabel && input.labels && input.labels.length > 0) {
                controlLabel = input.labels[0].textContent?.trim() || null;
            }

            // 4. Fallback to name attribute
            if (!controlLabel) {
                controlLabel = input.name;
            }
        }

        // 5. Final fallback
        const finalControlLabel = controlLabel || `value ${index + 1}`;

        const legendText = this._legendElements?.[0]?.textContent?.trim();

        if (legendText) {
            return `${legendText}, ${finalControlLabel}`;
        }

        return finalControlLabel;
    }

    private _initializeInputs() {
        if (this._inputs.length === 0) return;

        this._inputs.sort((a, b) => Number(a.getAttribute("value")) - Number(b.getAttribute("value")));

        this._inputs.forEach((input) => {
            if (!input.hasAttribute("min") && this.hasAttribute("min")) {
                input.min = String(this.min);
            }
            if (!input.hasAttribute("max") && this.hasAttribute("max")) {
                input.max = String(this.max);
            }
            const initialValue = input.getAttribute("value");
            if (initialValue !== null) {
                input.value = initialValue;
            }
        });

        this._updateValues();
    }

    private _parseDatalist() {
        if (!this.list) {
            this._datalistOptions = [];
            return;
        }
        const datalist = document.getElementById(this.list);
        if (datalist instanceof HTMLDataListElement) {
            this._datalistOptions = Array.from(datalist.options).map((opt) => ({
                value: opt.value,
                label: opt.label || opt.value,
            }));
        }
    }

    private _updateValues() {
        const newValues = this._inputs.map((input, index) => this._normalizeValue(Number(input.value), index));
        if (!shallowEqual(this._values, newValues)) {
            this._values = newValues;
        }
    }

    private _dispatch(name = "input") {
        let shouldDispatch = true;
        if (name === "change") {
            shouldDispatch = !shallowEqual(this._values, this._previousChangeValues);
            if (shouldDispatch) this._previousChangeValues = [...this._values];
        } else {
            // 'input'
            shouldDispatch = !shallowEqual(this._values, this._previousInputValues);
            if (shouldDispatch) this._previousInputValues = [...this._values];
        }
        if (shouldDispatch) {
            this.dispatchEvent(new Event(name, { bubbles: true, composed: true }));
        }
    }

    private _handleContainerPointerDown(e: PointerEvent) {
        if (e.button !== 0 || this._isEffectivelyDisabled) return;

        this._containerRect = this.shadowRoot?.querySelector(".container")?.getBoundingClientRect() ?? null;
        if (!this._containerRect) return;

        const target = e.target as HTMLElement;
        const isThumb = target.classList.contains("thumb");

        if (isThumb) {
            // --- Thumb click: start a drag operation ---
            const thumbIndex = Array.from(this._thumbs).indexOf(target as HTMLButtonElement);
            if (thumbIndex === -1 || this._isThumbDisabled(thumbIndex)) return;

            const currentValue = this._values[thumbIndex];
            const overlappingIndices = this._values.reduce((acc, v, i) => {
                if (Math.abs(v - currentValue) < 0.001) acc.push(i);
                return acc;
            }, [] as number[]);

            if (overlappingIndices.length > 1) {
                this._pendingActivation = {
                    indices: overlappingIndices,
                    initialX: e.clientX,
                };
                this._activeThumbIndex = null;
            } else {
                this._activeThumbIndex = thumbIndex;
                this._thumbs[thumbIndex]?.focus();
                this._setDraggingState(true);
            }

            // Capture the pointer on the thumb itself
            target.setPointerCapture(e.pointerId);
        } else {
            // --- Track click: move the closest thumb and finish ---
            const percent = Math.max(
                0,
                Math.min(1, (e.clientX - this._containerRect.left) / this._containerRect.width),
            );
            const value = this.min + percent * (this.max - this.min);

            if (this._values.length === 0) return;

            // Find the closest non-disabled thumb to the click position
            const enabledIndices = this._values.map((_, i) => i).filter((i) => !this._isThumbDisabled(i));
            if (enabledIndices.length === 0) return;

            const thumbIndex = enabledIndices.reduce((closestIndex, currentIndex) => {
                const closestDistance = Math.abs(this._values[closestIndex] - value);
                const currentDistance = Math.abs(this._values[currentIndex] - value);
                return currentDistance < closestDistance ? currentIndex : closestIndex;
            }, enabledIndices[0]);

            // Set the new value, dispatch events, and we're done. No drag.
            this.setRangeValue(thumbIndex, value);
            this._dispatch("input");
            this._dispatch("change"); // A track click is a discrete change event
        }
    }

    private _handlePointerMove = (e: PointerEvent) => {
        if (this._pendingActivation) {
            const dx = e.clientX - this._pendingActivation.initialX;
            if (Math.abs(dx) > 2) {
                const direction = dx > 0 ? "right" : "left";
                const indices = this._pendingActivation.indices;
                this._activeThumbIndex = direction === "left" ? Math.min(...indices) : Math.max(...indices);
                this._thumbs[this._activeThumbIndex]?.focus();
                this._pendingActivation = null;
                this._setDraggingState(true);
            }
        }

        if (this._activeThumbIndex === null || !this._containerRect) return;
        e.preventDefault();

        const percent = Math.max(0, Math.min(1, (e.clientX - this._containerRect.left) / this._containerRect.width));
        const value = this.min + percent * (this.max - this.min);

        this.setRangeValue(this._activeThumbIndex, value);
        this._dispatch("input");
    };

    private _handlePointerUp = () => {
        if (this._activeThumbIndex !== null || this._pendingActivation !== null) {
            this._dispatch("change");
        }
        this._setDraggingState(false);
        this._activeThumbIndex = null;
        this._pendingActivation = null;
    };

    private _handleKeyDown(e: KeyboardEvent, index: number) {
        const input = this._inputs[index];
        if (!input || this._isThumbDisabled(index)) return;

        let step = Number(input.step) || 1;
        let newValue = Number(input.value);

        const PAGE_STEP_MULTIPLIER = 10;

        if (this.list && this._datalistOptions.length > 0) {
            const sortedValues = this._datalistOptions.map((opt) => Number(opt.value)).sort((a, b) => a - b);
            const currentIndex = sortedValues.indexOf(newValue);
            if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                newValue = sortedValues[Math.max(0, currentIndex - 1)];
            } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                newValue = sortedValues[Math.min(sortedValues.length - 1, currentIndex + 1)];
            } else if (e.key === "PageDown") {
                newValue = sortedValues[Math.max(0, currentIndex - PAGE_STEP_MULTIPLIER)];
            } else if (e.key === "PageUp") {
                newValue = sortedValues[Math.min(sortedValues.length - 1, currentIndex + PAGE_STEP_MULTIPLIER)];
            }
        } else {
            const bigStep = step * PAGE_STEP_MULTIPLIER;
            if (e.key === "ArrowLeft" || e.key === "ArrowDown") newValue -= step;
            else if (e.key === "ArrowRight" || e.key === "ArrowUp") newValue += step;
            else if (e.key === "PageDown") newValue -= bigStep;
            else if (e.key === "PageUp") newValue += bigStep;
        }

        if (e.key === "Home") newValue = this.min;
        else if (e.key === "End") newValue = this.max;
        else if (!["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp", "PageUp", "PageDown"].includes(e.key)) return;

        e.preventDefault();
        this.setRangeValue(index, newValue);
        this._dispatch("input");
        this._dispatch("change");
    }

    private _snapToDataList(value: number): number {
        if (!this.list || this._datalistOptions.length === 0) return value;
        const validValues = this._datalistOptions.map((opt) => Number(opt.value));
        return validValues.reduce((prev, curr) => (Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev));
    }

    private _normalizeValue(value: number, index: number): number {
        const input = this._inputs[index];
        if (!input) return value;
        let finalValue = value;
        if (this.list && this._datalistOptions.length > 0) {
            finalValue = this._snapToDataList(finalValue);
        }
        const step = this.stepBetween || 0;
        const prevInput = this._inputs[index - 1];
        if (prevInput) {
            const minAllowed = Number(prevInput.value) + step;
            if (finalValue < minAllowed) {
                if (this.list && this._datalistOptions.length > 0) {
                    const sortedValues = this._datalistOptions.map((opt) => Number(opt.value)).sort((a, b) => a - b);
                    finalValue = sortedValues.find((v) => v >= minAllowed) ?? finalValue;
                } else {
                    finalValue = minAllowed;
                }
            }
        }
        const nextInput = this._inputs[index + 1];
        if (nextInput) {
            const maxAllowed = Number(nextInput.value) - step;
            if (finalValue > maxAllowed) {
                if (this.list && this._datalistOptions.length > 0) {
                    const sortedValues = this._datalistOptions.map((opt) => Number(opt.value)).sort((a, b) => a - b);
                    finalValue = [...sortedValues].reverse().find((v) => v <= maxAllowed) ?? finalValue;
                } else {
                    finalValue = maxAllowed;
                }
            }
        }
        const inputMinAttr = input.getAttribute("min");
        const inputMaxAttr = input.getAttribute("max");
        const inputMin = inputMinAttr !== null ? Number(inputMinAttr) : this.min;
        const inputMax = inputMaxAttr !== null ? Number(inputMaxAttr) : this.max;
        const thumbMin = Math.max(this.min, inputMin);
        const thumbMax = Math.min(this.max, inputMax);
        return Math.max(thumbMin, Math.min(thumbMax, finalValue));
    }

    private _valueToPercent(value: number): number {
        if (this.max - this.min === 0) return 0;
        return ((value - this.min) / (this.max - this.min)) * 100;
    }

    render() {
        const segmentPoints = [0, ...this._values.map((v) => this._valueToPercent(v)), 100];

        const legend = this._legendElements?.[0];
        if (legend && !legend.id) {
            legend.id = `rg-legend-${this._uniqueId}`;
        }
        const legendId = legend?.id;
        const effectivelyDisabled = this._isEffectivelyDisabled;

        return html`
            <fieldset class="wrapper" ?disabled=${effectivelyDisabled}>
                <slot name="legend" @slotchange=${this._onSlotChange}></slot>
                <div
                    class="container ${effectivelyDisabled ? "disabled" : ""}"
                    role="group"
                    aria-labelledby=${legendId || ""}
                    aria-disabled=${effectivelyDisabled ? "true" : "false"}
                    @pointerdown=${this._handleContainerPointerDown}
                >
                    <div part="slider-track" class="track">
                        ${segmentPoints.slice(0, -1).map((p, i) => {
                            const left = p;
                            const width = segmentPoints[i + 1] - p;
                            const isFillSegment = i > 0 && i < segmentPoints.length - 2;
                            const partTokens = [
                                "slider-segment",
                                `slider-segment-${i + 1}`,
                                isFillSegment ? "slider-fill" : "",
                            ]
                                .filter(Boolean)
                                .join(" ");
                            return html`<div
                                part=${partTokens}
                                class="segment ${isFillSegment ? "segment-fill" : ""}"
                                style="--segment-left: ${left}%; --segment-width: ${width}%;"
                            ></div>`;
                        })}
                    </div>

                    ${this._datalistOptions.length > 0
                        ? html`
                              <div class="ticks-wrapper" aria-hidden="true">
                                  <div class="tick-marks" part="slider-ticks">
                                      ${this._datalistOptions.map(
                                          (opt, index) => html`
                                              <div
                                                  part="slider-tick slider-tick-${index + 1}"
                                                  class="tick"
                                                  style="--tick-left: ${this._valueToPercent(Number(opt.value))}%"
                                              ></div>
                                          `,
                                      )}
                                  </div>
                                  <div class="tick-labels" part="slider-tick-labels">
                                      ${this._datalistOptions.map(
                                          (opt, index) => html`
                                              <div
                                                  part="slider-tick-label slider-tick-label-${index + 1}"
                                                  class="tick-label"
                                                  style="--tick-left: ${this._valueToPercent(Number(opt.value))}%"
                                              >
                                                  ${opt.label}
                                              </div>
                                          `,
                                      )}
                                  </div>
                              </div>
                          `
                        : ""}
                    ${this._values.map((value, index) => {
                        const thumbDisabled = this._isThumbDisabled(index);
                        return html`
                            <button
                                part="slider-thumb slider-thumb-${index + 1}"
                                class="thumb ${thumbDisabled ? "thumb-disabled" : ""}"
                                style="--thumb-left: ${this._valueToPercent(value)}%; z-index: ${index ===
                                this._activeThumbIndex
                                    ? 12
                                    : 10};"
                                role="slider"
                                aria-label=${this._getAccessibleName(this._inputs[index], index)}
                                aria-valuemin=${this.min}
                                aria-valuemax=${this.max}
                                aria-valuenow=${Math.round(value)}
                                aria-valuetext=${this.valueTextFormatter(value)}
                                aria-disabled=${thumbDisabled ? "true" : "false"}
                                tabindex=${thumbDisabled ? -1 : 0}
                                @keydown=${(e: KeyboardEvent) => this._handleKeyDown(e, index)}
                            ></button>
                        `;
                    })}
                </div>
                <slot @slotchange=${this._onSlotChange} style="display: none;"></slot>
            </fieldset>
        `;
    }

    static styles = css`
        :host {
            display: block;
            position: relative;
            --_thumb-size: var(--thumb-size, 16px);
            --_track-height: var(--track-height, 4px);
            --thumb-bg: var(--slider-thumb-color, #0a84ff);
            --track-bg: var(--slider-track-color, #d8d8de);
            --segment-bg: var(--slider-segment-color, #d8d8de);
            --fill-bg: var(--slider-fill-color, #0a84ff);
            --thumb-ring: var(--slider-thumb-ring-color, #9bc8ff);
            padding-block: calc(var(--_thumb-size) / 2);
        }

        .wrapper {
            border: 0;
            padding: 0;
            margin: 0;
        }

        .container {
            position: relative;
            width: 100%;
            height: var(--_thumb-size);
        }

        .track {
            position: absolute;
            top: 50%;
            left: 0;
            width: 100%;
            height: var(--_track-height);
            transform: translateY(-50%);
            background-color: var(--track-bg);
            border-radius: 999px;
        }

        .segment {
            position: absolute;
            top: 0;
            height: 100%;
            left: var(--segment-left);
            width: var(--segment-width);
            background-color: var(--segment-bg);
        }

        .segment-fill {
            background-color: var(--fill-bg);
        }

        .thumb {
            position: absolute;
            top: 50%;
            left: var(--thumb-left);
            width: var(--_thumb-size);
            height: var(--_thumb-size);
            background-color: var(--thumb-bg);
            border-radius: 50%;
            transform: translate(-50%, -50%);
            cursor: pointer;
            touch-action: none;
            box-shadow:
                0 1px 2px rgba(0, 0, 0, 0.35),
                0 0 0 1px rgba(255, 255, 255, 0.8) inset;
            transition: transform 0.1s ease-in-out;
            border: 1px solid rgba(0, 0, 0, 0.18);
            padding: 0;
        }

        .thumb::before {
            content: "";
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: calc(var(--_thumb-size) + 20px);
            height: calc(var(--_thumb-size) + 20px);
            background: transparent;
            border-radius: 50%;
        }

        .thumb:hover {
            transform: translate(-50%, -50%) scale(1.1);
        }

        .thumb:focus-visible {
            outline: 3px solid var(--thumb-ring);
            outline-offset: 2px;
        }

        .ticks-wrapper {
            position: absolute;
            top: calc(50% + var(--_track-height) / 2 + 4px);
            left: 0;
            right: 0;
            height: 20px;
            pointer-events: none;
        }

        .tick-marks,
        .tick-labels {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
        }

        .tick {
            position: absolute;
            left: var(--tick-left);
            transform: translateX(-50%);
            width: 1px;
            height: 6px;
            background: var(--tick-color, currentColor);
        }

        .tick-label {
            position: absolute;
            top: 10px;
            left: var(--tick-left);
            transform: translateX(-50%);
            font-size: 0.75rem;
            color: var(--tick-label-color, currentColor);
        }

        .container.disabled {
            opacity: 0.4;
            cursor: not-allowed;
            pointer-events: none;
        }

        .thumb-disabled {
            opacity: 0.4;
            cursor: not-allowed;
            pointer-events: none;
        }

        .thumb-disabled:hover {
            transform: translate(-50%, -50%);
        }
    `;
}
