import { LitElement, html, css, PropertyValueMap } from "lit";
import { customElement, property, state, queryAssignedElements } from "lit/decorators.js";

@customElement("range-group")
export class RangeGroup extends LitElement {
    declare shadowRoot: ShadowRoot;
    declare dispatchEvent: (event: Event) => boolean;
    declare hasAttribute: (name: string) => boolean;
    declare requestUpdate: (name?: PropertyKey, oldValue?: unknown) => void;

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
    private _pendingActivation: { indices: number[]; initialX: number } | null = null;
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
                const label = document.querySelector<HTMLLabelElement>(`label[for="${input.id}"]`);
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
            // Combine legend and control label for better context in screen readers.
            // Using a comma provides a natural pause.
            return `${legendText}, ${finalControlLabel}`;
        }

        return finalControlLabel;
    }

    private _initializeInputs() {
        if (this._inputs.length === 0) return;

        // Must sort by attribute value, as the `value` property may have been clamped
        // by the browser before our `min` and `max` attributes have been propagated.
        this._inputs.sort((a, b) => Number(a.getAttribute("value")) - Number(b.getAttribute("value")));

        this._inputs.forEach((input) => {
            // Propagate min/max from this component to the underlying inputs.
            if (this.hasAttribute("min")) input.min = String(this.min);
            if (this.hasAttribute("max")) input.max = String(this.max);

            // Crucially, re-apply the value from the attribute *after* setting min/max.
            // This corrects any clamping the browser did with the default min=0.
            const initialValue = input.getAttribute("value");
            if (initialValue !== null) {
                input.value = initialValue;
            }

            // Set up event listeners
            input.removeEventListener("input", this._handleInputChange);
            input.removeEventListener("change", this._handleInputChange);
            input.addEventListener("input", this._handleInputChange);
            input.addEventListener("change", this._handleInputChange);
        });

        // Initialize the component's internal state from the now-correct input values.
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
        this._containerRect = this.shadowRoot?.querySelector(".container")?.getBoundingClientRect() ?? null;

        const currentValue = this._values[index];
        const overlappingIndices = this._values.reduce((acc, v, i) => {
            if (Math.abs(v - currentValue) < 0.001) {
                // Use a tolerance for float comparison
                acc.push(i);
            }
            return acc;
        }, [] as number[]);

        if (overlappingIndices.length > 1) {
            // Overlap detected: defer activation and focus until pointer move.
            this._pendingActivation = {
                indices: overlappingIndices,
                initialX: e.clientX,
            };
            this._activeThumbIndex = null;
        } else {
            // No overlap: activate and focus immediately.
            (e.target as HTMLElement).focus();
            this._activeThumbIndex = index;
        }

        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }

    private _handlePointerMove = (e: PointerEvent) => {
        // If a thumb activation is pending, determine which thumb to activate based on drag direction.
        if (this._pendingActivation) {
            const dx = e.clientX - this._pendingActivation.initialX;
            // Wait for a clear move to determine direction to avoid accidental activation.
            if (Math.abs(dx) > 2) {
                const direction = dx > 0 ? "right" : "left";
                const indices = this._pendingActivation.indices;
                // On left drag, grab the leftmost thumb of the stack.
                // On right drag, grab the rightmost thumb of the stack.
                this._activeThumbIndex = direction === "left" ? Math.min(...indices) : Math.max(...indices);

                // Now that the thumb is active, find its element and focus it.
                const thumbElements = this.shadowRoot?.querySelectorAll<HTMLElement>(".thumb");
                if (thumbElements && thumbElements[this._activeThumbIndex]) {
                    thumbElements[this._activeThumbIndex].focus();
                }

                this._pendingActivation = null; // Activation is decided for this drag session.
            }
        }

        if (this._activeThumbIndex === null || !this._containerRect) return;
        e.preventDefault();

        const percent = Math.max(0, Math.min(1, (e.clientX - this._containerRect.left) / this._containerRect.width));
        const value = this.min + percent * (this.max - this.min);

        this.setRangeValue(this._activeThumbIndex, value);
    };

    private _handlePointerUp = (e: PointerEvent) => {
        if (this._activeThumbIndex !== null || this._pendingActivation !== null) {
            e.preventDefault();
            try {
                (e.target as HTMLElement).releasePointerCapture(e.pointerId);
            } catch (err) {
                // This can happen if pointer capture is lost for other reasons; it's safe to ignore.
            }
        }

        this._activeThumbIndex = null;
        this._pendingActivation = null;
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

        // Use component's min/max as the source of truth for clamping.
        // This is more reliable than reading from the child input element during initialization.
        const minVal = this.min;
        const maxVal = this.max;

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
        const segmentPoints = [0, ...this._values.map((v) => this._valueToPercent(v)), 100];

        const legend = this._legendElements?.[0];
        if (legend && !legend.id) {
            legend.id = `rg-legend-${this._uniqueId}`;
        }
        const legendId = legend?.id;

        return html`
            <fieldset class="wrapper">
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
                                <div class="ticks-wrapper">
                                    <div class="tick-marks" part="ticks">
                                        ${this._datalistOptions.map(
                                                (opt, index) => html`
                                                    <div
                                                            part="tick tick-${index + 1}"
                                                            class="tick"
                                                            style="left: ${this._valueToPercent(Number(opt.value))}%"
                                                    ></div>
                                                `,
                                        )}
                                    </div>
                                    <div class="tick-labels" part="tick-labels">
                                        ${this._datalistOptions.map(
                                                (opt, index) => html`
                                                    <div
                                                            part="tick-label tick-label-${index + 1}"
                                                            class="tick-label"
                                                            style="left: ${this._valueToPercent(Number(opt.value))}%"
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
                                        part="thumb thumb-${index + 1}"
                                        class="thumb"
                                        style="left: ${this._valueToPercent(value)}%; z-index: ${index === this._activeThumbIndex
                                                ? 12
                                                : 10};"
                                        role="slider"
                                        tabindex="0"
                                        aria-label=${this._getAccessibleName(this._inputs[index], index)}
                                        aria-valuemin=${this.min}
                                        aria-valuemax=${this.max}
                                        aria-valuenow=${Math.round(value)}
                                        @pointerdown=${(e: PointerEvent) => this._handlePointerDown(e, index)}
                                        @keydown=${(e: KeyboardEvent) => this._handleKeyDown(e, index)}
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
            padding-bottom: calc(var(--thumb-size, 24px) / 2);
            box-sizing: content-box;
            --track-height: 6px;
        }

        .wrapper {
            border: 0;
            padding: 0;
            margin: 0;

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
            touch-action: none;
            box-shadow: 0 0 8px 0 var(--thumb-bg, #007bff);
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
            width: calc(var(--thumb-size, 24px) + 20px);
            height: calc(var(--thumb-size, 24px) + 20px);
            background: transparent;
            border-radius: 50%;
        }

        .thumb:hover {
            transform: translate(-50%, -50%) scale(1.1);
        }

        .thumb:focus-visible {
            outline-offset: 4px;
        }

        .ticks-wrapper {
            position: absolute;
            top: calc(50% + var(--track-height) / 2 + 4px);
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
            transform: translateX(-50%);
            width: 1px;
            height: 6px;
            background: var(--tick-color, currentColor);
        }

        .tick-label {
            position: absolute;
            top: 10px; /* 6px tick height + 4px gap */
            transform: translateX(-50%);
            font-size: 0.75rem;
            color: var(--tick-label-color, currentColor);
        }
    `;
}
