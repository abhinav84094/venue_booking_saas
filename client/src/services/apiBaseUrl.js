export const resolveApiBaseUrl = ({ isProduction = false, configuredUrl } = {}) => {
  // The production host proxies /api to the backend so HttpOnly authentication
  // and password-setup cookies remain first-party, even with a legacy API URL.
  if (isProduction) return "/api";
  return configuredUrl || "/api";
};
