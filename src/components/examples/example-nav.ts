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
            { id: "single-thumb", label: "Single thumb (group of one)", title: "Single thumb (group of one)" },
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
        eyebrow: "Interaction modes",
        items: [
            { id: "interaction-mode", label: "Interaction mode", title: "Interaction mode (working name)" },
            { id: "video-timeline", label: "Video timeline trim", title: "Video timeline trim" },
            { id: "meeting-slot", label: "Meeting duration slot", title: "Meeting duration slot" },
        ],
    },
    {
        eyebrow: "Three-plus thumb patterns",
        items: [
            { id: "crossfade", label: "Crossfade overlap editor", title: "Crossfade overlap editor" },
            { id: "opening-hours", label: "Opening hours selector", title: "Opening hours selector" },
            {
                id: "opening-hours-segment",
                label: "Opening hours (segment drag)",
                title: "Opening hours selector (segment drag)",
            },
            { id: "temperature", label: "Multi-handle temperature", title: "Multi-handle temperature" },
            { id: "process-flow", label: "Three-handle process flow", title: "Three-handle process flow" },
            { id: "budget", label: "Budget allocator", title: "Budget allocator" },
            {
                id: "budget-segment",
                label: "Budget allocator (segment drag)",
                title: "Budget allocator (segment drag)",
            },
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
            { id: "linked-fields", label: "Linked value fields", title: "Linked value fields (author JS)" },
            { id: "dynamic-thumbs", label: "Add & remove thumbs", title: "Add & remove thumbs" },
        ],
    },
];
