export interface ExampleNavItem {
    id: string;
    label: string;
    title: string;
}

export interface ExampleNavGroup {
    eyebrow: string;
    items: ExampleNavItem[];
}

export const exampleNav: ExampleNavGroup[] = [
    {
        eyebrow: "Foundations",
        items: [
            { id: "baseline", label: "Baseline (native default)", title: "Baseline (native default)" },
            { id: "interactive-price", label: "Interactive price editor", title: "Interactive price editor" },
            { id: "datalist", label: "Datalist integration", title: "Datalist integration" },
        ],
    },
    {
        eyebrow: "Constraints and state",
        items: [
            { id: "stepbetween", label: "Stepbetween distance", title: "Stepbetween distance" },
            { id: "per-thumb", label: "Per-thumb constraints", title: "Per-thumb constraints" },
            { id: "parent-override", label: "Parent override constraints", title: "Parent override constraints" },
            { id: "multi-handle-constraints", label: "Multi-handle constraints", title: "Multi-handle constraints" },
            { id: "disabled-group", label: "Fully disabled group", title: "Fully disabled group" },
            { id: "disabled-mixed", label: "Mixed disabled state", title: "Mixed disabled state" },
        ],
    },
    {
        eyebrow: "Three-plus thumb patterns",
        items: [
            { id: "crossfade", label: "Crossfade overlap editor", title: "Crossfade overlap editor" },
            { id: "opening-hours", label: "Opening hours selector", title: "Opening hours selector" },
            { id: "temperature", label: "Multi-handle temperature", title: "Multi-handle temperature" },
            { id: "process-flow", label: "Three-handle process flow", title: "Three-handle process flow" },
            { id: "budget", label: "Budget allocator", title: "Budget allocator" },
        ],
    },
    {
        eyebrow: "Creative styling",
        items: [
            { id: "floating-tooltips", label: "Floating anchored tooltips", title: "Floating anchored tooltips" },
            { id: "classic", label: "Classic OS look", title: "Classic OS look" },
            { id: "custom-ticks", label: "Custom tick styling", title: "Custom tick styling" },
            { id: "price-histogram", label: "Histogram price filter", title: "Histogram price filter" },
            { id: "star-rating", label: "Star rating filter", title: "Star rating filter" },
            { id: "gradient-stops", label: "Color-stop gradient editor", title: "Color-stop gradient editor" },
            { id: "timeline", label: "Styled timeline", title: "Styled timeline" },
            { id: "wavy-track", label: "Wavy track shape", title: "Wavy track shape" },
            { id: "circular-track", label: "Circular track shape", title: "Circular track shape" },
        ],
    },
    {
        eyebrow: "JavaScript API",
        items: [
            { id: "api", label: "Programmatic interaction", title: "Programmatic interaction" },
            { id: "dynamic-thumbs", label: "Add & remove thumbs", title: "Add & remove thumbs" },
        ],
    },
];
