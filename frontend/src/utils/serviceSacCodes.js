export const SERVICE_SAC_CODES = {
  "Website Design": "998314",
  "SEO": "998314",
  "Social Media Marketing": "998361",
  "B2B Sales Consulting": "998312",
  "Outbound Lead Generation": "998312",
  "TeleCalling": "998312"
};

/**
 * Get SAC code for a service name
 * @param {string} serviceName - The name of the service
 * @returns {string|null} - The SAC code if found, null otherwise
 */
export const getSacCodeForService = (serviceName) => {
  if (!serviceName) return null;
  
  // Trim and normalize the service name
  const normalizedName = serviceName.trim();
  
  // Direct match
  if (SERVICE_SAC_CODES[normalizedName]) {
    return SERVICE_SAC_CODES[normalizedName];
  }
  
  // Case-insensitive match
  const serviceKey = Object.keys(SERVICE_SAC_CODES).find(
    key => key.toLowerCase() === normalizedName.toLowerCase()
  );
  
  if (serviceKey) {
    return SERVICE_SAC_CODES[serviceKey];
  }
  
  // Partial match (contains)
  const partialMatch = Object.keys(SERVICE_SAC_CODES).find(
    key => normalizedName.toLowerCase().includes(key.toLowerCase()) ||
           key.toLowerCase().includes(normalizedName.toLowerCase())
  );
  
  if (partialMatch) {
    return SERVICE_SAC_CODES[partialMatch];
  }
  
  return null;
};
