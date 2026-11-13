import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page">
      <section className="card empty" role="alert">
        <strong>404 · Page Not Found</strong>
        <p>The link may be broken, or the order does not belong to the current account (for privacy, the existence of other accounts&apos; orders is never revealed).</p>
        <p><Link className="button" href="/">Back to Home</Link></p>
      </section>
    </main>
  );
}
