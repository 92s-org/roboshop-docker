import { Link } from 'react-router';
import { useSession } from '../session.jsx';
import Logo from './Logo.jsx';

// the real tech stack, handy for the DevOps labs
const STACK = ['React 19', 'Nginx 1.30', 'Node.js 24', 'Python 3.14', 'Java 25', 'MongoDB 7', 'MySQL 8.4', 'Redis 8', 'RabbitMQ 4'];

export default function Footer() {
    const { uniqueid } = useSession();
    return (
        <footer className="footer">
            <div className="footer-inner">
                <div className="footer-brand">
                    <Link to="/" className="brand">
                        <Logo />
                        <span className="brand-text">RoboShop</span>
                    </Link>
                    <p>Robots and AI assistants for home, work and the far side of the galaxy.</p>
                </div>
                <div className="footer-col">
                    <h4>Shop</h4>
                    <Link to="/">All products</Link>
                    <Link to="/?cat=Artificial%20Intelligence">AI assistants</Link>
                    <Link to="/?cat=Robot">Robots</Link>
                </div>
                <div className="footer-col">
                    <h4>Account</h4>
                    <Link to="/account">Sign in / Register</Link>
                    <Link to="/account">Order history</Link>
                    <Link to="/cart">Cart</Link>
                </div>
                <div className="footer-col">
                    <h4>Help</h4>
                    <Link to="/status">System status</Link>
                    <span>Shipping from Germany</span>
                    <span>30-day returns</span>
                </div>
            </div>
            <div className="footer-bottom">
                <div className="footer-bottom-inner">
                    <span>© 2026 RoboShop · a microservices demo shop</span>
                    <span className="stack">
                        {STACK.map((s) => <span key={s}>{s}</span>)}
                    </span>
                    <span className="muted">session: {uniqueid ?? '...'}</span>
                </div>
            </div>
        </footer>
    );
}
