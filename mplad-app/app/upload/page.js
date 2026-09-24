import EvidenceUploadForm from '../components/EvidenceUploadForm';

export default function PhotoUploadDemo() {
  async function mockUploadAction(formData) {
    'use server';
    const lat = formData.get('latitude');
    const lng = formData.get('longitude');
    const authority = formData.get('authority');
    console.log(`[Photo Upload Demo] Uploaded as ${authority} with GPS (${lat}, ${lng})`);
  }

  return (
    <main style={{ maxWidth: '800px', margin: '60px auto', padding: '0 20px', fontFamily: 'var(--font-geist-sans)' }}>
      <h1 style={{ fontSize: '2rem', marginBottom: '16px', color: 'var(--text-main)' }}>Geo-Tagged Photo Upload Simulator</h1>
      <p style={{ color: 'var(--text-muted)', marginBottom: '32px', lineHeight: 1.6 }}>
        This page demonstrates the strict EXIF geolocation requirement for the MPLADS platform. 
        Select any photo. If it contains embedded GPS coordinates (geotags), the upload will be permitted.
        If it does not contain EXIF location data, the upload will be blocked.
      </p>

      <div className="glass-card" style={{ padding: '32px', borderLeft: '4px solid var(--accent)' }}>
        <h2 style={{ fontSize: '1.2rem', marginBottom: '24px', color: 'var(--accent)' }}>Test Evidence Upload</h2>
        <EvidenceUploadForm workId="DEMO-WORK-ID" authority="TEST_USER" action={mockUploadAction} />
      </div>

      <div style={{ marginTop: '48px', padding: '24px', background: 'rgba(56,189,248,0.05)', borderRadius: '12px', border: '1px solid rgba(56,189,248,0.1)' }}>
        <h3 style={{ fontSize: '1rem', color: '#38BDF8', marginBottom: '12px' }}>How this works</h3>
        <ul style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: 1.7, paddingLeft: '20px' }}>
          <li>The browser uses <code>exifr</code> to parse the file locally before it is ever sent to the server.</li>
          <li>We check for <code>GPSLatitude</code> and <code>GPSLongitude</code> tags within the EXIF metadata.</li>
          <li>This ensures that only photos captured via a device's native camera with location services enabled are allowed.</li>
          <li>This prevents officers or public users from uploading downloaded or stripped images to falsify asset completion.</li>
        </ul>
      </div>
    </main>
  );
}
