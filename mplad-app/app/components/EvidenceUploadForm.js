'use client';

import { useState } from 'react';

export default function EvidenceUploadForm({ workId, authority, action }) {
  const [geoLocating, setGeoLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [coords, setCoords] = useState(null);

  const handleCaptureLocation = () => {
    setGeoLocating(true);
    setLocationError('');
    if (!navigator.geolocation) {
      setLocationError('Geolocation not supported by browser.');
      setGeoLocating(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoLocating(false);
      },
      (err) => {
        setLocationError('Failed to get location: ' + err.message);
        setGeoLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
      <input type="hidden" name="work_id" value={workId} />
      <input type="hidden" name="authority" value={authority} />
      {coords && (
        <>
          <input type="hidden" name="latitude" value={coords.lat} />
          <input type="hidden" name="longitude" value={coords.lng} />
        </>
      )}

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
        <select name="media_type" className="select-field" style={{ width: '110px', padding: '6px 8px', fontSize: '0.75rem', background: 'rgba(0,0,0,0.2)' }}>
          <option value="PHOTO">📷 PHOTO</option>
          <option value="VIDEO">🎥 VIDEO</option>
        </select>
        <input type="file" name="evidence_photo" accept="image/*" required className="input-field" style={{ flex: 1, minWidth: '150px', padding: '4px', fontSize: '0.75rem', background: 'rgba(0,0,0,0.2)' }} />
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        {!coords ? (
          <button type="button" onClick={handleCaptureLocation} disabled={geoLocating} className="btn" style={{ background: '#374151', padding: '6px 12px', fontSize: '0.75rem', border: '1px solid #4B5563' }}>
            {geoLocating ? '📍 Locating...' : '📍 Capture Live Location'}
          </button>
        ) : (
          <span style={{ fontSize: '0.75rem', color: '#10B981', background: 'rgba(16, 185, 129, 0.1)', padding: '6px 12px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            ✓ Location Captured ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)})
          </span>
        )}
        <button 
          className="btn" 
          disabled={!coords} 
          title={!coords ? "Capture location first" : ""}
          style={{ background: coords ? '#10B981' : '#374151', color: '#fff', padding: '6px 12px', fontSize: '0.75rem', opacity: coords ? 1 : 0.5, cursor: coords ? 'pointer' : 'not-allowed' }}
        >
          Upload Evidence
        </button>
      </div>
      {locationError && <div style={{ color: '#EF4444', fontSize: '0.7rem' }}>{locationError}</div>}
    </form>
  );
}
