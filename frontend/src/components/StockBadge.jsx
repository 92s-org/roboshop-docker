export default function StockBadge({ instock }) {
    if (instock === 0) return <span className="stock stock-out">Out of stock</span>;
    if (instock <= 2) return <span className="stock stock-low">Only {instock} left - order soon</span>;
    return <span className="stock stock-ok">In stock, ready to ship</span>;
}
