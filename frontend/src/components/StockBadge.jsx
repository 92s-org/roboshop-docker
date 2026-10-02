export default function StockBadge({ instock }) {
    if (instock === 0) return <span className="stock stock-out">Sold out</span>;
    if (instock <= 2) return <span className="stock stock-low">Only {instock} left</span>;
    return <span className="stock stock-ok">{instock} in stock</span>;
}
