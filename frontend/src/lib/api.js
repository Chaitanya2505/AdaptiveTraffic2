import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const getAllJunctions = async () => {
  const response = await api.get('/api/v1/junctions');
  return response.data;
};

export const getMajorJunctions = async () => {
  const response = await api.get('/api/v1/junctions/major');
  return response.data;
};

export const getJunctionBySlug = async (slug) => {
  const response = await api.get(`/api/v1/junctions/${slug}`);
  return response.data;
};
