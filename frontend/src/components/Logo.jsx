export default function Logo({ size = 30 }) {
    return (
        <svg className="logo-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
            <rect x="2" y="2" width="60" height="60" rx="18" fill="var(--ink)" />
            <rect x="15" y="22" width="34" height="24" rx="8" fill="var(--accent)" />
            <circle cx="26" cy="34" r="3.6" fill="var(--ink)" />
            <circle cx="38" cy="34" r="3.6" fill="var(--ink)" />
            <rect x="30" y="12" width="4" height="10" rx="2" fill="var(--accent)" />
        </svg>
    );
}
