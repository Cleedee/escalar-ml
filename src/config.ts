const ENV = {
  dev: { API_BASE: 'http://10.22.28.62:8088' },
  prod: { API_BASE: 'https://escalar-no-cartola.onrender.com' },
};

const env = __DEV__ ? 'dev' : 'prod';
export const API_BASE = ENV[env].API_BASE;
