// Root application shell. Feature components will be mounted here.
export function App() {
  return (
    <main>
      <h1>👻 Ghost Theremin</h1>
      {/* aria-live region for screen-reader state announcements (WCAG 4.1.3) */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" id="status-announcer" />
      <p>Scaffold placeholder — features coming soon.</p>
    </main>
  );
}
