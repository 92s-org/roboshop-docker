import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

// each service health endpoint, called through nginx like the shop does
const SERVICES = [
    { name: 'frontend', tech: 'Nginx', url: '/health', deps: [] },
    { name: 'catalogue', tech: 'Node.js', url: '/api/catalogue/health', deps: ['mongodb'] },
    { name: 'user', tech: 'Node.js', url: '/api/user/health', deps: ['mongodb', 'redis'] },
    { name: 'cart', tech: 'Node.js', url: '/api/cart/health', deps: ['redis', 'catalogue'] },
    { name: 'shipping', tech: 'Java', url: '/api/shipping/actuator/health', deps: ['mysql', 'cart'] },
    { name: 'payment', tech: 'Python', url: '/api/payment/health', deps: ['rabbitmq', 'user', 'cart'] }
];

async function probe(service) {
    const started = performance.now();
    try {
        const res = await fetch(service.url, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
        const text = await res.text();
        let body = text;
        try {
            body = JSON.stringify(JSON.parse(text), null, 2);
        } catch {
            // not JSON (nginx stub_status, HTML error page)
        }
        if ((res.headers.get('content-type') || '').includes('html')) body = `${res.status} ${res.statusText}`;
        return { code: res.status, ok: res.ok, ms: Math.round(performance.now() - started), body: body.trim() };
    } catch (err) {
        return { code: 0, ok: false, ms: Math.round(performance.now() - started), body: err.message };
    }
}

export default function Status() {
    const [results, setResults] = useState({});
    const [checkedAt, setCheckedAt] = useState(null);
    const [running, setRunning] = useState(false);

    const check = useCallback(async () => {
        setRunning(true);
        const entries = await Promise.all(SERVICES.map(async (s) => [s.name, await probe(s)]));
        setResults(Object.fromEntries(entries));
        setCheckedAt(new Date());
        setRunning(false);
    }, []);

    useEffect(() => {
        check();
        const timer = setInterval(check, 10000);
        return () => clearInterval(timer);
    }, [check]);

    const up = Object.values(results).filter((r) => r.ok).length;

    return (
        <section className="section">
            <div className="section-head">
                <div>
                                        <h2>System status</h2>
                    <p className="muted">
                        Live health checks for every microservice, refreshed every 10 seconds.
                        Stop a container and watch it go red.
                    </p>
                </div>
                <div className="status-summary">
                    <span className={`big-dot ${up === SERVICES.length ? 'ok' : 'bad'}`} />
                    <span className="num">{up}/{SERVICES.length} healthy</span>
                    <button className="btn btn-light" onClick={check} disabled={running}>
                        <RefreshCw size={16} className={running ? 'spin' : ''} /> Recheck
                    </button>
                </div>
            </div>

            <div className="status-grid">
                {SERVICES.map((s) => {
                    const r = results[s.name];
                    const state = !r ? 'wait' : r.ok ? 'ok' : 'bad';
                    return (
                        <article key={s.name} className={`card status-card ${state}`}>
                            <header>
                                <span className={`dot ${state}`} />
                                <h3>{s.name}</h3>
                                <span className="tag">{s.tech}</span>
                            </header>
                            <div className="status-meta num">
                                <span>GET {s.url}</span>
                                <span>
                                    {r ? `${r.code || 'ERR'} · ${r.ms} ms` : '...'}
                                </span>
                            </div>
                            {s.deps.length > 0 && (
                                <div className="deps">
                                    depends on {s.deps.map((d) => <span key={d} className="num">{d}</span>)}
                                </div>
                            )}
                            <pre className="code">{r?.body || 'waiting...'}</pre>
                        </article>
                    );
                })}
            </div>
            {checkedAt && <p className="muted small num">last check {checkedAt.toLocaleTimeString()}</p>}
        </section>
    );
}
