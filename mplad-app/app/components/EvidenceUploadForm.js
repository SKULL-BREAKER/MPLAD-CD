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
             <button type="button" onClick={takePhoto} className="clay-btn clay-btn-success" style={{ padding: '8px 16px', fontSize: '0.8rem' }}>Take Photo</button>
             <button type="button" onClick={cancelCamera} className="clay-btn clay-btn-danger" style={{ padding: '8px 16px', fontSize: '0.8rem' }}>Cancel</button>
          </div>
        </div>
      ) : photoPreview ? (
        <div style={{ position: 'relative', width: '100%', maxWidth: '300px' }}>
          <img src={photoPreview} alt="Preview" style={{ width: '100%', borderRadius: '8px', display: 'block' }} />
          <button type="button" onClick={cancelCamera} className="clay-btn clay-btn-danger" style={{ position: 'absolute', top: '5px', right: '5px', padding: '4px 8px', fontSize: '0.7rem' }}>Remove</button>
          
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
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label className="clay-btn clay-btn-primary" style={{ 
            padding: '8px 16px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' 
          }}>
            Upload Photo
            <input 
              type="file" 
              name="evidence_photo" 
              accept="image/*" 
              capture="environment"
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }} 
            />
          </label>
          
          <button type="button" onClick={startCamera} className="clay-btn clay-btn-primary" style={{ 
            padding: '8px 16px', fontSize: '0.8rem'
          }}>
             Live Camera
          </button>
          <input type="hidden" name="media_type" value="PHOTO" />
        </div>
      )}

      <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', padding: '12px 16px' }}>
        <div>
          {geoLocating ? (
             <span style={{ fontSize: '0.75rem', color: '#9CA3AF' }}>Detecting location...</span>
          ) : coords ? (
            <span style={{ fontSize: '0.75rem', color: '#10B981', fontWeight: 'bold' }}>
              ✓ Location Verified
            </span>
          ) : (
             <span style={{ fontSize: '0.75rem', color: '#C55A5A' }}>
               Geotag required
             </span>
          )}
        </div>
        
        <button 
          className="clay-btn clay-btn-success" 
          disabled={!coords || geoLocating} 
          title={!coords ? "Select a photo or allow location first" : ""}
          style={{ padding: '8px 16px', fontSize: '0.8rem' }}
        >
          Submit Evidence
        </button>
      </div>
      {locationError && <div style={{ color: '#C55A5A', fontSize: '0.7rem', marginTop: '5px' }}>{locationError}</div>}
    </form>
  );
}
