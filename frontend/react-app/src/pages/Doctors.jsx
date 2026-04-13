import { useEffect, useRef, useState } from 'react'
import { aiApi } from '../api'

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_KEY
const SPECIALTIES = ['All', 'Cardiologist', 'Pulmonologist', 'Neurologist', 'Gastroenterologist',
  'General Physician', 'Psychiatrist', 'Dermatologist', 'Urologist', 'Endocrinologist', 'Rheumatologist']

function StarRating({ rating }) {
  return (
    <div className="star-rating">
      {[1, 2, 3, 4, 5].map((s) => (
        <span key={s} style={{ color: s <= Math.round(rating) ? '#f59e0b' : '#d1d5db' }}>★</span>
      ))}
      <span className="rating-num">{Number(rating).toFixed(1)}</span>
    </div>
  )
}

function AiDoctorCard({ doc }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <article className="doctor-card glass-card">
      <div className="doctor-card-header">
        <div className="doctor-avatar">{doc.name.split(' ').slice(-1)[0][0]}</div>
        <div className="doctor-info">
          <h3 style={{ margin: '0 0 4px' }}>{doc.name}</h3>
          <p className="eyebrow">{doc.specialty}</p>
          <StarRating rating={doc.rating} />
        </div>
        <div className="doctor-meta-right">
          <div className="exp-badge">{doc.experience_years}y exp</div>
          <p className="muted" style={{ fontSize: '0.78rem' }}>{doc.reviews} reviews</p>
        </div>
      </div>
      <div className="doctor-tags">
        {doc.qualifications.map((q) => <span key={q} className="tag tag-blue">{q}</span>)}
      </div>
      <div className="doctor-details">
        <p className="muted">🏥 {doc.hospital}</p>
        <p className="muted">📅 {doc.availability}</p>
        <p className="muted">🗣 {doc.languages.join(', ')}</p>
      </div>
      {expanded && (
        <div className="doctor-expanded">
          <p>{doc.bio}</p>
          <p className="muted">Insurance: {doc.accepts_insurance ? '✅ Accepted' : '❌ Not accepted'}</p>
          {doc.match_reasons?.length > 0 && (
            <div>
              <p className="ai-section-label">Matched for</p>
              <div className="tag-row">{doc.match_reasons.map((r) => <span key={r} className="tag">{r}</span>)}</div>
            </div>
          )}
          {doc.urgency_note && (
            <p className="urgency-note" style={{ borderLeftColor: '#f59e0b' }}>{doc.urgency_note}</p>
          )}
        </div>
      )}
      <button className="ghost-button" style={{ marginTop: 8, width: '100%' }} onClick={() => setExpanded(v => !v)}>
        {expanded ? 'Show less ▲' : 'View details ▼'}
      </button>
    </article>
  )
}

function PlaceCard({ place, onSelect, selected }) {
  const isOpen = place.opening_hours?.open_now
  return (
    <article
      className={`doctor-card glass-card place-card ${selected ? 'place-card-selected' : ''}`}
      onClick={() => onSelect(place)}
      style={{ cursor: 'pointer' }}
    >
      <div className="doctor-card-header">
        <div className="doctor-avatar" style={{
          background: place.types?.includes('hospital')
            ? 'linear-gradient(135deg,#e85d3f,#d97757)'
            : 'linear-gradient(135deg,#14334a,#2a7c89)',
          fontSize: '1.2rem'
        }}>
          {place.types?.includes('hospital') ? '🏥' : '👨‍⚕️'}
        </div>
        <div className="doctor-info">
          <h3 style={{ margin: '0 0 2px', fontSize: '0.95rem' }}>{place.name}</h3>
          <p className="muted" style={{ fontSize: '0.78rem', margin: 0 }}>{place.vicinity}</p>
          {place.rating && <StarRating rating={place.rating} />}
        </div>
        <div className="doctor-meta-right">
          {place.user_ratings_total && <div className="exp-badge">{place.user_ratings_total} reviews</div>}
          {isOpen !== undefined && (
            <p style={{ fontSize: '0.72rem', color: isOpen ? '#22c55e' : '#ef4444', margin: '4px 0 0', fontWeight: 700 }}>
              {isOpen ? '● Open' : '● Closed'}
            </p>
          )}
        </div>
      </div>
      {place.distance != null && (
        <p className="muted" style={{ fontSize: '0.78rem', margin: '6px 0 0' }}>
          📍 {place.distance < 1000 ? `${Math.round(place.distance)}m away` : `${(place.distance / 1000).toFixed(1)}km away`}
        </p>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <a
          href={`https://www.google.com/maps/place/?q=place_id:${place.place_id}`}
          target="_blank" rel="noreferrer"
          className="ghost-button"
          style={{ flex: 1, textAlign: 'center', textDecoration: 'none', fontSize: '0.82rem' }}
          onClick={e => e.stopPropagation()}
        >
          🗺 Directions
        </a>
      </div>
    </article>
  )
}

function NearbyTab() {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const markersRef = useRef([])
  const infoWindowRef = useRef(null)

  const [places, setPlaces] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [specialty, setSpecialty] = useState('All')
  const [search, setSearch] = useState('')
  const [radius, setRadius] = useState(5000)
  const [mapReady, setMapReady] = useState(false)
  const [userLoc, setUserLoc] = useState(null)

  useEffect(() => {
    if (!MAPS_KEY || MAPS_KEY === 'YOUR_GOOGLE_MAPS_API_KEY') {
      setError('Add VITE_GOOGLE_MAPS_KEY to frontend/.env and restart the dev server.')
      return
    }
    if (window.google?.maps?.Map) { initMap(); return }
    if (document.querySelector('#gmaps-script')) {
      // Script already injected, wait for it
      const interval = setInterval(() => {
        if (window.google?.maps?.Map) { clearInterval(interval); initMap() }
      }, 100)
      return
    }
    const script = document.createElement('script')
    script.id = 'gmaps-script'
    script.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_KEY}&libraries=places,geometry&loading=async`
    script.async = true
    script.onload = () => initMap()
    script.onerror = () => setError('Failed to load Google Maps. Check your API key restrictions — add http://localhost:5174/* to allowed referrers.')
    document.head.appendChild(script)
  }, [])

  const initMap = () => {
    if (!mapRef.current) return
    mapInstanceRef.current = new window.google.maps.Map(mapRef.current, {
      zoom: 13,
      center: { lat: 40.7128, lng: -74.006 },
      mapTypeControl: false,
      streetViewControl: false,
    })
    infoWindowRef.current = new window.google.maps.InfoWindow()
    setMapReady(true)
    getLocation()
  }

  const getLocation = () => {
    if (!navigator.geolocation) { setError('Geolocation not supported.'); return }
    setLoading(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserLoc(loc)
        mapInstanceRef.current?.setCenter(loc)
        new window.google.maps.Marker({
          position: loc, map: mapInstanceRef.current,
          icon: { path: window.google.maps.SymbolPath.CIRCLE, scale: 10, fillColor: '#e85d3f', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 3 },
          title: 'You', zIndex: 999,
        })
        searchPlaces(loc, specialty, radius)
      },
      err => { setLoading(false); setError(`Location denied: ${err.message}`) },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const searchPlaces = async (loc, spec, rad) => {
    if (!mapInstanceRef.current) return
    setLoading(true); setPlaces([])
    markersRef.current.forEach(m => m.setMap(null)); markersRef.current = []

    try {
      const { Place } = await window.google.maps.importLibrary('places')
      const { AdvancedMarkerElement } = await window.google.maps.importLibrary('marker').catch(() => ({ AdvancedMarkerElement: null }))
      const keyword = spec === 'All' ? 'doctor OR hospital OR clinic' : `${spec} doctor`
      const center = new window.google.maps.LatLng(loc.lat, loc.lng)

      const request = {
        fields: ['displayName', 'location', 'businessStatus', 'rating', 'userRatingCount', 'formattedAddress', 'types', 'id', 'regularOpeningHours', 'nationalPhoneNumber'],
        locationRestriction: { center: { lat: loc.lat, lng: loc.lng }, radius: rad },
        includedPrimaryTypes: spec === 'All' ? ['doctor', 'hospital', 'medical_clinic', 'pharmacy'] : ['doctor', 'medical_clinic'],
        maxResultCount: 20,
      }

      const { places: results } = await Place.searchNearby(request)
      setError('')

      const sorted = results.map(p => ({
        place_id: p.id,
        name: p.displayName,
        vicinity: p.formattedAddress,
        rating: p.rating,
        user_ratings_total: p.userRatingCount,
        types: p.types,
        geometry: { location: p.location },
        opening_hours: p.regularOpeningHours ? { open_now: p.regularOpeningHours.isOpen?.() } : undefined,
        formatted_phone_number: p.nationalPhoneNumber,
        distance: window.google.maps.geometry.spherical.computeDistanceBetween(center, p.location),
      })).sort((a, b) => ((b.rating || 0) * 100 + (b.user_ratings_total || 0) * 0.01) - ((a.rating || 0) * 100 + (a.user_ratings_total || 0) * 0.01))

      setPlaces(sorted)

      sorted.forEach((place, i) => {
        const marker = new window.google.maps.Marker({
          position: place.geometry.location,
          map: mapInstanceRef.current,
          title: place.name,
          icon: { url: place.types?.includes('hospital') ? 'https://maps.google.com/mapfiles/ms/icons/red-dot.png' : 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png' },
          label: { text: `${i + 1}`, color: 'white', fontSize: '11px', fontWeight: 'bold' },
        })
        marker.addListener('click', () => {
          infoWindowRef.current.setContent(`<div style="padding:8px;max-width:200px"><strong>${place.name}</strong><br/><small>${place.vicinity}</small>${place.rating ? `<br/>★ ${place.rating} (${place.user_ratings_total})` : ''}</div>`)
          infoWindowRef.current.open(mapInstanceRef.current, marker)
          setSelectedPlace(place)
        })
        markersRef.current.push(marker)
      })

      const bounds = new window.google.maps.LatLngBounds()
      sorted.forEach(p => bounds.extend(p.geometry.location))
      bounds.extend(center)
      mapInstanceRef.current.fitBounds(bounds)
    } catch (e) {
      setError(`Search failed: ${e.message}. Make sure Places API (New) is enabled in Google Cloud Console.`)
    } finally {
      setLoading(false)
    }
  }

  const filtered = places.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.vicinity?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="page-stack">
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="specialty-filter">
          {SPECIALTIES.slice(0, 6).map(s => (
            <button key={s} className={`filter-btn ${specialty === s ? 'filter-btn-active' : ''}`}
              onClick={() => { setSpecialty(s); if (userLoc) searchPlaces(userLoc, s, radius) }}>{s}</button>
          ))}
        </div>
        <select value={radius} onChange={e => { setRadius(Number(e.target.value)); if (userLoc) searchPlaces(userLoc, specialty, Number(e.target.value)) }}
          style={{ padding: '6px 12px', borderRadius: 12, border: '1px solid rgba(16,36,58,0.14)', background: 'rgba(255,255,255,0.9)', fontSize: '0.82rem' }}>
          <option value={1000}>1 km</option>
          <option value={2000}>2 km</option>
          <option value={5000}>5 km</option>
          <option value={10000}>10 km</option>
          <option value={20000}>20 km</option>
        </select>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter results…"
          style={{ flex: 1, minWidth: 160 }} />
        <button className="secondary-button" onClick={getLocation} disabled={loading || !mapReady}>
          📍 {loading ? 'Searching…' : 'Near Me'}
        </button>
      </div>

      {error && (
        <div className="alert-banner" style={{ borderLeftColor: '#ef4444', background: 'rgba(239,68,68,0.06)' }}>
          <span>⚠️</span><p className="muted" style={{ margin: 0 }}>{error}</p>
        </div>
      )}

      <div className="map-layout">
        <div className="map-container glass-card" style={{ padding: 0, overflow: 'hidden' }}>
          {!mapReady && !error && (
            <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#5f7489' }}>
              Loading map…
            </div>
          )}
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        </div>
        <div className="map-list">
          {loading && <p className="muted" style={{ textAlign: 'center', padding: 20 }}>Searching nearby…</p>}
          {!loading && !error && filtered.length === 0 && (
            <div className="glass-card" style={{ padding: 20, textAlign: 'center' }}>
              <p className="muted">Click "📍 Near Me" to find doctors and hospitals near you.</p>
            </div>
          )}
          {filtered.map(place => (
            <PlaceCard key={place.place_id} place={place}
              selected={selectedPlace?.place_id === place.place_id}
              onSelect={p => { setSelectedPlace(p); mapInstanceRef.current?.panTo(p.geometry.location); mapInstanceRef.current?.setZoom(16) }}
            />
          ))}
        </div>
      </div>
      {places.length > 0 && (
        <p className="muted" style={{ fontSize: '0.78rem' }}>
          🔵 Doctor &nbsp;🔴 Hospital &nbsp;· Sorted by rating · {filtered.length} results within {radius / 1000}km
        </p>
      )}
    </div>
  )
}

export default function Doctors() {
  const [tab, setTab] = useState('ai')
  const [aiDoctors, setAiDoctors] = useState([])
  const [symptoms, setSymptoms] = useState('')
  const [specialty, setSpecialty] = useState('All')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    aiApi.doctors(['fatigue', 'fever', 'headache'], 'LOW')
      .then(({ data }) => setAiDoctors(data.doctors || []))
      .catch(() => {})
  }, [])

  const searchBySymptoms = async () => {
    if (!symptoms.trim()) return
    setLoading(true)
    try {
      const list = symptoms.split(',').map(s => s.trim()).filter(Boolean)
      const { data } = await aiApi.doctors(list, 'MEDIUM')
      setAiDoctors(data.doctors || [])
    } finally {
      setLoading(false)
    }
  }

  const filtered = aiDoctors.filter(d => specialty === 'All' || d.specialty === specialty)
  const sorted = [...filtered].sort((a, b) => b.rating - a.rating || b.experience_years - a.experience_years)

  return (
    <div className="page-stack">
      <section className="glass-card">
        <p className="eyebrow">Find Your Doctor</p>
        <h3>AI-matched specialists & nearby care</h3>
        <div className="doctor-search-row" style={{ marginTop: 12 }}>
          <input value={symptoms} onChange={e => setSymptoms(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchBySymptoms()}
            placeholder="Enter symptoms e.g. chest pain, cough, headache"
            style={{ flex: 2 }} />
          <button className="primary-button" onClick={searchBySymptoms} disabled={loading || !symptoms.trim()}>
            {loading ? '…' : '🤖 AI Match'}
          </button>
        </div>
      </section>

      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'ai' ? 'tab-btn-active' : ''}`} onClick={() => setTab('ai')}>
          🤖 AI Recommended ({sorted.length})
        </button>
        <button className={`tab-btn ${tab === 'nearby' ? 'tab-btn-active' : ''}`} onClick={() => setTab('nearby')}>
          🗺 Nearby on Map
        </button>
      </div>

      {tab === 'ai' && (
        <>
          <div className="specialty-filter">
            {SPECIALTIES.map(s => (
              <button key={s} className={`filter-btn ${specialty === s ? 'filter-btn-active' : ''}`}
                onClick={() => setSpecialty(s)}>{s}</button>
            ))}
          </div>
          <p className="muted" style={{ fontSize: '0.82rem' }}>{sorted.length} doctor{sorted.length !== 1 ? 's' : ''} found</p>
          <div className="doctor-grid">
            {sorted.map(doc => <AiDoctorCard key={doc.id} doc={doc} />)}
            {!sorted.length && <p className="muted">No doctors found for this filter.</p>}
          </div>
        </>
      )}

      {tab === 'nearby' && <NearbyTab />}
    </div>
  )
}
