import './range-group.ts';
import '../style.css';
import type { RangeGroup } from './range-group';

document.addEventListener('DOMContentLoaded', () => {
    const apiRange = document.getElementById('api-range') as unknown as RangeGroup;
    const getValuesBtn = document.getElementById('getValuesBtn');
    const setValuesBtn = document.getElementById('setValuesBtn');
    const apiOutput = document.getElementById('apiOutput');

    if (!apiRange || !getValuesBtn || !setValuesBtn || !apiOutput) {
        return;
    }

    getValuesBtn.addEventListener('click', () => {
        apiOutput.textContent = `Values: [${apiRange.values.join(', ')}]`;
    });

    setValuesBtn.addEventListener('click', () => {
        const val1 = Math.round(Math.random() * 500);
        const val2 = Math.round(Math.random() * 500);
        // Set values ensuring val1 is smaller
        apiRange.setRangeValue(0, Math.min(val1, val2));
        apiRange.setRangeValue(1, Math.max(val1, val2));
        apiOutput.textContent = `Set to: [${apiRange.values.join(', ')}]`;
    });
});
