export const generateSlug = (text) => {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")     // remove special chars
    .replace(/\s+/g, "-")         // space → dash
    .replace(/--+/g, "-");        // remove duplicate dash
};