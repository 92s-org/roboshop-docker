import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowDown, Cpu, PackageCheck, Truck } from 'lucide-react';
import { api } from '../api.js';
import ProductCard from '../components/ProductCard.jsx';
import Spinner from '../components/Spinner.jsx';

const SORTS = {
    featured: { label: 'Featured', fn: null },
    'price-asc': { label: 'Price: low to high', fn: (a, b) => a.price - b.price },
    'price-desc': { label: 'Price: high to low', fn: (a, b) => b.price - a.price },
    name: { label: 'Name A-Z', fn: (a, b) => a.name.localeCompare(b.name) }
};

export default function Home() {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
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
    }, []);

    const visible = useMemo(() => {
        let list = category === 'All' ? products : products.filter((p) => p.categories?.includes(category));
        const sorter = SORTS[sort]?.fn;
        if (sorter) list = [...list].sort(sorter);
        else list = [...list].sort((a, b) => (b.instock > 0) - (a.instock > 0));
        return list;
    }, [products, category, sort]);

    const setParam = (key, value, fallback) => {
        const next = new URLSearchParams(params);
        if (value === fallback) next.delete(key);
        else next.set(key, value);
        setParams(next, { replace: true });
    };

    const inStock = products.filter((p) => p.instock > 0).length;

    return (
        <>
            <section className="hero">
                <div className="hero-copy">
                    <span className="eyebrow mono">// fleet catalogue 2026</span>
                    <h1>
                        Robots for <em>every</em> mission.
                    </h1>
                    <p>
                        Harvesters, medics, enforcers and one very curious observability guru.
                        Hand-picked machines, shipped from our hangar to 25 countries.
                    </p>
                    <div className="hero-actions">
                        <a href="#catalogue" className="btn btn-primary">
                            Browse the fleet <ArrowDown size={17} />
                        </a>
                        <Link to="/product/STAN-1" className="btn btn-ghost">Meet Stan</Link>
                    </div>
                    <dl className="hero-stats">
                        <div>
                            <dt className="mono">{products.length || '--'}</dt>
                            <dd>models</dd>
                        </div>
                        <div>
                            <dt className="mono">{inStock || '--'}</dt>
                            <dd>ready to ship</dd>
                        </div>
                        <div>
                            <dt className="mono">25</dt>
                            <dd>countries</dd>
                        </div>
                    </dl>
                </div>
                <div className="hero-visual" aria-hidden="true">
                    <div className="orbit orbit-1" />
                    <div className="orbit orbit-2" />
                    <div className="pedestal" />
                    <img src="/images/stan.png" alt="" className="hero-robot" />
                    <div className="hud-chip hud-chip-1 mono">
                        <span className="dot ok" /> SYS ONLINE
                    </div>
                    <div className="hud-chip hud-chip-2 mono">UNIT · STAN-1</div>
                </div>
            </section>

            <section className="perks">
                <div><Truck size={20} /> <span><strong>Tracked shipping</strong> priced by distance</span></div>
                <div><PackageCheck size={20} /> <span><strong>Live stock</strong> straight from the catalogue</span></div>
                <div><Cpu size={20} /> <span><strong>Firmware</strong> included with every unit</span></div>
            </section>

            <section id="catalogue" className="section">
                <div className="section-head">
                    <div>
                        <span className="eyebrow mono">// catalogue</span>
                        <h2>{category === 'All' ? 'The full fleet' : category}</h2>
                    </div>
                    <label className="select">
                        <span className="sr-only">Sort</span>
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
                            {c}
                            <span className="chip-count mono">
                                {c === 'All' ? products.length : products.filter((p) => p.categories?.includes(c)).length}
                            </span>
                        </button>
                    ))}
                </div>

                {loading && <Spinner label="Loading fleet" />}
                {error && (
                    <div className="alert alert-error">
                        Catalogue unavailable: {error}. Check the <Link to="/status">status page</Link>.
                    </div>
                )}
                {!loading && !error && (
                    <div className="grid">
                        {visible.map((p, i) => (
                            <ProductCard key={p.sku} product={p} index={i} />
                        ))}
                    </div>
                )}
            </section>
        </>
    );
}
