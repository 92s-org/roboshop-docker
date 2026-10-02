import { Check } from 'lucide-react';

const STEPS = ['Cart', 'Shipping', 'Payment', 'Done'];

export default function CheckoutSteps({ current }) {
    return (
        <ol className="steps">
            {STEPS.map((label, i) => {
                const state = i < current ? 'done' : i === current ? 'active' : '';
                return (
                    <li key={label} className={state}>
                        <span className="step-dot">{i < current ? <Check size={14} /> : i + 1}</span>
                        <span className="step-label">{label}</span>
                    </li>
                );
            })}
        </ol>
    );
}
