// Slop fixture: animation without prefers-reduced-motion + bounce easing + img-no-alt
// Expected: a11y + anti-slop violations → low score

export default function AnimatedBanner() {
  return (
    <div
      style={{
        animation: 'slideIn 0.5s ease-in-out',
        transition: 'all 0.3s bounce',
      }}
    >
      <img src="/promo.jpg" width={600} height={200} />
      <h2 className="animate-bounce text-3xl">Limited Offer!</h2>
    </div>
  );
}

// No @media (prefers-reduced-motion) anywhere in this file
