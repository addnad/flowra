"use client";

import { useState, useRef, useEffect } from "react";
import { Search, MapPin, Loader2 } from "lucide-react";

interface MapPickerProps {
  onLocationSelect: (lat: number, lon: number, radius: number, label: string) => void;
}

interface Suggestion {
  place_id: string;
  display_name: string;
  lat: string;
  lon: string;
}

function SearchBox({ onPlaceSelect }: { onPlaceSelect: (lat: number, lon: number, label: string) => void }) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  async function handleChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value || value.length < 3) { setSuggestions([]); return; }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(value)}&limit=5&addressdetails=1`,
          { headers: { "Accept-Language": "en", "User-Agent": "Driply/1.0" } }
        );
        const data = await res.json();
        setSuggestions(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }, 400);
  }

  function handleSelect(s: Suggestion) {
    setSuggestions([]);
    setQuery(s.display_name);
    onPlaceSelect(parseFloat(s.lat), parseFloat(s.lon), s.display_name);
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input
          value={query}
          onChange={e => handleChange(e.target.value)}
          placeholder="Search for a location..."
          className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-gray-600 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 animate-spin" />
        )}
      </div>

      {suggestions.length > 0 && (
        <div className="absolute z-[9999] w-full mt-1 bg-[#111111] border border-white/20 rounded-2xl overflow-hidden shadow-2xl" style={{top: "100%", left: 0}}>
          {suggestions.map(s => (
            <button
              key={s.place_id}
              onMouseDown={e => { e.preventDefault(); handleSelect(s); }}
              className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-white/10 transition-colors flex items-center gap-3 border-b border-white/5 last:border-0"
            >
              <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="truncate">{s.display_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function LeafletMap({ center, onMapClick }: {
  center: { lat: number; lng: number } | null;
  onMapClick: (lat: number, lng: number) => void;
}) {
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined" || mapRef.current) return;

    async function initMap() {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      // Fix default marker icons
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(containerRef.current!).setView([6.5244, 3.3792], 12);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      map.on("click", (e: any) => {
        onMapClick(e.latlng.lat, e.latlng.lng);
      });

      mapRef.current = map;
    }

    initMap();
  }, []);

  // Update marker when center changes
  useEffect(() => {
    if (!mapRef.current || !center) return;

    async function updateMarker() {
      const L = (await import("leaflet")).default;
      if (markerRef.current) {
        markerRef.current.setLatLng([center!.lat, center!.lng]);
      } else {
        markerRef.current = L.marker([center!.lat, center!.lng]).addTo(mapRef.current);
      }
      mapRef.current.setView([center!.lat, center!.lng], 15);
    }

    updateMarker();
  }, [center]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}

export function MapPicker({ onLocationSelect }: MapPickerProps) {
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [radius, setRadius] = useState(200);
  const [label, setLabel] = useState("");

  function handlePlaceSelect(lat: number, lon: number, description: string) {
    setCenter({ lat, lng: lon });
    setLabel(description);
    onLocationSelect(lat, lon, radius, description);
  }

  function handleMapClick(lat: number, lng: number) {
    setCenter({ lat, lng });
    const newLabel = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    setLabel(newLabel);
    onLocationSelect(lat, lng, radius, newLabel);
  }

  function handleRadiusChange(val: number) {
    setRadius(val);
    if (center) onLocationSelect(center.lat, center.lng, val, label);
  }

  return (
    <div className="space-y-3">
      <SearchBox onPlaceSelect={handlePlaceSelect} />

      <div className="w-full h-56 rounded-2xl overflow-hidden border border-white/10">
        <LeafletMap center={center} onMapClick={handleMapClick} />
      </div>

      {center && (
        <div className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-gray-400 flex items-center gap-2">
          <MapPin className="w-3 h-3 text-blue-400 shrink-0" />
          <span className="truncate">{label}</span>
        </div>
      )}

      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-2">
          <span>Allowed radius</span>
          <span className="text-white font-medium">
            {radius}m {radius < 100 ? "(very tight)" : radius < 300 ? "(city block)" : radius < 1000 ? "(neighbourhood)" : "(wide area)"}
          </span>
        </div>
        <input
          type="range" min={50} max={5000} step={50} value={radius}
          onChange={e => handleRadiusChange(parseInt(e.target.value))}
          className="w-full accent-blue-500"
        />
        <div className="flex justify-between text-xs text-gray-600 mt-1">
          <span>50m</span><span>5km</span>
        </div>
      </div>
    </div>
  );
}
