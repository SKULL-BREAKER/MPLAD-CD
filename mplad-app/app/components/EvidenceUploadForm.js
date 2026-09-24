'use client';

import { useState } from 'react';
import exifr from 'exifr';

export default function EvidenceUploadForm({ workId, authority, action }) {
  const [geoLocating, setGeoLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [coords, setCoords] = useState(null);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) {
      setCoords(null);
      return;
    }

    setGeoLocating(true);
    setLocationError('');
    setCoords(null);

    try {
      // Extract GPS data from the image EXIF
      const gps = await exifr.gps(file);
      if (gps && gps.latitude != null && gps.longitude != null) {
        setCoords({ lat: gps.latitude, lng: gps.longitude });
      } else {
        setLocationError('Please upload a photo with Geotag/location data. The selected image does not contain GPS coordinates.');
      }
    } catch (err) {
      setLocationError('Failed to read image EXIF data. Ensure the file is an original photo with geotags.');
    } finally {
      setGeoLocating(false);
    }
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
          <option value="PHOTO">PHOTO</option>
          <option value="VIDEO">VIDEO</option>
        </select>
        <input 
          type="file" 
          name="evidence_photo" 
          accept="image/*" 
          required 
          className="input-field" 
          onChange={handleFileChange}
          style={{ flex: 1, minWidth: '150px', padding: '4px', fontSize: '0.75rem', background: 'rgba(0,0,0,0.2)' }} 
        />
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        {geoLocating ? (
           <span style={{ fontSize: '0.75rem', color: '#9CA3AF', padding: '6px 12px' }}>
             Reading image location...
           </span>
        ) : coords ? (
          <span style={{ fontSize: '0.75rem', color: '#10B981', background: 'rgba(16, 185, 129, 0.1)', padding: '6px 12px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            Location Verified ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)})
          </span>
        ) : (
           <span style={{ fontSize: '0.75rem', color: '#EF4444', padding: '6px 12px' }}>
             A geotagged photo is required.
           </span>
        )}
        
        <button 
          className="btn" 
          disabled={!coords || geoLocating} 
          title={!coords ? "Select a geotagged photo first" : ""}
          style={{ background: coords ? '#10B981' : '#374151', color: '#fff', padding: '6px 12px', fontSize: '0.75rem', opacity: coords && !geoLocating ? 1 : 0.5, cursor: coords && !geoLocating ? 'pointer' : 'not-allowed' }}
        >
          Upload Evidence
        </button>
      </div>
      {locationError && <div style={{ color: '#EF4444', fontSize: '0.7rem' }}>{locationError}</div>}
    </form>
  );
}
