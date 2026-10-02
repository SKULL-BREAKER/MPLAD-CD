export default function Loading() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh', padding: '24px',
    }}>
      <style>{`
        .loader {
          width: 48px;
          height: 48px;
          border: 4px solid var(--surface-3, #E2E8F0);
          border-bottom-color: var(--primary, #10B981);
          border-radius: 50%;
          display: inline-block;
          box-sizing: border-box;
          animation: rotation 1s linear infinite;
        }
        @keyframes rotation {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
      <span className="loader"></span>
      <p style={{ marginTop: '20px', color: 'var(--text-muted, #64748B)', fontWeight: 600, letterSpacing: '1px' }}>
        LOADING SECURE DATA...
      </p>
    </div>
  );
}
