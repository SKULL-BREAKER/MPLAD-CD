'use client';

import { useState, useRef } from 'react';
import exifr from 'exifr';

export default function EvidenceUploadForm({ workId, authority, action }) {
  const [geoLocating, setGeoLocating] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [coords, setCoords] = useState(null);
  
  const [cameraActive, setCameraActive] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const requestLocation = (callback) => {
    setGeoLocating(true);
    setLocationError('');
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setGeoLocating(false);
          if(callback) callback();
        },
        (err) => {
          setLocationError('Device location access was denied or failed. Please allow location access.');
          setGeoLocating(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      setLocationError('Device location is not supported by this browser.');
      setGeoLocating(false);
    }
  };

  const startCamera = async () => {
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setLocationError("Failed to access the camera. " + err.message);
      setCameraActive(false);
    }
  };

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Stop stream
      const stream = video.srcObject;
      const tracks = stream.getTracks();
      tracks.forEach(track => track.stop());
      
      const dataUrl = canvas.toDataURL('image/jpeg');
      setPhotoPreview(dataUrl);
      setCameraActive(false);

      // Convert DataURL to File and inject into the form
      canvas.toBlob((blob) => {
        const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
        const dt = new DataTransfer();
        dt.items.add(file);
        if (fileInputRef.current) {
          fileInputRef.current.files = dt.files;
        }
        
        // After taking photo, ask for live location since it has no EXIF
        requestLocation();
      }, 'image/jpeg');
    }
  };

  const cancelCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      stream.getTracks().forEach(track => track.stop());
    }
    setCameraActive(false);
    setPhotoPreview(null);
    setCoords(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) {
      setCoords(null);
      setPhotoPreview(null);
      return;
    }
    
    // Create preview
    setPhotoPreview(URL.createObjectURL(file));

    setGeoLocating(true);
    setLocationError('');
    setCoords(null);

    try {
      const gps = await exifr.gps(file);
      if (gps && gps.latitude != null && gps.longitude != null) {
        setCoords({ lat: gps.latitude, lng: gps.longitude });
        setGeoLocating(false);
      } else {
        requestLocation();
      }
    } catch (err) {
      setLocationError('Failed to read image EXIF data.');
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

      {cameraActive ? (
        <div style={{ position: 'relative', width: '100%', maxWidth: '300px', borderRadius: '8px', overflow: 'hidden', background: '#000' }}>
          <video ref={videoRef} autoPlay playsInline style={{ width: '100%', display: 'block' }}></video>
          <canvas ref={canvasRef} style={{ display: 'none' }}></canvas>
          <div style={{ position: 'absolute', bottom: '10px', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '10px' }}>
             <button type="button" onClick={takePhoto} style={{ background: '#10B981', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>📸 Take Photo</button>
             <button type="button" onClick={cancelCamera} style={{ background: '#EF4444', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      ) : photoPreview ? (
        <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
          <img src={photoPreview} alt="Preview" style={{ width: '100%', borderRadius: '8px', display: 'block' }} />
          <button type="button" onClick={cancelCamera} style={{ position: 'absolute', top: '5px', right: '5px', background: '#EF4444', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.7rem' }}>Remove</button>
          
          <input 
            type="file" 
            name="evidence_photo" 
            accept="image/*" 
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <select name="media_type" style={{ display: 'none' }}><option value="PHOTO">PHOTO</option></select>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <select name="media_type" className="select-field" style={{ width: '110px', padding: '6px 8px', fontSize: '0.75rem', background: 'rgba(0,0,0,0.2)' }}>
            <option value="PHOTO">PHOTO</option>
            <option value="VIDEO">VIDEO</option>
          </select>
          <input 
            type="file" 
            name="evidence_photo" 
            accept="image/*" 
            capture="environment"
            className="input-field" 
            ref={fileInputRef}
            onChange={handleFileChange}
            style={{ flex: 1, minWidth: '150px', padding: '4px', fontSize: '0.75rem', background: 'rgba(0,0,0,0.2)' }} 
          />
          <button type="button" onClick={startCamera} style={{ background: '#3B82F6', color: '#fff', border: 'none', padding: '6px 12px', fontSize: '0.75rem', borderRadius: '4px', cursor: 'pointer' }}>
            📷 Live Camera
          </button>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        {geoLocating ? (
           <span style={{ fontSize: '0.75rem', color: '#9CA3AF', padding: '6px 12px' }}>
             Detecting location...
           </span>
        ) : coords ? (
          <span style={{ fontSize: '0.75rem', color: '#10B981', background: 'rgba(16, 185, 129, 0.1)', padding: '6px 12px', borderRadius: '4px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            Location Verified ({coords.lat.toFixed(4)}, {coords.lng.toFixed(4)})
          </span>
        ) : (
           <span style={{ fontSize: '0.75rem', color: '#EF4444', padding: '6px 12px' }}>
             A geotagged photo or device location is required.
           </span>
        )}
        
        <button 
          className="btn" 
          disabled={!coords || geoLocating} 
          title={!coords ? "Select a photo or allow location first" : ""}
          style={{ background: coords ? '#10B981' : '#374151', color: '#fff', padding: '6px 12px', fontSize: '0.75rem', opacity: coords && !geoLocating ? 1 : 0.5, cursor: coords && !geoLocating ? 'pointer' : 'not-allowed' }}
        >
          Upload Evidence
        </button>
      </div>
      {locationError && <div style={{ color: '#EF4444', fontSize: '0.7rem' }}>{locationError}</div>}
    </form>
  );
}
