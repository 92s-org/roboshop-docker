import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api, loadRatings } from '../api.js';
import ProductCard from '../components/ProductCard.jsx';
import Spinner from '../components/Spinner.jsx';

export default function Search() {
    const [params] = useSearchParams();
    const q = params.get('q') || '';
    const [results, setResults] = useState(null);
    const [error, setError] = useState('');
    const [ratings, setRatings] = useState({});

    useEffect(() => {
        loadRatings().then(setRatings);
    }, []);

    useEffect(() => {
        if (!q) return;
        setResults(null);
        setError('');
        api(`/catalogue/search/${encodeURIComponent(q)}`)
            .then(setResults)
            .catch((err) => setError(err.message));
    }, [q]);

    return (
        <section className="section">
            <div className="section-head">
                <div>
                    <h2>Results for "{q}"</h2>
                </div>
                {results && <span className="muted num">{results.length} result{results.length === 1 ? '' : 's'}</span>}
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            {!results && !error && <Spinner label="Searching" />}
            {results?.length === 0 && (
                <div className="empty">
                    <h2>No products found</h2>
                    <p>Try a word like "robot", "AI" or "droid".</p>
                    <Link to="/" className="btn btn-light">Browse everything</Link>
                </div>
            )}
            {results?.length > 0 && (
                <div className="grid">
                    {results.map((p, i) => (
                        <ProductCard key={p.sku} product={p} rating={ratings[p.sku]} index={i} />
                    ))}
                </div>
            )}
        </section>
    );
}
