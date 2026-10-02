import { Link, Route, Routes } from 'react-router';
import Header from './components/Header.jsx';
import Footer from './components/Footer.jsx';
import Home from './pages/Home.jsx';
import Product from './pages/Product.jsx';
import Search from './pages/Search.jsx';
import Cart from './pages/Cart.jsx';
import Shipping from './pages/Shipping.jsx';
import Payment from './pages/Payment.jsx';
import Account from './pages/Account.jsx';
import Status from './pages/Status.jsx';

function NotFound() {
    return (
        <div className="empty">
            <span className="eyebrow mono">error 404</span>
            <h2>This sector is empty</h2>
            <p>The page you are looking for does not exist.</p>
            <Link to="/" className="btn btn-primary">Back to the fleet</Link>
        </div>
    );
}

export default function App() {
    return (
        <div className="app">
            <Header />
            <main className="main">
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/product/:sku" element={<Product />} />
                    <Route path="/search" element={<Search />} />
                    <Route path="/cart" element={<Cart />} />
                    <Route path="/checkout/shipping" element={<Shipping />} />
                    <Route path="/checkout/payment" element={<Payment />} />
                    <Route path="/account" element={<Account />} />
                    <Route path="/status" element={<Status />} />
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </main>
            <Footer />
        </div>
    );
}
