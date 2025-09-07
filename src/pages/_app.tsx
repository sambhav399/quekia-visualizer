import '@/styles/globals.css';

import React, { useEffect } from 'react';
import type { AppProps } from 'next/app';
import PAGE_Head from '@/components/PAGE_Head';
import { initMixpanel } from '../config/MixPanel';

function RenderComponent({ Component, pageProps }: AppProps) {
  useEffect(() => {
    if (typeof window !== 'undefined') {
      initMixpanel();
    }
  }, []);

  return <Component {...pageProps} />;
}

function MyApp(props: AppProps) {
  return (
    <>
      <PAGE_Head />
      <RenderComponent {...props} />
    </>
  );
}

export default MyApp;
