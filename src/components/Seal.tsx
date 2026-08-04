interface SealProps {
  className?: string;
}

// Institutional crest: a shield with an open book and a star, used across the
// public scanner page, the admin login, and the sidebar.
export default function Seal({ className = 'h-10 w-10' }: SealProps) {
  return (
    <svg
      viewBox="0 0 48 60"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M24 3 43 11v16c0 13.5-8 22.5-19 28C13 49.5 5 40.5 5 27V11L24 3z"
        fill="#253d04"
        stroke="#b08d2e"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 17.2c4.2-2.1 8.4-1.9 11.5.9 3.1-2.8 7.3-3 11.5-.9v4.6c-4.1-2-8.3-1.9-11.5.8-3.2-2.7-7.4-2.8-11.5-.8v-4.6z"
        fill="#f6f4ef"
      />
      <path
        d="M12.5 21.8v17.4c4.1-2 8.3-2.1 11.5.6 3.2-2.7 7.4-2.6 11.5-.6V21.8c-4.2-1.9-8.4-1.8-11.5.9-3.1-2.7-7.3-2.8-11.5-.9z"
        fill="#f6f4ef"
      />
      <path
        d="M24 21.9v18"
        stroke="#b08d2e"
        strokeWidth="1.1"
      />
      <path
        d="M24 15.2l1.5 3 3.3.5-2.4 2.3.6 3.3-3-1.6-3 1.6.6-3.3-2.4-2.3 3.3-.5 1.5-3z"
        fill="#b08d2e"
      />
    </svg>
  );
}
