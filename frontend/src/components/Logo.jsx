export default function Logo({ size = 34 }) {
    return (
        <svg className="logo-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
            <polygon points="32,3 57,17.5 57,46.5 32,61 7,46.5 7,17.5" fill="none" stroke="currentColor" strokeWidth="4" />
            <rect x="20" y="22" width="24" height="18" rx="3" fill="currentColor" />
            <circle cx="27" cy="31" r="3" fill="var(--bg)" />
            <circle cx="37" cy="31" r="3" fill="var(--rust)" />
            <rect x="29" y="14" width="6" height="8" fill="currentColor" />
            <rect x="24" y="43" width="16" height="4" fill="currentColor" />
        </svg>
    );
}
