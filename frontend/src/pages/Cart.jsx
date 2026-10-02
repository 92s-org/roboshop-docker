import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, ShoppingCart, Trash2 } from 'lucide-react';
import { money } from '../api.js';
import { useSession } from '../session.jsx';
import { useToast } from '../toast.jsx';
import CheckoutSteps from '../components/CheckoutSteps.jsx';
import ProductImage from '../components/ProductImage.jsx';
import QtyStepper from '../components/QtyStepper.jsx';
import Spinner from '../components/Spinner.jsx';

export default function Cart() {
    const { cart, cartLoading, uniqueid, updateQty } = useSession();
    const toast = useToast();
    const navigate = useNavigate();
    const [busySku, setBusySku] = useState(null);

    // shipping is chosen again at checkout, so drop an old shipping line
    const hasShip = cart.items.some((i) => i.sku === 'SHIP');
    useEffect(() => {
        if (hasShip) updateQty('SHIP', 0).catch(() => {});
    }, [hasShip, updateQty]);

    const change = async (sku, qty) => {
        setBusySku(sku);
        try {
            await updateQty(sku, qty);
            if (qty === 0) toast.info('Removed from cart');
        } catch (err) {
            toast.error('Update failed', err.message);
        } finally {
            setBusySku(null);
        }
    };

    const items = cart.items.filter((i) => i.sku !== 'SHIP');

    if (cartLoading) return <Spinner label="Loading cart" />;

    if (items.length === 0) {
        return (
            <div className="empty">
                <ShoppingCart size={46} className="empty-icon" />
                <h2>Your cart is empty</h2>
                <p>No robots assigned to this mission yet.</p>
                <Link to="/" className="btn btn-primary">Browse the fleet</Link>
            </div>
        );
    }

    return (
        <section className="section">
            <CheckoutSteps current={0} />
            <div className="checkout">
                <div className="panel">
                    <div className="panel-head">
                        <h2>Cart</h2>
                        <span className="muted mono small">id: {uniqueid}</span>
                    </div>
                    <ul className="lines">
                        {items.map((item) => (
                            <li key={item.sku} className="line">
                                <Link to={`/product/${item.sku}`} className="line-img">
                                    <ProductImage sku={item.sku} alt={item.name} />
                                </Link>
                                <div className="line-info">
                                    <Link to={`/product/${item.sku}`}>{item.name}</Link>
                                    <span className="muted small mono">{money(item.price)} each</span>
                                </div>
                                <QtyStepper
                                    value={item.qty}
                                    min={1}
                                    max={10}
                                    disabled={busySku === item.sku}
                                    onChange={(q) => change(item.sku, q)}
                                />
                                <span className="line-total mono">{money(item.subtotal)}</span>
                                <button
                                    className="icon-btn danger"
                                    onClick={() => change(item.sku, 0)}
                                    disabled={busySku === item.sku}
                                    aria-label={`Remove ${item.name}`}
                                >
                                    <Trash2 size={17} />
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>

                <aside className="panel summary">
                    <h3>Summary</h3>
                    <dl>
                        <div><dt>Items</dt><dd className="mono">{items.reduce((n, i) => n + i.qty, 0)}</dd></div>
                        <div><dt>Shipping</dt><dd className="muted">next step</dd></div>
                        <div><dt>Incl. VAT (20%)</dt><dd className="mono">{money(cart.tax)}</dd></div>
                        <div className="summary-total"><dt>Total</dt><dd className="mono">{money(cart.total)}</dd></div>
                    </dl>
                    <button className="btn btn-primary btn-wide" onClick={() => navigate('/checkout/shipping')}>
                        Checkout <ArrowRight size={18} />
                    </button>
                    <Link to="/" className="link-muted">Continue shopping</Link>
                </aside>
            </div>
        </section>
    );
}
