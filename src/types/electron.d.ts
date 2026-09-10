import { RegneAPI } from '../preload';

declare global {
  interface Window {
    regneAPI?: RegneAPI;
    hypatiaAPI?: RegneAPI;
  }
}

export {};
