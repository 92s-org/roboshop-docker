import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowRight, MapPin, Route } from 'lucide-react';
import { api, money } from '../api.js';
import { useSession } from '../session.jsx';
import { useToast } from '../toast.jsx';
import CheckoutSteps from '../components/CheckoutSteps.jsx';
import Spinner from '../components/Spinner.jsx';

export default function Shipping() {
    const { cart, cartLoading, uniqueid, setCart } = useSession();
    const toast = useToast();
    const navigate = useNavigate();
    const [countries, setCountries] = useState([]);
    const [country, setCountry] = useState('');
    const [text, setText] = useState('');
    const [matches, setMatches] = useState([]);
    const [city, setCity] = useState(null);
    const [quote, setQuote] = useState(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const cityInput = useRef(null);

    useEffect(() => {
        api('/shipping/codes')
            .then(setCountries)
            .catch((err) => setError(`Shipping service unavailable: ${err.message}`));
    }, []);

    // city auto-complete, the shipping service needs at least 3 characters
    useEffect(() => {
        const term = text.trim();
        if (!country || term.length < 3 || city?.name === text) {
            setMatches([]);
            return;
        }
        const controller = new AbortController();
        const timer = setTimeout(() => {
            api(`/shipping/match/${country}/${encodeURIComponent(term)}`, { signal: controller.signal })
                .then(setMatches)
                .catch(() => setMatches([]));
        }, 250);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [text, country, city]);

    const pickCountry = (code) => {
        setCountry(code);
        setText('');
        setCity(null);
        setQuote(null);
        setTimeout(() => cityInput.current?.focus(), 0);
    };

    const pickCity = async (c) => {
        setCity(c);
        setText(c.name);
        setMatches([]);
        setQuote(null);
        setBusy(true);
        try {
            setQuote(await api(`/shipping/calc/${c.uuid}`));
        } catch (err) {
            toast.error('Could not calculate shipping', err.message);
        } finally {
            setBusy(false);
        }
    };

    const confirm = async () => {
        const countryName = countries.find((c) => c.code === country)?.name ?? country;
        setBusy(true);
        try {
            const updated = await api(`/shipping/confirm/${uniqueid}`, {
                method: 'POST',
                body: { distance: quote.distance, cost: quote.cost, location: `${countryName} ${city.name}` }
            });
            setCart(updated);
            navigate('/checkout/payment');
        } catch (err) {
            toast.error('Could not confirm shipping', err.message);
        } finally {
            setBusy(false);
        }
    };

    if (cartLoading) return <Spinner label="Loading cart" />;

    if (cart.items.filter((i) => i.sku !== 'SHIP').length === 0) {
        return (
            <div className="empty">
                <h2>Nothing to ship</h2>
                <p>Add a robot to your cart first.</p>
                <Link to="/" className="btn btn-primary">Browse the fleet</Link>
            </div>
        );
    }

    return (
        <section className="section">
            <CheckoutSteps current={1} />
            <div className="checkout">
                <div className="panel">
                    <div className="panel-head">
                        <h2>Where should we deploy?</h2>
                    </div>
                    {error && <div className="alert alert-error">{error}</div>}

                    <label className="field">
                        <span>Country</span>
                        <select value={country} onChange={(e) => pickCountry(e.target.value)}>
                            <option value="" disabled>Select a country</option>
                            {countries.map((c) => (
                                <option key={c.code} value={c.code}>{c.name}</option>
                            ))}
                        </select>
                    </label>

                    <label className="field autocomplete">
                        <span>City</span>
                        <div className="input-icon">
                            <MapPin size={17} />
                            <input
                                ref={cityInput}
                                type="text"
                                placeholder={country ? 'Start typing a city (3+ letters)' : 'Pick a country first'}
                                disabled={!country}
                                value={text}
                                onChange={(e) => {
                                    setText(e.target.value);
                                    setCity(null);
                                    setQuote(null);
                                }}
                                autoComplete="off"
                            />
                        </div>
                        {matches.length > 0 && (
                            <ul className="suggest">
                                {matches.map((m) => (
                                    <li key={m.uuid}>
                                        <button type="button" onClick={() => pickCity(m)}>
                                            <span className="suggest-name">{m.name}</span>
                                            <span className="muted small mono">{m.code.toUpperCase()} · region {m.region}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </label>

                    {busy && !quote && <p className="muted mono">Calculating route...</p>}

                    {quote && (
                        <div className="quote">
                            <div className="quote-route">
                                <span className="mono small muted">Hangar 7, DE</span>
                                <span className="quote-line">
                                    <Route size={18} />
                                </span>
                                <span className="mono small muted">{city.name}</span>
                            </div>
                            <div className="quote-figures">
                                <div>
                                    <span className="muted small">Distance</span>
                                    <strong className="mono">{quote.distance.toLocaleString()} km</strong>
                                </div>
                                <div>
                                    <span className="muted small">Shipping cost</span>
                                    <strong className="mono">{money(quote.cost)}</strong>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <aside className="panel summary">
                    <h3>Summary</h3>
                    <dl>
                        <div><dt>Robots</dt><dd className="mono">{money(cart.total)}</dd></div>
                        <div><dt>Shipping</dt><dd className="mono">{quote ? money(quote.cost) : '--'}</dd></div>
                        <div className="summary-total">
                            <dt>Total</dt>
                            <dd className="mono">{money(cart.total + (quote?.cost ?? 0))}</dd>
                        </div>
                    </dl>
                    <button className="btn btn-primary btn-wide" disabled={!quote || busy} onClick={confirm}>
                        Continue to payment <ArrowRight size={18} />
                    </button>
                    <Link to="/cart" className="link-muted">Back to cart</Link>
                </aside>
            </div>
        </section>
    );
}
