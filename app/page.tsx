// Minimal landing page — the frontend track owns the real hero/fork/proof-panel design.
// This is just enough for the Connect flow to be exercised end to end: a plain anchor to
// the backend's /api/connect redirect, no next-auth import here at all.
export default function Home() {
  return (
    <section className="hero">
      <h1>See why your channel stalled.</h1>
      <p>Connect your YouTube channel to get one sharp diagnosis, a 12-week growth simulation, and weekly recalibration as real data comes in.</p>
      <a className="button button-dark" href="/api/connect">
        Connect YouTube
      </a>
    </section>
  );
}
