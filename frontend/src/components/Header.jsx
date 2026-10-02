import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router';
import { Activity, Search, ShoppingBag, Truck, UserRound } from 'lucide-react';
import Logo from './Logo.jsx';
import ProductImage from './ProductImage.jsx';
import { api, money } from '../api.js';
import { useSession } from '../session.jsx';

function SearchBox() {
    const [text, setText] = useState('');
    const [hits, setHits] = useState([]);
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();
    const boxRef = useRef(null);

    // live suggestions, debounced so we don't call catalogue on every key
    useEffect(() => {
        const term = text.trim();
        if (term.length < 2) {
            setHits([]);
            return;
        }
        const controller = new AbortController();
        const timer = setTimeout(() => {
            api(`/catalogue/search/${encodeURIComponent(term)}`, { signal: controller.signal })
                .then((data) => setHits(data.slice(0, 5)))
                .catch(() => setHits([]));
        }, 250);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [text]);

    useEffect(() => {
        const close = (e) => {
            if (!boxRef.current?.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    const submit = (e) => {
        e.preventDefault();
        if (!text.trim()) return;
        navigate(`/search?q=${encodeURIComponent(text.trim())}`);
        setOpen(false);
        setText('');
    };

    return (
        <form className="search" onSubmit={submit} ref={boxRef} role="search">
            <Search size={18} className="search-icon" />
            <input
                type="search"
                placeholder="Search for robots, AI assistants..."
                value={text}
                onChange={(e) => {
                    setText(e.target.value);
                    setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                aria-label="Search products"
            />
            {open && hits.length > 0 && (
                <ul className="suggest">
                    {hits.map((p) => (
                        <li key={p.sku}>
                            <Link
                                to={`/product/${p.sku}`}
                                onClick={() => {
                                    setOpen(false);
                                    setText('');
                                }}
                            >
                                <ProductImage sku={p.sku} alt="" />
                                <span className="suggest-name">{p.name}</span>
                                <span className="suggest-price">{money(p.price)}</span>
                            </Link>
                        </li>
                    ))}
                    <li className="suggest-all">
                        <button type="submit">See all results for "{text.trim()}"</button>
                    </li>
                </ul>
            )}
        </form>
    );
}

export default function Header() {
    const { user, itemCount, openDrawer } = useSession();
    const location = useLocation();
    const [bump, setBump] = useState(false);
    const prevCount = useRef(itemCount);

    // little bounce on the bag when items are added
    useEffect(() => {
        if (itemCount > prevCount.current) {
            setBump(true);
            const t = setTimeout(() => setBump(false), 500);
            prevCount.current = itemCount;
            return () => clearTimeout(t);
        }
        prevCount.current = itemCount;
    }, [itemCount]);

    useEffect(() => {
        window.scrollTo({ top: 0 });
    }, [location.pathname]);

    return (
        <header className="header">
            <div className="topbar">
                <div className="topbar-inner">
                    <span>
                        <Truck size={15} /> Shipping to 25 countries · 30-day returns · 2-year warranty
                    </span>
                    <Link to="/status" className="topbar-link">
                        <Activity size={14} /> System status
                    </Link>
                </div>
            </div>
            <div className="header-inner">
                <Link to="/" className="brand" aria-label="RoboShop home">
                    <Logo />
                    <span className="brand-text">RoboShop</span>
                </Link>

                <nav className="nav">
                    <NavLink to="/" end>Shop all</NavLink>
                    <NavLink to="/?cat=Artificial%20Intelligence">AI</NavLink>
                    <NavLink to="/?cat=Robot">Robots</NavLink>
                </nav>

                <SearchBox />

                <div className="header-actions">
                    <Link to="/account" className="icon-link">
                        <UserRound size={20} />
                        <span className="hide-sm">{user ? user.name : 'Sign in'}</span>
                    </Link>
                    <button className={`bag-btn ${bump ? 'bump' : ''}`} onClick={openDrawer} aria-label="Open cart">
                        <ShoppingBag size={20} />
                        <span className="hide-sm">Cart</span>
                        {itemCount > 0 && <span className="badge">{itemCount}</span>}
                    </button>
                </div>
            </div>
        </header>
    );
}
