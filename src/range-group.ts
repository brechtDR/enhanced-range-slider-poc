import { LitElement, html, css, PropertyValueMap } from "lit";
import {
    customElement,
    property,
    state,
    queryAssignedElements,
    queryAll,
} from "lit/decorators.js";

const shallowEqual = (arr1: number[], arr2: number[]) =>
    arr1?.length === arr2?.length && arr1.every((val, i) => val === arr2[i]);

@customElement("range-group")
export class RangeGroup extends LitElement {
    @property({ type: Number }) min = 0;
    @property({ type: Number }) max = 100;
    @property({ type: Number, attribute: "stepbetween" }) stepBetween = 0;
    @property({ type: String }) list = "";

    @property({ attribute: false })
    valueTextFormatter: (value: number) => string = (value) => String(Math.round(value));

    @state() private _values: number[] = [];
    // used to determine if an event should fire.
    private _previousInputValues: number[] = [];
    private _previousChangeValues: number[] = [];
    @state() private _datalistOptions: { value: string; label: string }[] = [];

    @queryAssignedElements({ selector: 'input[type="range"]' })
    private _inputs!: HTMLInputElement[];

    @queryAll(".thumb")
    private _thumbs!: HTMLButtonElement[];

    @queryAssignedElements({ slot: "legend", selector: "legend" })
    private _legendElements!: HTMLLegendElement[];

    private _activeThumbIndex: number | null = null;
    private _containerRect: DOMRect | null = null;
    private _pendingActivation: { indices: number[]; initialX: number } | null =
        null;
    private _uniqueId = Math.random().toString(36).substring(2, 9);

    // Public API
    get values(): number[] {
        return this._values;
    }
    get inputs(): HTMLInputElement[] {
        return this._inputs;
    }
    getRangeInput(index: number): HTMLInputElement | undefined {
        return this._inputs[index];
    }
    setRangeValue(index: number, value: number) {
        if (this._inputs[index]) {
            this._inputs[index].value = String(this._normalizeValue(value, index));
            this._updateValues();
        }
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

    protected willUpdate(
        changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>,
    ): void {
        if (changedProperties.has("list")) {
            this._parseDatalist();
        }
    }

    private _onSlotChange() {
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

            // 3. <label for="...">
            if (!controlLabel && input.id) {
                const label = document.querySelector<HTMLLabelElement>(
                    `label[for="${input.id}"]`,
                );
                controlLabel = label?.textContent?.trim() || null;
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

        this._inputs.sort(
            (a, b) =>
                Number(a.getAttribute("value")) - Number(b.getAttribute("value")),
        );

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
        const newValues = this._inputs.map((input, index) =>
            this._normalizeValue(Number(input.value), index),
        );
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
        if (e.button !== 0) return;

        this._containerRect =
            this.shadowRoot?.querySelector(".container")?.getBoundingClientRect() ??
            null;
        if (!this._containerRect) return;

        const target = e.target as HTMLElement;
        const isThumb = target.classList.contains("thumb");

        if (isThumb) {
            // --- Thumb click: start a drag operation ---
            const thumbIndex = Array.from(this._thumbs).indexOf(
                target as HTMLButtonElement,
            );
            if (thumbIndex === -1) return;

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
            }

            // Capture the pointer on the thumb itself
            target.setPointerCapture(e.pointerId);
        } else {
            // --- Track click: move the closest thumb and finish ---
            const percent = Math.max(
                0,
                Math.min(
                    1,
                    (e.clientX - this._containerRect.left) / this._containerRect.width,
                ),
            );
            const value = this.min + percent * (this.max - this.min);

            if (this._values.length === 0) return;

            // Find the closest thumb to the click position
            const thumbIndex = this._values.reduce(
                (closestIndex, currentValue, currentIndex) => {
                    const closestDistance = Math.abs(
                        this._values[closestIndex] - value,
                    );
                    const currentDistance = Math.abs(currentValue - value);
                    return currentDistance < closestDistance ? currentIndex : closestIndex;
                },
                0,
            );

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
                this._activeThumbIndex =
                    direction === "left" ? Math.min(...indices) : Math.max(...indices);
                this._thumbs[this._activeThumbIndex]?.focus();
                this._pendingActivation = null;
            }
        }

        if (this._activeThumbIndex === null || !this._containerRect) return;
        e.preventDefault();

        const percent = Math.max(
            0,
            Math.min(
                1,
                (e.clientX - this._containerRect.left) / this._containerRect.width,
            ),
        );
        const value = this.min + percent * (this.max - this.min);

        this.setRangeValue(this._activeThumbIndex, value);
        this._dispatch("input");
    };

    private _handlePointerUp = () => {
        if (this._activeThumbIndex !== null || this._pendingActivation !== null) {
            this._dispatch("change");
        }
        this._activeThumbIndex = null;
        this._pendingActivation = null;
    };

    private _handleKeyDown(e: KeyboardEvent, index: number) {
        const input = this._inputs[index];
        if (!input) return;

        let step = Number(input.step) || 1;
        let newValue = Number(input.value);

        if (this.list && this._datalistOptions.length > 0) {
            const sortedValues = this._datalistOptions
                .map((opt) => Number(opt.value))
                .sort((a, b) => a - b);
            const currentIndex = sortedValues.indexOf(newValue);
            if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                newValue = sortedValues[Math.max(0, currentIndex - 1)];
            } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                newValue =
                    sortedValues[Math.min(sortedValues.length - 1, currentIndex + 1)];
            }
        } else {
            if (e.key === "ArrowLeft" || e.key === "ArrowDown") newValue -= step;
            else if (e.key === "ArrowRight" || e.key === "ArrowUp") newValue += step;
        }

        if (e.key === "Home") newValue = this.min;
        else if (e.key === "End") newValue = this.max;
        else if (
            !["ArrowLeft", "ArrowDown", "ArrowRight", "ArrowUp"].includes(e.key)
        )
            return;

        e.preventDefault();
        this.setRangeValue(index, newValue);
        this._dispatch("input");
        this._dispatch("change");
    }

    private _snapToDataList(value: number): number {
        if (!this.list || this._datalistOptions.length === 0) return value;
        const validValues = this._datalistOptions.map((opt) => Number(opt.value));
        return validValues.reduce((prev, curr) =>
            Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev,
        );
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
        const inputMinAttr = input.getAttribute('min');
        const inputMaxAttr = input.getAttribute('max');
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
        const segmentPoints = [
            0,
            ...this._values.map((v) => this._valueToPercent(v)),
            100,
        ];

        const legend = this._legendElements?.[0];
        if (legend && !legend.id) {
            legend.id = `rg-legend-${this._uniqueId}`;
        }
        const legendId = legend?.id;

        return html`
            <fieldset class="wrapper">
                <slot name="legend" @slotchange=${this._onSlotChange}></slot>
                <div
                        class="container"
                        role="group"
                        aria-labelledby=${legendId || ""}
                        @pointerdown=${this._handleContainerPointerDown}
                >
                    <div part="slider-track" class="track">
                        ${segmentPoints.slice(0, -1).map((p, i) => {
                            const left = p;
                            const width = segmentPoints[i + 1] - p;
                            return html`<div
                                    part="slider-segment slider-segment-${i + 1}"
                                    class="segment"
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
                                                            style="--tick-left: ${this._valueToPercent(
                                                                    Number(opt.value),
                                                            )}%"
                                                    ></div>
                                                `,
                                        )}
                                    </div>
                                    <div class="tick-labels" part="slider-tick-labels">
                                        ${this._datalistOptions.map(
                                                (opt, index) => html`
                                                    <div
                                                            part="slider-tick-label slider-tick-label-${index +
                                                            1}"
                                                            class="tick-label"
                                                            style="--tick-left: ${this._valueToPercent(
                                                                    Number(opt.value),
                                                            )}%"
                                                    >
                                                        ${opt.label}
                                                    </div>
                                                `,
                                        )}
                                    </div>
                                </div>
                            `
                            : ""}
                    ${this._values.map(
                            (value, index) => html`
                                <button
                                        part="slider-thumb slider-thumb-${index + 1}"
                                        class="thumb"
                                        style="--thumb-left: ${this._valueToPercent(
                                                value,
                                        )}%; z-index: ${index === this._activeThumbIndex ? 12 : 10};"
                                        role="slider"
                                        aria-label=${this._getAccessibleName(
                                                this._inputs[index],
                                                index,
                                        )}
                                        aria-valuemin=${this.min}
                                        aria-valuemax=${this.max}
                                        aria-valuenow=${Math.round(value)}
                                        aria-valuetext=${this.valueTextFormatter(value)}
                                        @keydown=${(e: KeyboardEvent) =>
                                                this._handleKeyDown(e, index)}
                                ></button>
                            `,
                    )}
                </div>
                <slot @slotchange=${this._onSlotChange} style="display: none;"></slot>
            </fieldset>
        `;
    }

    static styles = css`
        :host {
            display: block;
            position: relative;
            --_thumb-size: var(--thumb-size, 24px);
            --_track-height: var(--track-height, 6px);
            --thumb-bg: #007bff; /* Default thumb background */
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
            background-color: #ccc;
        }

        .segment {
            position: absolute;
            top: 0;
            height: 100%;
            left: var(--segment-left);
            width: var(--segment-width);
            background-color: #999;
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
            box-shadow: 0 0 8px 0 var(--thumb-bg);
            transition: transform 0.1s ease-in-out;
            border: none;
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
            outline: 2px solid var(--thumb-bg);
            outline-offset: 4px;
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
    `;
}
