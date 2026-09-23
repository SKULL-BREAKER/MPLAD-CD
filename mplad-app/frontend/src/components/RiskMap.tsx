import { useEffect, useState } from 'react';
import { MapContainer, GeoJSON } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate } from 'react-router-dom';

export default function RiskMap({ districts }: { districts: any[] }) {
  const [geoData, setGeoData] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetch('/geo/india_districts_simplified.json')
      .then((res) => res.json())
      .then(setGeoData)
      .catch((err) => {
        console.warn('Failed to load geojson, falling back', err);
      });
  }, []);

  if (!geoData) return (
    <div className="skeleton" style={{ height: '100%', width: '100%', borderRadius: 0 }} aria-label="Loading map" />
  );


  const getStyle = (feature: any) => {
    const geoKey = feature.properties.geo_key || feature.properties.id || feature.properties.dt_name;
    const district = districts.find(d => d.id === geoKey);
    
    if (!district) {
      console.warn(`Geo mismatch for ${geoKey}`);
      return {
        fillColor: '#0f172a',
        weight: 1,
        opacity: 1,
        color: '#1e293b',
        fillOpacity: 0.7
      };
    }

    // ramp #0f172a to #dc2626 based on risk (0 to 100 max let's say)
    // For simplicity, tier-based:
    const color = district.tier === 'CRITICAL' ? '#dc2626' : 
                  district.tier === 'HIGH' ? '#ea580c' : 
                  district.tier === 'MEDIUM' ? '#d97706' : '#64748b';

    return {
      fillColor: color,
      weight: 1,
      opacity: 1,
      color: '#1e293b',
      fillOpacity: 0.7
    };
  };

  const onEachFeature = (feature: any, layer: any) => {
    const geoKey = feature.properties.geo_key || feature.properties.id || feature.properties.dt_name;
    const district = districts.find(d => d.id === geoKey);
    
    if (district) {
      layer.bindTooltip(`${district.name} · ${district.risk} flagged works · ₹${(district.unspent / 10000000).toFixed(2)} Cr unspent`);
      layer.on({
        click: () => {
          navigate(`/district/${district.id}`);
        },
        mouseover: (e: any) => {
          const l = e.target;
          l.setStyle({ fillOpacity: 0.9, weight: 2 });
        },
        mouseout: (e: any) => {
          const l = e.target;
          l.setStyle({ fillOpacity: 0.7, weight: 1 });
        }
      });
    }
  };

  return (
    <div style={{ height: '100%', width: '100%', backgroundColor: '#0f172a' }}>
      <MapContainer 
        center={[20.5937, 78.9629]} 
        zoom={4} 
        style={{ height: '100%', width: '100%', background: 'transparent' }}
        zoomControl={false}
        attributionControl={false}
      >
        <GeoJSON data={geoData} style={getStyle} onEachFeature={onEachFeature} />
      </MapContainer>
    </div>
  );
}
