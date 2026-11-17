import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api/v1",
  withCredentials: false
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error || {};

    if (response?.status === 429 && config && !config._retry429) {
      config._retry429 = true;
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return api(config);
    }

    if (response?.status === 401 && !config?._retryAuth) {
      const refreshToken = localStorage.getItem("refreshToken");
      if (refreshToken) {
        try {
          config._retryAuth = true;
          const { data } = await axios.post(
            (import.meta.env.VITE_API_URL || "/api/v1") + "/auth/refresh",
            { refreshToken }
          );
          if (data?.accessToken) {
            localStorage.setItem("accessToken", data.accessToken);
            config.headers = config.headers || {};
            config.headers.Authorization = `Bearer ${data.accessToken}`;
            return api(config);
          }
        } catch {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          localStorage.removeItem("user");
          window.location.href = "/login";
          return Promise.reject(error);
        }
      } else {
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
    }

    return Promise.reject(error);
  }
);

export default api;
