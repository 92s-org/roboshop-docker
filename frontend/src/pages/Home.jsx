import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowRight, RotateCcw, ShieldCheck, Truck, Wrench } from 'lucide-react';
import { api, loadRatings } from '../api.js';
import ProductCard from '../components/ProductCard.jsx';
import Spinner from '../components/Spinner.jsx';

const SORTS = {
    featured: { label: 'Featured', fn: null },
    rating: { label: 'Top rated', fn: null },
    'price-asc': { label: 'Price: low to high', fn: (a, b) => a.price - b.price },
    'price-desc': { label: 'Price: high to low', fn: (a, b) => b.price - a.price },
    name: { label: 'Name A–Z', fn: (a, b) => a.name.localeCompare(b.name) }
};

const CATEGORY_TILES = [
    { cat: 'Artificial Intelligence', title: 'AI assistants', text: 'Thinking machines for home and office', img: '/images/Ewooid.jpg' },
    { cat: 'Robot', title: 'Robots', text: 'Explorers, workers and loyal companions', img: '/images/HPTD.jpg' }
];

const PERKS = [
    { icon: Truck, title: 'Ships to 25 countries', text: 'Priced by distance at checkout' },
    { icon: RotateCcw, title: '30-day returns', text: 'Changed your mind? No problem' },
    { icon: ShieldCheck, title: '2-year warranty', text: 'On every robot we sell' },
    { icon: Wrench, title: 'Free firmware updates', text: 'For the lifetime of your unit' }
];

export default function Home() {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [ratings, setRatings] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [params, setParams] = useSearchParams();
    const category = params.get('cat') || 'All';
    const sort = params.get('sort') || 'featured';

    useEffect(() => {
        Promise.all([api('/catalogue/products'), api('/catalogue/categories')])
            .then(([p, c]) => {
                setProducts(p);
                setCategories(c);
            })
            .catch((err) => setError(err.message))
            .finally(() => setLoading(false));
        loadRatings({ refresh: true }).then(setRatings);
    }, []);

    // a category link from the header scrolls straight to the products
    useEffect(() => {
        if (params.get('cat')) {
            document.getElementById('shop')?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [params]);

    const visible = useMemo(() => {
        let list = category === 'All' ? products : products.filter((p) => p.categories?.includes(category));
        list = [...list];
        if (sort === 'rating') {
            list.sort((a, b) => (ratings[b.sku]?.avg_rating ?? 0) - (ratings[a.sku]?.avg_rating ?? 0));
        } else if (SORTS[sort]?.fn) {
            list.sort(SORTS[sort].fn);
        } else {
            // featured: available products first
            list.sort((a, b) => (b.instock > 0) - (a.instock > 0));
        }
        return list;
    }, [products, category, sort, ratings]);

    const setParam = (key, value, fallback) => {
        const next = new URLSearchParams(params);
        if (value === fallback) next.delete(key);
        else next.set(key, value);
        setParams(next, { replace: true });
    };

    return (
        <>
            <section className="hero">
                <div className="hero-copy">
                    <span className="kicker">New season · 2026 collection</span>
                    <h1>The robot you didn't know you needed.</h1>
                    <p>
                        From pocket-sized companions to planet rovers, every machine is tested in our
                        German workshop and delivered ready to work.
                    </p>
                    <div className="hero-actions">
                        <a href="#shop" className="btn btn-dark">
                            Shop the collection <ArrowRight size={18} />
                        </a>
                        <Link to="/product/HPTD" className="btn btn-light">See the Travel Droid</Link>
                    </div>
                </div>
                <div className="hero-media">
                    <img src="/images/hero.jpg" alt="A shelf of colourful toy robots" />
                    <Link to="/product/SHCE" className="hero-tag">
                        <span className="hero-tag-img"><img src="/images/SHCE.jpg" alt="" /></span>
                        <span>
                            <strong>Strategic Human Control Emulator</strong>
                            <span className="muted">Diplomacy, solved · €300</span>
                        </span>
                    </Link>
                </div>
            </section>

            <section className="perks">
                {PERKS.map(({ icon: Icon, title, text }) => (
                    <div key={title}>
                        <Icon size={22} strokeWidth={1.75} />
                        <span>
                            <strong>{title}</strong>
                            <span className="muted">{text}</span>
                        </span>
                    </div>
                ))}
            </section>

            <section className="tiles">
                {CATEGORY_TILES.map((t) => (
                    <button key={t.cat} className="tile" onClick={() => setParam('cat', t.cat, 'All')}>
                        <img src={t.img} alt="" />
                        <span className="tile-text">
                            <strong>{t.title}</strong>
                            <span>{t.text}</span>
                            <span className="tile-cta">Shop now <ArrowRight size={16} /></span>
                        </span>
                    </button>
                ))}
            </section>

            <section id="shop" className="section">
                <div className="section-head">
                    <div>
                        <h2>{category === 'All' ? 'All products' : category === 'Robot' ? 'Robots' : 'AI assistants'}</h2>
                        <p className="muted">{visible.length} products</p>
                    </div>
                    <label className="select">
                        <span>Sort by</span>
                        <select value={sort} onChange={(e) => setParam('sort', e.target.value, 'featured')}>
                            {Object.entries(SORTS).map(([key, s]) => (
                                <option key={key} value={key}>{s.label}</option>
                            ))}
                        </select>
                    </label>
                </div>

                <div className="chips" role="tablist">
                    {['All', ...categories].map((c) => (
                        <button
                            key={c}
                            role="tab"
                            aria-selected={category === c}
                            className={`chip ${category === c ? 'active' : ''}`}
                            onClick={() => setParam('cat', c, 'All')}
                        >
                            {c === 'All' ? 'All' : c === 'Robot' ? 'Robots' : 'AI assistants'}
                        </button>
                    ))}
                </div>

                {loading && <Spinner label="Loading products" />}
                {error && (
                    <div className="alert alert-error">
                        We couldn't load the products ({error}). Check the <Link to="/status">system status</Link>.
                    </div>
                )}
                {!loading && !error && (
                    <div className="grid">
                        {visible.map((p, i) => (
                            <ProductCard key={p.sku} product={p} rating={ratings[p.sku]} index={i} />
                        ))}
                    </div>
                )}
            </section>
        </>
    );
}
