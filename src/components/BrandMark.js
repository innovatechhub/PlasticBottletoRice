// EcoRice leaf mark, used next to the name in headers and loading screens.
export default function BrandMark({ size = 24, className = "eco-brand-mark" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="currentColor"
        d="M20.5 3.5C11 3.2 4.6 7.6 4.1 15.1c-.1 1.3.1 2.6.5 3.8L3 20.5l1.1 1.1 1.7-1.7c1.1.4 2.3.6 3.6.5 7.4-.5 11.6-6.9 11.1-16.9Zm-11.6 15c-.6 0-1.2-.1-1.7-.2 2.2-3.7 5.4-6.9 9.2-9.3l-.8-1.3c-4 2.5-7.3 5.8-9.6 9.6-.2-.6-.2-1.2-.2-1.8.4-5.6 4.8-9.3 12.2-9.6.1 7.7-3.4 12.3-9.1 12.6Z"
      />
    </svg>
  );
}
