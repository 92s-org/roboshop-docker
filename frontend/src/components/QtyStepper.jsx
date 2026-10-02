import { Minus, Plus } from 'lucide-react';

export default function QtyStepper({ value, min = 0, max = 10, onChange, disabled, size = 'md' }) {
    return (
        <div className={`stepper stepper-${size}`}>
            <button type="button" onClick={() => onChange(value - 1)} disabled={disabled || value <= min} aria-label="Decrease">
                <Minus size={14} />
            </button>
            <span className="num">{value}</span>
            <button type="button" onClick={() => onChange(value + 1)} disabled={disabled || value >= max} aria-label="Increase">
                <Plus size={14} />
            </button>
        </div>
    );
}
