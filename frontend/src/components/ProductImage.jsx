import { useState } from 'react';
import { imageFor } from '../api.js';

// falls back to the placeholder if a product has no picture
export default function ProductImage({ sku, alt, className = '', eager = false }) {
    const [src, setSrc] = useState(imageFor(sku));
    return (
        <img
            className={className}
            src={src}
            alt={alt}
            loading={eager ? 'eager' : 'lazy'}
            onError={() => setSrc('/images/placeholder.jpg')}
        />
    );
}
