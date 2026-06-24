// Test fixture for detect.mjs — clean code with no anti-slop patterns
export function CleanCard() {
  return (
    <div className="bg-white rounded-md transition-opacity">
      <h1 className="text-2xl font-semibold">Hello World</h1>
      <button aria-label="View pricing details">See pricing details</button>
    </div>
  );
}
