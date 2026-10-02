import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ChevronRight, RotateCcw, ShieldCheck, ShoppingBag, Truck } from 'lucide-react';
import { api, loadRatings, money } from '../api.js';
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
    const { addToCart, openDrawer } = useSession();
    const toast = useToast();
    const navigate = useNavigate();
    const [product, setProduct] = useState(null);
    const [rating, setRating] = useState({ avg_rating: 0, rating_count: 0 });
    const [ratings, setRatings] = useState({});
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
            .catch((err) => setError(err.status === 404 ? "We couldn't find this product." : err.message));
        api(`/catalogue/ratings/${encodeURIComponent(sku)}`).then(setRating).catch(() => {});
        loadRatings().then(setRatings);
    }, [sku]);

    const rate = async (score) => {
        try {
            setRating(await api(`/catalogue/rate/${encodeURIComponent(sku)}/${score}`, { method: 'PUT' }));
            loadRatings({ refresh: true }).then(setRatings);
            toast.success('Thanks for your review', `You rated ${product.name} ${score} out of 5`);
        } catch (err) {
            toast.error('Rating failed', err.message);
        }
    };

    const add = async (buyNow) => {
        setBusy(true);
        try {
            await addToCart(product.sku, qty);
            if (buyNow) navigate('/checkout/shipping');
            else openDrawer();
        } catch (err) {
            toast.error('Could not add to cart', err.message);
        } finally {
            setBusy(false);
        }
    };

    if (error) {
        return (
            <div className="empty">
                <h2>Product not found</h2>
                <p>{error}</p>
                <Link to="/" className="btn btn-dark">Back to the shop</Link>
            </div>
        );
    }
    if (!product) return <Spinner label="Loading product" />;

    const maxQty = Math.min(product.instock, 10);
    const cat = product.categories?.[0];

    return (
        <>
            <nav className="crumbs">
                <Link to="/">Home</Link>
                <ChevronRight size={14} />
                {cat && (
                    <>
                        <Link to={`/?cat=${encodeURIComponent(cat)}`}>{cat === 'Robot' ? 'Robots' : 'AI assistants'}</Link>
                        <ChevronRight size={14} />
                    </>
                )}
                <span>{product.name}</span>
            </nav>

            <section className="product">
                <div className="product-media">
                    <ProductImage sku={product.sku} alt={product.name} eager />
                </div>

                <div className="product-info">
                    <span className="card-cat">{product.categories?.join(' · ')}</span>
                    <h1>{product.name}</h1>

                    <div className="rating-row">
                        <Stars value={rating.avg_rating} onRate={rate} />
                        <span className="muted small">
                            {rating.rating_count
                                ? `${rating.avg_rating.toFixed(1)} out of 5 · ${rating.rating_count} review${rating.rating_count > 1 ? 's' : ''}`
                                : 'No reviews yet. Click a star to rate it.'}
                        </span>
                    </div>

                    <div className="buy-price">
                        <span className="price price-lg">{money(product.price)}</span>
                        <span className="muted small">VAT included</span>
                    </div>

                    <p className="product-desc">{/[.!?]$/.test(product.description) ? product.description : `${product.description}.`}</p>

                    <StockBadge instock={product.instock} />

                    {product.instock > 0 ? (
                        <div className="buy-actions">
                            <QtyStepper value={qty} min={1} max={maxQty} onChange={setQty} disabled={busy} />
                            <button className="btn btn-dark" onClick={() => add(false)} disabled={busy}>
                                <ShoppingBag size={18} /> Add to cart
                            </button>
                            <button className="btn btn-accent" onClick={() => add(true)} disabled={busy}>
                                Buy now
                            </button>
                        </div>
                    ) : (
                        <div className="alert alert-warn">Sold out. New units arrive after the next production run.</div>
                    )}

                    <ul className="assurances">
                        <li><Truck size={20} strokeWidth={1.75} /> <span><strong>Ships from Germany</strong> Cost by distance, shown at checkout</span></li>
                        <li><RotateCcw size={20} strokeWidth={1.75} /> <span><strong>30-day returns</strong> Send it back, no questions asked</span></li>
                        <li><ShieldCheck size={20} strokeWidth={1.75} /> <span><strong>2-year warranty</strong> Repairs and parts included</span></li>
                    </ul>

                    <details className="details" open>
                        <summary>Product details</summary>
                        <dl>
                            <div><dt>Model</dt><dd>{product.sku}</dd></div>
                            <div><dt>Category</dt><dd>{product.categories?.join(', ')}</dd></div>
                            <div><dt>In stock</dt><dd>{product.instock} units</dd></div>
                            <div><dt>Warranty</dt><dd>2 years</dd></div>
                        </dl>
                    </details>
                </div>
            </section>

            {related.length > 0 && (
                <section className="section">
                    <div className="section-head">
                        <h2>You might also like</h2>
                    </div>
                    <div className="grid">
                        {related.map((p, i) => (
                            <ProductCard key={p.sku} product={p} rating={ratings[p.sku]} index={i} />
                        ))}
                    </div>
                </section>
            )}
        </>
    );
}
