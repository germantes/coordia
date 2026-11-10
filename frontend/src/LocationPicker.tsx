import { useEffect, useRef } from 'react';
import L from 'leaflet';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIconRetina from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

interface LocationPickerProps {
  value: Coordinates | null;
  onChange: (coordinates: Coordinates) => void;
}

const defaultLocation: Coordinates = { latitude: 40.4168, longitude: -3.7038 };

export default function LocationPicker({ value, onChange }: LocationPickerProps) {
  const mapElement = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const marker = useRef<any>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    if (!mapElement.current || map.current) return;

    const initial = valueRef.current ?? defaultLocation;
    L.Icon.Default.mergeOptions({
      iconUrl: markerIcon,
      iconRetinaUrl: markerIconRetina,
      shadowUrl: markerShadow,
    });
    const instance = L.map(mapElement.current).setView([initial.latitude, initial.longitude], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(instance);

    map.current = instance;
    instance.on('click', (event: { latlng: { lat: number; lng: number } }) => {
      onChangeRef.current({ latitude: event.latlng.lat, longitude: event.latlng.lng });
    });

    const resizeObserver = new ResizeObserver(() => instance.invalidateSize());
    resizeObserver.observe(mapElement.current);
    return () => {
      resizeObserver.disconnect();
      instance.remove();
      map.current = null;
      marker.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current || !value) return;
    const point: [number, number] = [value.latitude, value.longitude];
    if (marker.current) marker.current.setLatLng(point);
    else marker.current = L.marker(point).addTo(map.current);
    map.current.panTo(point);
  }, [value]);

  return <div className="map-picker" ref={mapElement} aria-label="Mapa para seleccionar la ubicación del incidente" />;
}
