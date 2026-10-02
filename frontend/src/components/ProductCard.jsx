import { useState } from 'react';
import { Link } from 'react-router';
import { ShoppingBag, Star } from 'lucide-react';
import ProductImage from './ProductImage.jsx';
import { money } from '../api.js';
import { useSession } from '../session.jsx';
import { useToast } from '../toast.jsx';

export default function ProductCard({ product, rating, index = 0 }) {
    const { addToCart, openDrawer } = useSession();
    const toast = useToast();
    const [busy, setBusy] = useState(false);
    const soldOut = product.instock === 0;
    const lowStock = !soldOut && product.instock <= 2;

    const quickAdd = async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
            await addToCart(product.sku, 1);
            openDrawer();
        } catch (err) {
            toast.error('Could not add to cart', err.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <Link
            to={`/product/${product.sku}`}
            className={`product-card ${soldOut ? 'is-soldout' : ''}`}
            style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}
        >
            <div className="card-media">
                <ProductImage sku={product.sku} alt={product.name} />
                <div className="card-badges">
                    {soldOut && <span className="pill pill-dark">Sold out</span>}
                    {lowStock && <span className="pill pill-warn">Only {product.instock} left</span>}
                    {product.price >= 2000 && <span className="pill pill-accent">Flagship</span>}
                </div>
                {!soldOut && (
                    <button className="quick-add" onClick={quickAdd} disabled={busy}>
                        <ShoppingBag size={16} /> {busy ? 'Adding...' : 'Add to cart'}
                    </button>
                )}
            </div>
            <div className="card-body">
                <span className="card-cat">{product.categories?.join(' · ')}</span>
                <h3>{product.name}</h3>
                {rating?.rating_count > 0 && (
                    <span className="card-rating">
                        <Star size={14} className="star-solid" />
                        {rating.avg_rating.toFixed(1)}
                        <span className="muted">({rating.rating_count})</span>
                    </span>
                )}
                <span className="price">{money(product.price)}</span>
            </div>
        </Link>
    );
}
