import axios from 'axios';
import { dummyJunctions } from '../dummyData/junctions';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getAllJunctions = async () => {
  try {
    const response = await api.get('/junctions');
    if (Array.isArray(response.data) && response.data.length > 0) {
      return response.data.map(j => ({
        ...j,
        lat: j.latitude ?? j.lat,
        lon: j.longitude ?? j.lon,
        latitude: j.latitude ?? j.lat,
        longitude: j.longitude ?? j.lon,
        is_major: j.is_major ?? (j.num_lanes >= 6 || j.has_brts),
        junction_type: j.junction_type || (j.has_brts ? 'transit' : 'commercial'),
        connecting_roads: j.connecting_roads || ['Arterial Main Road', 'Ring Link Road'],
        area: j.area || `${j.name} Sector`,
        slug: j.slug || j.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
      }));
    }
    return dummyJunctions;
  } catch (err) {
    console.warn('Backend unavailable, using dummyJunctions dataset:', err.message);
    return dummyJunctions;
  }
};

export const getMajorJunctions = async () => {
  try {
    const all = await getAllJunctions();
    return all.filter(j => j.is_major || j.num_lanes >= 6);
  } catch (err) {
    return dummyJunctions.filter(j => j.is_major);
  }
};

export const getJunctionBySlug = async (slug) => {
  const all = await getAllJunctions();
  return all.find(j => j.slug === slug || j.id === slug) || all[0];
};

