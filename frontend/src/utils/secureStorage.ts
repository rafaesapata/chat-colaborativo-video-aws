// SEC-006: Utilitário para armazenamento seguro com ofuscação
const STORAGE_PREFIX = 'vcsec_';

const encode = (data: string): string => {
  try {
    return btoa(encodeURIComponent(data).replace(/%([0-9A-F]{2})/g, (_, p1) => 
      String.fromCharCode(parseInt(p1, 16))
    ));
  } catch {
    return data;
  }
};

const decode = (data: string): string => {
  try {
    return decodeURIComponent(
      Array.prototype.map.call(atob(data), (c: string) => 
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      ).join('')
    );
  } catch {
    return data;
  }
};

export const secureStorage = {
  setItem(key: string, value: string): void {
    try {
      const encodedKey = STORAGE_PREFIX + encode(key);
      const encodedValue = encode(value);
      localStorage.setItem(encodedKey, encodedValue);
    } catch (error) {
      console.error('SecureStorage setItem failed:', error);
    }
  },

  getItem(key: string): string | null {
    try {
      const encodedKey = STORAGE_PREFIX + encode(key);
      const encodedValue = localStorage.getItem(encodedKey);
      if (encodedValue === null) return null;
      return decode(encodedValue);
    } catch (error) {
      console.error('SecureStorage getItem failed:', error);
      return null;
    }
  },

  removeItem(key: string): void {
    try {
      const encodedKey = STORAGE_PREFIX + encode(key);
      localStorage.removeItem(encodedKey);
    } catch (error) {
      console.error('SecureStorage removeItem failed:', error);
    }
  },

  clear(): void {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith(STORAGE_PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch (error) {
      console.error('SecureStorage clear failed:', error);
    }
  }
};
