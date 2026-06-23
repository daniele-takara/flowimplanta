const isNode = typeof window === 'undefined';
const windowObj = isNode ? { localStorage: new Map() } : window;

// Safe localStorage wrapper — never throws, even in incognito / Safari ITP
const safeStorage = {
  getItem(key) {
    if (isNode) return null;
    try { return windowObj.localStorage.getItem(key); } catch (_) { return null; }
  },
  setItem(key, value) {
    if (isNode) return;
    try { windowObj.localStorage.setItem(key, value); } catch (_) { /* silently ignore */ }
  },
  removeItem(key) {
    if (isNode) return;
    try { windowObj.localStorage.removeItem(key); } catch (_) { /* silently ignore */ }
  },
};

const toSnakeCase = (str) => {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase();
};

const getAppParamValue = (paramName, { defaultValue = undefined, removeFromUrl = false } = {}) => {
  if (isNode) {
    return defaultValue;
  }
  const storageKey = `base44_${toSnakeCase(paramName)}`;

  let searchParam = null;
  try {
    const urlParams = new URLSearchParams(window.location.search);
    searchParam = urlParams.get(paramName);
    if (removeFromUrl) {
      urlParams.delete(paramName);
      const newUrl = `${window.location.pathname}${urlParams.toString() ? `?${urlParams.toString()}` : ""}${window.location.hash}`;
      window.history.replaceState({}, document.title, newUrl);
    }
  } catch (_) { /* URL parsing failed — continue */ }

  if (searchParam) {
    safeStorage.setItem(storageKey, searchParam);
    return searchParam;
  }
  if (defaultValue !== undefined && defaultValue !== null) {
    safeStorage.setItem(storageKey, defaultValue);
    return defaultValue;
  }
  const storedValue = safeStorage.getItem(storageKey);
  if (storedValue) {
    return storedValue;
  }
  return null;
};

const getAppParams = () => {
  // Limpeza de token — usa safeStorage para nunca lançar exceção
  try {
    if (new URLSearchParams(window.location.search).get("clear_access_token") === 'true') {
      safeStorage.removeItem('base44_access_token');
      safeStorage.removeItem('token');
    }
  } catch (_) { /* URL parsing failed */ }

  return {
    appId: getAppParamValue("app_id", { defaultValue: import.meta.env.VITE_BASE44_APP_ID }),
    token: getAppParamValue("access_token", { removeFromUrl: true }),
    fromUrl: getAppParamValue("from_url", { defaultValue: window.location.href }),
    functionsVersion: getAppParamValue("functions_version", { defaultValue: import.meta.env.VITE_BASE44_FUNCTIONS_VERSION }),
    appBaseUrl: getAppParamValue("app_base_url", { defaultValue: import.meta.env.VITE_BASE44_APP_BASE_URL }),
  };
};

export const appParams = {
  ...getAppParams(),
};