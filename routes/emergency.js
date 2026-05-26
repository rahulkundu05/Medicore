const router = require('express').Router();
const Hospital = require('../models/Hospital');
const { EmergencyBooking } = require('../models/Appointment');
const auth = require('../middleware/auth');
const https = require('https');

// Helper function to fetch real-world hospitals using OpenStreetMap Overpass API
function fetchRealHospitalsFromOSM(lat, lng) {
  return new Promise((resolve) => {
    // Search for hospitals/clinics within 5km (5000m)
    const query = `[out:json][timeout:15];(node["amenity"="hospital"](around:5000,${lat},${lng});way["amenity"="hospital"](around:5000,${lat},${lng});relation["amenity"="hospital"](around:5000,${lat},${lng}););out center;`;
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    
    https.get(url, { headers: { 'User-Agent': 'MediCoreApp/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode === 200) {
            const parsed = JSON.parse(data);
            resolve(parsed.elements || []);
          } else {
            console.warn(`OSM API status error: ${res.statusCode}`);
            resolve([]);
          }
        } catch (e) {
          console.warn('Failed to parse OSM response:', e);
          resolve([]);
        }
      });
    }).on('error', (err) => {
      console.warn('OSM connection error:', err);
      resolve([]);
    });
  });
}

// Calculate distance between two GPS coordinates in kilometers using Haversine formula
function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// GET /api/emergency/hospitals?x=25&y=40  – nearest hospitals
router.get('/hospitals', auth, async (req, res) => {
  try {
    const px = parseFloat(req.query.x);
    const py = parseFloat(req.query.y);
    if (isNaN(px) || isNaN(py))
      return res.status(400).json({ error: 'Valid x and y coordinates required' });

    // Check if coordinates represent actual real-world GPS values
    const isGPS = Math.abs(px) > 5 && Math.abs(py) > 5;
    let results = [];

    if (isGPS) {
      // 1. Fetch actual real-world clinics/hospitals from OpenStreetMap
      let elements = [];
      try {
        elements = await fetchRealHospitalsFromOSM(px, py);
      } catch (err) {
        console.error('Failed to query Overpass API:', err);
      }

      if (elements && elements.length > 0) {
        for (const el of elements) {
          const name = el.tags.name || el.tags["name:en"] || el.tags.brand || "Nearby Health Center";
          const lat = el.lat || (el.center && el.center.lat);
          const lng = el.lon || (el.center && el.center.lon);
          if (!lat || !lng) continue;

          // Find or create in database to generate valid ObjectIds and persist slot numbers
          let hosp = await Hospital.findOne({ name });
          if (!hosp) {
            const slots = Math.floor(Math.random() * 7) + 2;
            hosp = await Hospital.create({ name, x: lat, y: lng, slots });
          } else {
            hosp.x = lat;
            hosp.y = lng;
            await hosp.save();
          }

          const distance = calculateHaversineDistance(px, py, lat, lng);
          results.push({
            ...hosp.toObject(),
            lat,
            lng,
            distance
          });
        }
      }
    }

    // 2. Fallback to mock seeded hospitals if not GPS coordinates or Overpass API returned no results
    if (results.length === 0) {
      const hospitals = await Hospital.find();
      results = hospitals.map(h => {
        if (isGPS) {
          // Dynamic coordinates offset mapping
          const lat = px + (h.x - 30) * 0.0003;
          const lng = py + (h.y - 30) * 0.0003;
          const distance = calculateHaversineDistance(px, py, lat, lng);
          return {
            ...h.toObject(),
            lat,
            lng,
            distance
          };
        } else {
          // Standard Euclidean Cartesian grid distance calculations
          return {
            ...h.toObject(),
            lat: h.x,
            lng: h.y,
            distance: Math.sqrt(Math.pow(h.x - px, 2) + Math.pow(h.y - py, 2))
          };
        }
      });
    }

    // Sort by distance and slice to top 10 (showing every local clinic while keeping list responsive)
    results.sort((a, b) => a.distance - b.distance);
    const finalHospitals = results.slice(0, 10);

    res.json({ hospitals: finalHospitals });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/emergency/book
router.post('/book', auth, async (req, res) => {
  try {
    const { hospitalId } = req.body;
    if (!hospitalId) return res.status(400).json({ error: 'hospitalId required' });

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) return res.status(404).json({ error: 'Hospital not found' });
    if (hospital.slots <= 0) return res.status(400).json({ error: 'No emergency slots available' });

    hospital.slots -= 1;
    await hospital.save();

    const booking = await EmergencyBooking.create({
      user: req.user._id,
      patientName: req.user.name,
      hospital: hospital._id,
      hospitalName: hospital.name,
    });

    res.status(201).json({ booking });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/emergency/bookings  – my emergency bookings
router.get('/bookings', auth, async (req, res) => {
  try {
    const bookings = await EmergencyBooking.find({ user: req.user._id }).populate('hospital').sort('-createdAt');
    res.json({ bookings });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
