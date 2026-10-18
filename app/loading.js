/** Shown at once while the next page is read from the database: the outline of a page, gently pulsing. */
export default function Loading() {
  return (
    <div className="stack loading" aria-busy="true">
      <div className="skeleton" style={{ height: 46 }} />
      <div className="skeleton" style={{ height: 96 }} />
      <div className="skeleton" style={{ height: 220 }} />
      <div className="skeleton" style={{ height: 320 }} />
    </div>
  );
}
