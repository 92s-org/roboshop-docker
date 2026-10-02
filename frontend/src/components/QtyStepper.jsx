import { Minus, Plus } from 'lucide-react';

export default function QtyStepper({ value, min = 0, max = 10, onChange, disabled }) {
    return (
        <div className="stepper">
            <button type="button" onClick={() => onChange(value - 1)} disabled={disabled || value <= min} aria-label="Decrease">
                <Minus size={15} />
            </button>
            <span className="mono">{value}</span>
            <button type="button" onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label="Increase">
                <Plus size={15} />
            </button>
        </div>
    );
}
