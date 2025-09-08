import { LitElement, html, css, PropertyValueMap } from "lit";
import { customElement, property, state, queryAssignedElements } from "lit/decorators.js";

@customElement("range-group")
export class RangeGroup extends LitElement {
    @property({ type: Number }) min: number;
    @property({ type: Number }) max: number;
    @property({ type: Number }) stepbetween: number;
    @property({ type: String }) list: string;

    @state() private _values: number[];
    @state() private _datalistOptions: { value: string; label: string }[];

    @queryAssignedElements({ selector: 'input[type="range"]' })
    private _inputs!: HTMLInputElement[];

    @queryAssignedElements({ slot: "legend", selector: "legend" })
    private _legendElements!: HTMLLegendElement[];

    private _activeThumbIndex: number | null = null;
    private _containerRect: DOMRect | null = null;
    private _uniqueId = Math.random().toString(36).substring(2, 9);

    constructor() {
        super();
        this.min = 0;
        this.max = 100;
        this.stepbetween = 0;
        this.list = "";
        this._values = [];
        this._datalistOptions = [];
    }

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
            this._handleInputChange();
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

    protected firstUpdated(_changedProperties: PropertyValueMap<any> | Map<PropertyKey, unknown>): void {
        this._initializeInputs();
        this._parseDatalist();
        this.requestUpdate(); // Request update to process legend
    }

    private _onSlotChange() {
        this._initializeInputs();
        this.requestUpdate();
    }

    private _getAccessibleName(input: HTMLInputElement, index: number): string {
        if (!input) return `value ${index + 1}`;

        // 1. aria-labelledby
        const labelledby = input.getAttribute("aria-labelledby");
        if (labelledby) {
            const labelElement = document.getElementById(labelledby);
            if (labelElement) return labelElement.textContent?.trim() || "";
        }

        // 2. aria-label
        const ariaLabel = input.getAttribute("aria-label");
        if (ariaLabel) return ariaLabel;

        // 3. <label for="...">
        if (input.id) {
            // querySelector in the root document, as labels can be anywhere
            const label = document.querySelector<HTMLLabelElement>(`label[for="${input.id}"]`);
            if (label) return label.textContent?.trim() || "";
        }

        // 4. Fallback to name attribute
        if (input.name) return input.name;

        // 5. Final fallback
        return `value ${index + 1}`;
    }

    private _initializeInputs() {
        if (this._inputs.length === 0) return;

        this._inputs.forEach((input) => {
            if (this.hasAttribute("min")) input.min = String(this.min);
            if (this.hasAttribute("max")) input.max = String(this.max);
        });

        const initialValues = this._inputs.map((input) => Number(input.getAttribute("value")));
        initialValues.sort((a, b) => a - b);

        this._inputs.forEach((input, index) => {
            input.value = String(initialValues[index]);

            input.removeEventListener("input", this._handleInputChange);
            input.removeEventListener("change", this._handleInputChange);
            input.addEventListener("input", this._handleInputChange);
            input.addEventListener("change", this._handleInputChange);
        });

        this._handleInputChange();
    }

    private _parseDatalist() {
        if (!this.list) return;
        const datalist = document.getElementById(this.list);
        if (datalist instanceof HTMLDataListElement) {
            this._datalistOptions = Array.from(datalist.options).map((opt) => ({
                value: opt.value,
                label: opt.label || opt.value,
            }));
        }
    }

    private _handleInputChange = () => {
        this._values = this._inputs.map((input, index) => this._normalizeValue(Number(input.value), index));
        this.dispatchEvent(new CustomEvent("change", { detail: { values: this._values } }));
        this.requestUpdate();
    };

    private _handlePointerDown(e: PointerEvent, index: number) {
        if (e.button !== 0) return; // Only main button
        e.preventDefault();
        (e.target as HTMLElement).focus();
        this._activeThumbIndex = index;
        this._containerRect = this.shadowRoot?.querySelector(".container")?.getBoundingClientRect() ?? null;
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }

    private _handlePointerMove = (e: PointerEvent) => {
        if (this._activeThumbIndex === null || !this._containerRect) return;
        e.preventDefault();

        const percent = Math.max(0, Math.min(1, (e.clientX - this._containerRect.left) / this._containerRect.width));
        const value = this.min + percent * (this.max - this.min);

        this.setRangeValue(this._activeThumbIndex, value);
    };

    private _handlePointerUp = (e: PointerEvent) => {
        if (this._activeThumbIndex === null) return;
        e.preventDefault();
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
        this._activeThumbIndex = null;
        this._containerRect = null;
    };

    private _handleKeyDown(e: KeyboardEvent, index: number) {
        const input = this._inputs[index];
        if (!input) return;

        let step = Number(input.step) || 1;
        let newValue = Number(input.value);

        // If using a datalist, step becomes the next/previous option
        if (this.list && this._datalistOptions.length > 0) {
            const sortedValues = this._datalistOptions.map((opt) => Number(opt.value)).sort((a, b) => a - b);
            const currentIndex = sortedValues.indexOf(newValue);

            if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                newValue = sortedValues[Math.max(0, currentIndex - 1)];
            } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                newValue = sortedValues[Math.min(sortedValues.length - 1, currentIndex + 1)];
            }
        } else {
            if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
                newValue -= step;
            } else if (e.key === "ArrowRight" || e.key === "ArrowUp") {
                newValue += step;
            }
        }

        if (e.key === "Home") {
            newValue = this.min;
        } else if (e.key === "End") {
            newValue = this.max;
        } else if (e.key !== "ArrowLeft" && e.key !== "ArrowDown" && e.key !== "ArrowRight" && e.key !== "ArrowUp") {
            return;
        }

        e.preventDefault();
        this.setRangeValue(index, newValue);
    }

    private _snapToDataList(value: number): number {
        if (!this.list || !this._datalistOptions || this._datalistOptions.length === 0) {
            return value;
        }

        const validValues = this._datalistOptions.map((opt) => Number(opt.value));

        // Find the closest value in the datalist
        const closest = validValues.reduce((prev, curr) => {
            return Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev;
        });

        return closest;
    }

    private _normalizeValue(value: number, index: number): number {
        const input = this._inputs[index];
        if (!input) return value;

        let targetValue = value;

        // Snap to datalist first if it exists
        if (this.list && this._datalistOptions.length > 0) {
            targetValue = this._snapToDataList(targetValue);
        }

        const minVal = Number(input.min);
        const maxVal = Number(input.max);

        let finalValue = Math.max(minVal, Math.min(maxVal, targetValue));

        const step = this.stepbetween || 0;

        // Check against previous handle
        const prevInput = this._inputs[index - 1];
        if (prevInput) {
            const minAllowed = Number(prevInput.value) + step;
            if (finalValue < minAllowed) {
                // If datalist exists, find the next valid option. Otherwise, just use the calculated min.
                if (this.list && this._datalistOptions.length > 0) {
                    const sortedValues = this._datalistOptions.map((opt) => Number(opt.value)).sort((a, b) => a - b);
                    finalValue = sortedValues.find((v) => v >= minAllowed) ?? finalValue;
                } else {
                    finalValue = minAllowed;
                }
            }
        }

        // Check against next handle
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

        // Re-clamp (to ensure we didn't go out of bounds)
        return Math.max(minVal, Math.min(maxVal, finalValue));
    }

    private _valueToPercent(value: number): number {
        return ((value - this.min) / (this.max - this.min)) * 100;
    }

    render() {
        const segmentPoints = [0, ...[...this._values].map((v) => this._valueToPercent(v)).sort((a, b) => a - b), 100];

        const legend = this._legendElements?.[0];
        if (legend && !legend.id) {
            legend.id = `rg-legend-${this._uniqueId}`;
        }
        const legendId = legend?.id;

        return html`
            <slot name="legend" @slotchange=${this._onSlotChange}></slot>
            <div class="container" role="group" aria-labelledby=${legendId || ""}>
                <div part="track" class="track">
                    ${segmentPoints.slice(0, -1).map((p, i) => {
                        const left = p;
                        const width = segmentPoints[i + 1] - p;
                        return html`<div
                            part="segment segment-${i + 1}"
                            class="segment"
                            style="left: ${left}%; width: ${width}%;"
                        ></div>`;
                    })}
                </div>

                ${this._datalistOptions.length > 0
                    ? html`
                          <div class="ticks">
                              ${this._datalistOptions.map(
                                  (opt) => html`
                                      <div
                                          class="tick-container"
                                          style="left: ${this._valueToPercent(Number(opt.value))}%"
                                      >
                                          <div part="tick" class="tick"></div>
                                          <div part="tick-label" class="tick-label">${opt.label}</div>
                                      </div>
                                  `,
                              )}
                          </div>
                      `
                    : ""}
                ${this._values.map(
                    (value, index) => html`
                        <div
                            part="thumb thumb-${index + 1}"
                            class="thumb"
                            style="left: ${this._valueToPercent(value)}%;"
                            role="slider"
                            tabindex="0"
                            aria-label=${this._getAccessibleName(this._inputs[index], index)}
                            aria-valuemin=${this.min}
                            aria-valuemax=${this.max}
                            aria-valuenow=${Math.round(value)}
                            @pointerdown=${(e: PointerEvent) => this._handlePointerDown(e, index)}
                            @keydown=${(e: KeyboardEvent) => this._handleKeyDown(e, index)}
                        ></div>
                    `,
                )}
            </div>
            <slot @slotchange=${this._onSlotChange} style="display: none;"></slot>
        `;
    }

    static styles = css`
        :host {
            display: block;
            position: relative;
            padding-bottom: calc(var(--thumb-size, 24px) / 2);
            box-sizing: content-box;
            --track-height: 6px;
        }

        .container {
            position: relative;
            width: 100%;
            height: var(--thumb-size, 24px);
            margin-top: calc(var(--thumb-size, 24px) / 2);
        }

        .track {
            position: absolute;
            top: 50%;
            left: 0;
            width: 100%;
            height: var(--track-height);
            transform: translateY(-50%);
            background-color: #ccc;
        }

        .segment {
            position: absolute;
            top: 0;
            height: 100%;
            background-color: #999;
        }

        .thumb {
            position: absolute;
            top: 50%;
            width: var(--thumb-size, 24px);
            height: var(--thumb-size, 24px);
            background-color: var(--thumb-bg, #007bff);
            border-radius: 50%;
            transform: translate(-50%, -50%);
            cursor: pointer;
            z-index: 10;
            touch-action: none;
            box-shadow: 0 0 8px 0 var(--thumb-bg, #007bff);
            transition: transform 0.1s ease-in-out;
        }

        .thumb::before {
            content: "";
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: calc(var(--thumb-size, 24px) + 20px);
            height: calc(var(--thumb-size, 24px) + 20px);
            background: transparent;
            border-radius: 50%;
        }

        .thumb:hover {
            transform: translate(-50%, -50%) scale(1.1);
        }

        .thumb:focus-visible {
            outline: 2px solid oklch(85% 0.15 240);
            outline-offset: 3px;
            transform: translate(-50%, -50%) scale(1.1);
        }

        .ticks {
            position: absolute;
            top: calc(50% + var(--track-height) / 2 + 4px);
            left: 0;
            right: 0;
            height: 20px;
            pointer-events: none;
        }

        .tick-container {
            position: absolute;
            top: 0;
            transform: translateX(-50%);
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .tick {
            width: 1px;
            height: 6px;
            background: var(--tick-color, #999);
        }

        .tick-label {
            margin-top: 4px;
            font-size: 0.75rem;
            color: var(--tick-label-color, #666);
        }
    `;
}
