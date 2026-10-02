import { useState } from 'react';
import { Link, Navigate } from 'react-router';
import { CircleCheckBig, CreditCard, LockKeyhole } from 'lucide-react';
import { api, money } from '../api.js';
import { EMPTY_CART, useSession } from '../session.jsx';
import { useToast } from '../toast.jsx';
import CheckoutSteps from '../components/CheckoutSteps.jsx';
import Spinner from '../components/Spinner.jsx';

export default function Payment() {
    const { cart, cartLoading, uniqueid, user, setCart } = useSession();
    const toast = useToast();
    const [busy, setBusy] = useState(false);
    const [order, setOrder] = useState(null);

    const pay = async () => {
        setBusy(true);
        try {
            const res = await api(`/payment/pay/${uniqueid}`, { method: 'POST', body: cart });
            setOrder(res);
            setCart(EMPTY_CART);
        } catch (err) {
            toast.error('Payment failed', err.message);
        } finally {
            setBusy(false);
        }
    };

    if (order) {
        return (
            <section className="section">
                <CheckoutSteps current={3} />
                <div className="success panel">
                    <div className="success-burst">
                        <CircleCheckBig size={54} />
                    </div>
                    <h1>Order confirmed</h1>
                    <p className="muted">Your robots are being prepared for deployment.</p>
                    <div className="order-id mono">
                        <span>order id</span>
                        {order.orderid}
                    </div>
                    <div className="hero-actions center">
                        <Link to="/" className="btn btn-primary">Continue shopping</Link>
                        {user && <Link to="/account" className="btn btn-ghost">View order history</Link>}
                    </div>
                    {!user && (
                        <p className="muted small">
                            Tip: <Link to="/account">sign in</Link> before checkout to keep an order history.
                        </p>
                    )}
                </div>
            </section>
        );
    }

    if (cartLoading) return <Spinner label="Loading cart" />;

    // payment needs a cart with a shipping line
    if (!cart.items.some((i) => i.sku === 'SHIP')) {
        return <Navigate to={cart.items.length ? '/checkout/shipping' : '/cart'} replace />;
    }

    const items = cart.items.filter((i) => i.sku !== 'SHIP');
    const ship = cart.items.find((i) => i.sku === 'SHIP');

    return (
        <section className="section">
            <CheckoutSteps current={2} />
            <div className="checkout">
                <div className="panel">
                    <div className="panel-head">
                        <h2>Review your order</h2>
                    </div>
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Unit</th>
                                <th className="num">Qty</th>
                                <th className="num">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((i) => (
                                <tr key={i.sku}>
                                    <td>{i.name}</td>
                                    <td className="num mono">{i.qty}</td>
                                    <td className="num mono">{money(i.subtotal)}</td>
                                </tr>
                            ))}
                            <tr className="row-ship">
                                <td>{ship.name}</td>
                                <td className="num mono">1</td>
                                <td className="num mono">{money(ship.subtotal)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <aside className="panel summary">
                    <h3>Payment</h3>
                    <div className="fake-card">
                        <CreditCard size={22} />
                        <span className="mono">•••• •••• •••• 2026</span>
                        <span className="muted small">Demo card, no real charge</span>
                    </div>
                    <dl>
                        <div><dt>Incl. VAT (20%)</dt><dd className="mono">{money(cart.tax)}</dd></div>
                        <div className="summary-total"><dt>Total</dt><dd className="mono">{money(cart.total)}</dd></div>
                    </dl>
                    <button className="btn btn-primary btn-wide" onClick={pay} disabled={busy}>
                        <LockKeyhole size={17} /> {busy ? 'Processing...' : `Pay ${money(cart.total)}`}
                    </button>
                    <Link to="/checkout/shipping" className="link-muted">Change shipping</Link>
                </aside>
            </div>
        </section>
    );
}
