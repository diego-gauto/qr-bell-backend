import Link from 'next/link';

export default function HomePage(): React.JSX.Element {
  return (
    <main style={{ padding: '2rem' }}>
      <h1>QR Bell</h1>
      <p>Stage 0 scaffold ready.</p>
      <ul>
        <li>
          <Link href="/ring">Visitor ring page</Link>
        </li>
        <li>
          <Link href="/login">Owner login</Link>
        </li>
      </ul>
    </main>
  );
}
