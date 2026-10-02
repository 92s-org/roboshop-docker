import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ChevronRight, ShoppingCart } from 'lucide-react';
import { api, money } from '../api.js';
import { useSession } from '../session.jsx';
import { useToast } from '../toast.jsx';
import ProductImage from '../components/ProductImage.jsx';
import ProductCard from '../components/ProductCard.jsx';
import QtyStepper from '../components/QtyStepper.jsx';
import Stars from '../components/Stars.jsx';
import StockBadge from '../components/StockBadge.jsx';
import Spinner from '../components/Spinner.jsx';

export default function Product() {
    const { sku } = useParams();
    const { addToCart } = useSession();
    const toast = useToast();
    const [product, setProduct] = useState(null);
    const [rating, setRating] = useState({ avg_rating: 0, rating_count: 0 });
    const [related, setRelated] = useState([]);
    const [qty, setQty] = useState(1);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        setProduct(null);
        setError('');
        setQty(1);
        api(`/catalogue/product/${encodeURIComponent(sku)}`)
            .then((p) => {
                setProduct(p);
                const cat = p.categories?.[0];
                if (cat) {
                    api(`/catalogue/products/${encodeURIComponent(cat)}`)
                        .then((list) => setRelated(list.filter((r) => r.sku !== p.sku).slice(0, 4)))
                        .catch(() => setRelated([]));
                }
            })
            .catch((err) => setError(err.status === 404 ? 'This robot is not in our catalogue.' : err.message));
        api(`/catalogue/ratings/${encodeURIComponent(sku)}`)
            .then(setRating)
            .catch(() => {});
    }, [sku]);

    const rate = async (score) => {
        try {
            setRating(await api(`/catalogue/rate/${encodeURIComponent(sku)}/${score}`, { method: 'PUT' }));
            toast.success('Thanks for rating', `You gave ${product.name} ${score} star${score > 1 ? 's' : ''}`);
        } catch (err) {
            toast.error('Rating failed', err.message);
        }
    };

    const add = async () => {
        setBusy(true);
        try {
            await addToCart(product.sku, qty);
            toast.success('Added to cart', `${qty} × ${product.name}`);
        } catch (err) {
            toast.error('Could not add to cart', err.message);
        } finally {
            setBusy(false);
        }
    };

    if (error) {
        return (
            <div className="empty">
                <h2>Signal lost</h2>
                <p>{error}</p>
                <Link to="/" className="btn btn-primary">Back to the fleet</Link>
            </div>
        );
    }
    if (!product) return <Spinner label="Loading unit" />;

    const maxQty = Math.min(product.instock, 10);

    return (
        <>
            <nav className="crumbs mono">
                <Link to="/">fleet</Link>
                <ChevronRight size={14} />
                {product.categories?.[0] && (
                    <>
                        <Link to={`/?cat=${encodeURIComponent(product.categories[0])}`}>{product.categories[0].toLowerCase()}</Link>
                        <ChevronRight size={14} />
                    </>
                )}
                <span>{product.sku.toLowerCase()}</span>
            </nav>

            <section className="product">
                <div className="product-stage">
                    <div className="stage-grid" />
                    <div className="pedestal" />
                    <ProductImage sku={product.sku} alt={product.name} className="product-img" />
                    <span className="sku mono">{product.sku}</span>
                </div>

                <div className="product-info">
                    <div className="card-tags">
                        {product.categories?.map((c) => (
                            <span key={c} className="tag">{c}</span>
                        ))}
                    </div>
                    <h1>{product.name}</h1>

                    <div className="rating-row">
                        <Stars value={rating.avg_rating} onRate={rate} />
                        <span className="muted">
                            {rating.rating_count
                                ? `${rating.avg_rating.toFixed(1)} · ${rating.rating_count} vote${rating.rating_count > 1 ? 's' : ''}`
                                : 'No votes yet - be the first'}
                        </span>
                    </div>

                    <p className="product-desc">{product.description}</p>

                    <div className="buy-box">
                        <div className="buy-price">
                            <span className="price price-lg">{money(product.price)}</span>
                            <span className="muted small">incl. 20% VAT</span>
                        </div>
                        <StockBadge instock={product.instock} />

                        {product.instock > 0 ? (
                            <div className="buy-actions">
                                <QtyStepper value={qty} min={1} max={maxQty} onChange={setQty} disabled={busy} />
                                <button className="btn btn-primary btn-wide" onClick={add} disabled={busy}>
                                    <ShoppingCart size={18} /> {busy ? 'Adding...' : `Add to cart · ${money(product.price * qty)}`}
                                </button>
                            </div>
                        ) : (
                            <div className="alert alert-warn">This unit is sold out. Check back after the next production run.</div>
                        )}
                    </div>

                    <dl className="spec">
                        <div><dt>SKU</dt><dd className="mono">{product.sku}</dd></div>
                        <div><dt>Availability</dt><dd>{product.instock} units</dd></div>
                        <div><dt>Ships from</dt><dd>Hangar 7, Germany</dd></div>
                    </dl>
                </div>
            </section>

            {related.length > 0 && (
                <section className="section">
                    <div className="section-head">
                        <div>
                            <span className="eyebrow mono">// same series</span>
                            <h2>You may also deploy</h2>
                        </div>
                    </div>
                    <div className="grid">
                        {related.map((p, i) => (
                            <ProductCard key={p.sku} product={p} index={i} />
                        ))}
                    </div>
                </section>
            )}
        </>
    );
}
