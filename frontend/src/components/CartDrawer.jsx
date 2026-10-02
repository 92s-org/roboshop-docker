import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ShoppingBag, Trash2, X } from 'lucide-react';
import { money } from '../api.js';
import { useSession } from '../session.jsx';
import { useToast } from '../toast.jsx';
import ProductImage from './ProductImage.jsx';
import QtyStepper from './QtyStepper.jsx';

// slide-out mini cart, opens when something is added
export default function CartDrawer() {
    const { cart, drawerOpen, closeDrawer, updateQty } = useSession();
    const toast = useToast();
    const navigate = useNavigate();
    const [busySku, setBusySku] = useState(null);
    const items = cart.items.filter((i) => i.sku !== 'SHIP');
    const subtotal = items.reduce((sum, i) => sum + i.subtotal, 0);

    useEffect(() => {
        if (!drawerOpen) return;
        const onKey = (e) => e.key === 'Escape' && closeDrawer();
        document.addEventListener('keydown', onKey);
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = '';
        };
    }, [drawerOpen, closeDrawer]);

    const change = async (sku, qty) => {
        setBusySku(sku);
        try {
            await updateQty(sku, qty);
        } catch (err) {
            toast.error('Could not update cart', err.message);
        } finally {
            setBusySku(null);
        }
    };

    const go = (path) => {
        closeDrawer();
        navigate(path);
    };

    return (
        <div className={`drawer-wrap ${drawerOpen ? 'open' : ''}`} aria-hidden={!drawerOpen}>
            <div className="drawer-backdrop" onClick={closeDrawer} />
            <aside className="drawer" role="dialog" aria-label="Shopping cart">
                <div className="drawer-head">
                    <h2>Your cart</h2>
                    <button className="icon-btn" onClick={closeDrawer} aria-label="Close cart">
                        <X size={20} />
                    </button>
                </div>

                {items.length === 0 ? (
                    <div className="drawer-empty">
                        <ShoppingBag size={40} strokeWidth={1.5} />
                        <p>Your cart is empty.</p>
                        <button className="btn btn-dark" onClick={() => go('/')}>Start shopping</button>
                    </div>
                ) : (
                    <>
                        <ul className="drawer-lines">
                            {items.map((item) => (
                                <li key={item.sku}>
                                    <Link to={`/product/${item.sku}`} onClick={closeDrawer} className="drawer-img">
                                        <ProductImage sku={item.sku} alt={item.name} />
                                    </Link>
                                    <div className="drawer-info">
                                        <Link to={`/product/${item.sku}`} onClick={closeDrawer} className="drawer-name">
                                            {item.name}
                                        </Link>
                                        <span className="muted small">{money(item.price)}</span>
                                        <div className="drawer-row">
                                            <QtyStepper
                                                value={item.qty}
                                                min={1}
                                                max={10}
                                                size="sm"
                                                disabled={busySku === item.sku}
                                                onChange={(q) => change(item.sku, q)}
                                            />
                                            <button
                                                className="link-btn"
                                                onClick={() => change(item.sku, 0)}
                                                disabled={busySku === item.sku}
                                            >
                                                <Trash2 size={15} /> Remove
                                            </button>
                                        </div>
                                    </div>
                                    <strong className="num">{money(item.subtotal)}</strong>
                                </li>
                            ))}
                        </ul>
                        <div className="drawer-foot">
                            <div className="drawer-total">
                                <span>Subtotal</span>
                                <strong className="num">{money(subtotal)}</strong>
                            </div>
                            <p className="muted small">VAT included. Shipping is calculated at checkout.</p>
                            <button className="btn btn-dark btn-wide" onClick={() => go('/checkout/shipping')}>
                                Checkout
                            </button>
                            <button className="btn btn-light btn-wide" onClick={() => go('/cart')}>
                                View cart
                            </button>
                        </div>
                    </>
                )}
            </aside>
        </div>
    );
}
