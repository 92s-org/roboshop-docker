import { useState } from 'react';
import { Link } from 'react-router';
import { Plus } from 'lucide-react';
import ProductImage from './ProductImage.jsx';
import StockBadge from './StockBadge.jsx';
import { money } from '../api.js';
import { useSession } from '../session.jsx';
import { useToast } from '../toast.jsx';

export default function ProductCard({ product, index = 0 }) {
    const { addToCart } = useSession();
    const toast = useToast();
    const [busy, setBusy] = useState(false);

    const quickAdd = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            await addToCart(product.sku, 1);
            toast.success('Added to cart', product.name);
        } catch (err) {
            toast.error('Could not add', err.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Link
            to={`/product/${product.sku}`}
            className="card product-card"
            style={{ animationDelay: `${Math.min(index, 12) * 45}ms` }}
        >
            <div className="card-media">
                <span className="sku mono">{product.sku}</span>
                <ProductImage sku={product.sku} alt={product.name} />
            </div>
            <div className="card-body">
                <div className="card-tags">
                    {product.categories?.map((c) => (
                        <span key={c} className="tag">{c}</span>
                    ))}
                </div>
                <h3>{product.name}</h3>
                <p className="card-desc">{product.description}</p>
                <div className="card-foot">
                    <div>
                        <div className="price">{money(product.price)}</div>
                        <StockBadge instock={product.instock} />
                    </div>
                    {product.instock > 0 && (
                        <button
                            className="add-btn"
                            onClick={quickAdd}
                            disabled={busy}
                            aria-label={`Add ${product.name} to cart`}
                        >
                            <Plus size={18} />
                        </button>
                    )}
                </div>
            </div>
        </Link>
    );
}
