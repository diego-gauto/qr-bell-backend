export default function CallPage({ params }: { params: { callId: string } }): React.JSX.Element {
  return (
    <main style={{ padding: '2rem' }}>
      <h1>Call {params.callId}</h1>
    </main>
  );
}
