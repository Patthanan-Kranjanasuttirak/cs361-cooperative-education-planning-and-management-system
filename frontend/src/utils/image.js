export const getImageUrl = (imageName) => {
  if (!imageName) return "";
  
  if (imageName.startsWith('http')) {
    return imageName;
  }
  
  return new URL(`../assets/logocompany/${imageName}`, import.meta.url).href;
};