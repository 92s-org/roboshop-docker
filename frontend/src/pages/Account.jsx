import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { ChevronDown, LogOut, Package } from 'lucide-react';
import { api, money } from '../api.js';
import { useSession } from '../session.jsx';
import { useToast } from '../toast.jsx';
import Spinner from '../components/Spinner.jsx';

function AuthForms() {
    const { login, register } = useSession();
    const toast = useToast();
    const [mode, setMode] = useState('login');
    const [form, setForm] = useState({ name: '', email: '', password: '', password2: '' });
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        if (mode === 'register' && form.password !== form.password2) {
            setError('Passwords do not match');
            return;
        }
        setBusy(true);
        try {
            if (mode === 'login') {
                const u = await login(form.name.trim(), form.password);
                toast.success(`Welcome back, ${u.name}`);
            } else {
                const u = await register(form.name.trim(), form.email.trim(), form.password);
                toast.success(`Account created`, `Welcome aboard, ${u.name}`);
            }
        } catch (err) {
            setError(err.message);
            setForm((f) => ({ ...f, password: '', password2: '' }));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="auth panel">
            <div className="tabs" role="tablist">
                {['login', 'register'].map((m) => (
                    <button
                        key={m}
                        role="tab"
                        aria-selected={mode === m}
                        className={mode === m ? 'active' : ''}
                        onClick={() => {
                            setMode(m);
                            setError('');
                        }}
                    >
                        {m === 'login' ? 'Sign in' : 'Create account'}
                    </button>
                ))}
            </div>

            <form onSubmit={submit} className="auth-form">
                <label className="field">
                    <span>Username</span>
                    <input value={form.name} onChange={set('name')} required autoComplete="username" />
                </label>
                {mode === 'register' && (
                    <label className="field">
                        <span>Email</span>
                        <input type="email" value={form.email} onChange={set('email')} required autoComplete="email" />
                    </label>
                )}
                <label className="field">
                    <span>Password</span>
                    <input
                        type="password"
                        value={form.password}
                        onChange={set('password')}
                        required
                        minLength={mode === 'register' ? 6 : undefined}
                        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    />
                </label>
                {mode === 'register' && (
                    <label className="field">
                        <span>Confirm password</span>
                        <input type="password" value={form.password2} onChange={set('password2')} required autoComplete="new-password" />
                    </label>
                )}
                {error && <div className="alert alert-error">{error}</div>}
                <button className="btn btn-primary btn-wide" disabled={busy}>
                    {busy ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
                </button>
                {mode === 'login' && (
                    <p className="muted small center">
                        Demo account: <span className="mono">roboshop</span> / <span className="mono">RoboShop@1</span>
                    </p>
                )}
            </form>
        </div>
    );
}

function OrderHistory({ name }) {
    const [history, setHistory] = useState(null);
    const [open, setOpen] = useState(null);

    useEffect(() => {
        api(`/user/history/${encodeURIComponent(name)}`)
            .then((data) => setHistory([...(data.history ?? [])].reverse()))
            .catch(() => setHistory([]));
    }, [name]);

    if (!history) return <Spinner label="Loading orders" />;
    if (history.length === 0) {
        return (
            <div className="empty small-empty">
                <Package size={36} className="empty-icon" />
                <p>No orders yet.</p>
                <Link to="/" className="btn btn-ghost">Start shopping</Link>
            </div>
        );
    }

    return (
        <ul className="orders">
            {history.map((o) => (
                <li key={o.orderid} className={open === o.orderid ? 'open' : ''}>
                    <button className="order-head" onClick={() => setOpen(open === o.orderid ? null : o.orderid)}>
                        <span className="mono order-num">#{o.orderid.slice(0, 8)}</span>
                        <span className="muted small">
                            {o.placedAt ? new Date(o.placedAt).toLocaleString() : ''}
                        </span>
                        <span className="muted small">
                            {o.cart.items.filter((i) => i.sku !== 'SHIP').length} item(s)
                        </span>
                        <strong className="mono">{money(o.cart.total)}</strong>
                        <ChevronDown size={18} className="chev" />
                    </button>
                    {open === o.orderid && (
                        <table className="table">
                            <tbody>
                                {o.cart.items.map((i) => (
                                    <tr key={i.sku} className={i.sku === 'SHIP' ? 'row-ship' : ''}>
                                        <td>{i.name}</td>
                                        <td className="num mono">× {i.qty}</td>
                                        <td className="num mono">{money(i.subtotal)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </li>
            ))}
        </ul>
    );
}

export default function Account() {
    const { user, logout } = useSession();
    const toast = useToast();

    if (!user) {
        return (
            <section className="section auth-wrap">
                <div className="auth-intro">
                    <span className="eyebrow mono">// pilot access</span>
                    <h1>Sign in to your hangar.</h1>
                    <p className="muted">
                        Keep your cart across devices and see every order you've placed.
                        Anything in your cart now comes with you when you sign in.
                    </p>
                </div>
                <AuthForms />
            </section>
        );
    }

    return (
        <section className="section">
            <div className="profile panel">
                <div className="avatar mono">{user.name.slice(0, 2).toUpperCase()}</div>
                <div>
                    <h1>{user.name}</h1>
                    <p className="muted">{user.email}</p>
                </div>
                <button
                    className="btn btn-ghost"
                    onClick={() => {
                        logout();
                        toast.info('Signed out');
                    }}
                >
                    <LogOut size={17} /> Sign out
                </button>
            </div>
            <div className="section-head">
                <div>
                    <span className="eyebrow mono">// deployments</span>
                    <h2>Order history</h2>
                </div>
            </div>
            <OrderHistory name={user.name} />
        </section>
    );
}
