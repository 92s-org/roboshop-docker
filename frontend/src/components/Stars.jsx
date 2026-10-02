import { useState } from 'react';
import { Star } from 'lucide-react';

// shows the average; when onRate is given the stars are clickable
export default function Stars({ value = 0, onRate, size = 20 }) {
    const [hover, setHover] = useState(0);
    const shown = hover || value;

    return (
        <div className={`stars ${onRate ? 'stars-interactive' : ''}`} onMouseLeave={() => setHover(0)}>
            {[1, 2, 3, 4, 5].map((n) => {
                const fill = Math.max(0, Math.min(1, shown - (n - 1)));
                return (
                    <button
                        key={n}
                        type="button"
                        className="star"
                        disabled={!onRate}
                        onMouseEnter={() => onRate && setHover(n)}
                        onClick={() => onRate?.(n)}
                        aria-label={`Rate ${n} of 5`}
                    >
                        <Star size={size} className="star-bg" />
                        <span className="star-fill" style={{ width: `${fill * 100}%` }}>
                            <Star size={size} />
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
