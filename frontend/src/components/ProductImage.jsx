import { useState } from 'react';
import { imageFor } from '../api.js';

// falls back to the placeholder if a product has no picture
export default function ProductImage({ sku, alt, className = '' }) {
    const [src, setSrc] = useState(imageFor(sku));
    return (
        <img
            className={className}
            src={src}
            alt={alt}
            loading="lazy"
            onError={() => setSrc('/images/placeholder.png')}
        />
    );
}
