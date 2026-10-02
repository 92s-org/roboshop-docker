export default function Spinner({ label = 'Loading' }) {
    return (
        <div className="spinner-wrap" role="status">
            <span className="spinner" />
            <span className="mono">{label}...</span>
        </div>
    );
}
