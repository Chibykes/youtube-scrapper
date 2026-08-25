import axios, { AxiosInstance, CreateAxiosDefaults } from "axios";

// Every service under lib/network/* builds its axios instance through this
// factory instead of importing axios directly, so retry/timeout/logging
// behavior can change in one place. validateStatus always returns true
// because callers here inspect res.status themselves (mirrors the previous
// fetch()-based res.ok checks) rather than relying on axios throwing on
// non-2xx.
export function createHttpClient(config?: CreateAxiosDefaults): AxiosInstance {
  return axios.create({
    validateStatus: () => true,
    ...config,
  });
}
