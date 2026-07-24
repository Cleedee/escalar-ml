const ENV = {
  dev: { API_BASE: 'https://escalar-no-cartola.onrender.com' },
  prod: { API_BASE: 'https://escalar-no-cartola.onrender.com' },
};

const env = __DEV__ ? 'dev' : 'prod';
export const API_BASE = ENV[env].API_BASE;
export const BUILD_DATE = '2026-07-23';
export const APP_VERSION = '1.2.0';
