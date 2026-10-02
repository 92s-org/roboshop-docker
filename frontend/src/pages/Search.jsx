import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { api } from '../api.js';
import ProductCard from '../components/ProductCard.jsx';
import Spinner from '../components/Spinner.jsx';

export default function Search() {
    const [params] = useSearchParams();
    const q = params.get('q') || '';
    const [results, setResults] = useState(null);
    const [error, setError] = useState('');

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
                    <span className="eyebrow mono">// search</span>
                    <h2>Results for "{q}"</h2>
                </div>
                {results && <span className="muted mono">{results.length} match{results.length === 1 ? '' : 'es'}</span>}
            </div>
            {error && <div className="alert alert-error">{error}</div>}
            {!results && !error && <Spinner label="Scanning" />}
            {results?.length === 0 && (
                <div className="empty">
                    <h2>No units match</h2>
                    <p>Try a word like "robot", "AI" or "droid".</p>
                    <Link to="/" className="btn btn-ghost">Browse everything</Link>
                </div>
            )}
            {results?.length > 0 && (
                <div className="grid">
                    {results.map((p, i) => (
                        <ProductCard key={p.sku} product={p} index={i} />
                    ))}
                </div>
            )}
        </section>
    );
}
