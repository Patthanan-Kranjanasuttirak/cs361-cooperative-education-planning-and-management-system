import { API_URL } from '../services/api';

export const getImageUrl = (imageName) => {
  if (!imageName) return "";
  if (imageName.startsWith('/company-logos/')) return `${API_URL}${imageName}`;
  
  if (imageName.startsWith('http')) {
    return imageName;
  }
  
  return new URL(`../assets/logocompany/${imageName}`, import.meta.url).href;
};
