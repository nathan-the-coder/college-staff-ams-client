interface SealProps {
  className?: string;
}

// Unique system emblem inspired by the SJCB seal: an institutional shield in
// the school green (#457507) with gold accents. A clock face with a gold
// check-in mark stands for time-in/time-out attendance, over an open book for
// education.
export default function Seal({ className = 'h-10 w-10' }: SealProps) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* Shield */}
      <path
        d="M32 3 55 10.5v17.5c0 15.5-9.5 26.8-23 33C18.5 54.8 9 43.5 9 28V10.5Z"
        fill="#457507"
        stroke="#b08d2e"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* Star */}
      <path
        d="M32 8.4l1.5 3 3.3.5-2.4 2.3.6 3.3-3-1.6-3 1.6.6-3.3-2.4-2.3 3.3-.5 1.5-3z"
        fill="#b08d2e"
      />
      {/* Clock face */}
      <circle cx="32" cy="30.5" r="12" fill="#f6f4ef" />
      <circle cx="32" cy="30.5" r="12" fill="none" stroke="#253d04" strokeWidth="1.1" />
      {/* Ticks at 12/3/6/9 */}
      <path
        d="M32 20.3v2M40.5 30.5h-2M32 40.7v-2M23.5 30.5h2"
        stroke="#253d04"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {/* Check-in mark */}
      <path
        d="M27.2 31.2l3.1 3.1 6.4-7"
        fill="none"
        stroke="#b08d2e"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Open book */}
      <path
        d="M24 46.3c3.2-2 6.4-2 8 0c1.6-2 4.8-2 8 0v4.1c-3.2-1.9-6.4-1.9-8 .2c-1.6-2.1-4.8-2.1-8-.2v-4.1z"
        fill="#f6f4ef"
      />
      <path d="M32 46.3v4.2" stroke="#b08d2e" strokeWidth="0.9" />
    </svg>
  );
}
