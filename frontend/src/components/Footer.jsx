import { useSession } from '../session.jsx';
import Logo from './Logo.jsx';

const STACK = [
    ['React 19', 'frontend'],
    ['Nginx 1.30', 'web / proxy'],
    ['Node.js 24', 'catalogue · user · cart'],
    ['Python 3.14', 'payment'],
    ['Java 25', 'shipping'],
    ['MongoDB 7', 'products · users'],
    ['MySQL 8.4', 'cities'],
    ['Redis 8', 'carts · sessions'],
    ['RabbitMQ 4', 'orders queue']
];

export default function Footer() {
    const { uniqueid } = useSession();
    return (
        <footer className="footer">
            <div className="footer-inner">
                <div className="footer-brand">
                    <Logo size={28} />
                    <div>
                        <strong>RoboShop</strong>
                        <p>A microservices shop for DevOps labs. Every request crosses real services.</p>
                    </div>
                </div>
                <ul className="stack">
                    {STACK.map(([name, role]) => (
                        <li key={name}>
                            <span>{name}</span>
                            <small>{role}</small>
                        </li>
                    ))}
                </ul>
                <div className="footer-meta mono">
                    session <span>{uniqueid ?? '...'}</span>
                </div>
            </div>
        </footer>
    );
}
