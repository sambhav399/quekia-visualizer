'use client';
import mixpanel from 'mixpanel-browser';
import config from '.';

declare global {
  interface Window {
    mixpanel: any;
  }
}

const MIXPANEL_TOKEN = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;

type GeoInfo = {
  IP: string;
  'IP Version': string;
  Currency: string;
  Network: string;
  'Network Org': string;
  Region: string;
  'Time Zone': string;
  'Time UTC Offset': string;
};

let isInitialized = false;
let cachedGeoInfo: GeoInfo | null = null;

export const initMixpanel = () => {
  if (typeof window === 'undefined') return;
  if (process.env.NEXT_PUBLIC_DEV) return;

  if (!MIXPANEL_TOKEN) {
    console.warn('Mixpanel token is missing!');
    return;
  }

  if (isInitialized || window.mixpanel?.__loaded) return;

  mixpanel.init(MIXPANEL_TOKEN, { ignore_dnt: true });
  window.mixpanel = mixpanel;
  isInitialized = true;
};

export async function getGeoInfo() {
  try {
    const res = await fetch(config.APP_API_URL_GEO_LOCATION);
    if (!res.ok) throw new Error('Failed to fetch geo info');
    const data = await res.json();

    const eventData = {
      IP: data.ip,
      'IP Version': data.version,
      Currency: data.currency_name,
      Network: data.network,
      'Network Org': data.org,
      Region: data.region,
      'Time Zone': data.timezone,
      'Time UTC Offset': data.utc_offset,
    };

    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(
        config.APP_STORAGE.GEO_DATA,
        JSON.stringify(eventData)
      );
    }

    return eventData;
  } catch (err) {
    console.error(err);
    return null;
  }
}

export async function getCachedGeoInfo() {
  if (cachedGeoInfo) return cachedGeoInfo;

  if (typeof window !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(config.APP_STORAGE.GEO_DATA);
      cachedGeoInfo = raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.error(err);
      cachedGeoInfo = null;
    }
  }

  if (!cachedGeoInfo) {
    cachedGeoInfo = await getGeoInfo();
  }

  return cachedGeoInfo;
}

export const TrackEvent = async (
  eventName: string,
  eventProperties: Record<string, any>
) => {
  if (typeof window === 'undefined') return;
  if (process.env.NEXT_PUBLIC_DEV) return;

  const geoInfo = await getCachedGeoInfo();
  const eventData = {
    ...eventProperties,
    ...geoInfo,
  };

  if (!isInitialized || !window.mixpanel?.__loaded) {
    initMixpanel();
    mixpanel.track(eventName, eventData);
  }

  mixpanel.track(eventName, eventData);
};
