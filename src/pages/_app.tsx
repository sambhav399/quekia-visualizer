import '@/styles/globals.css';

import * as React from 'react';
import type { AppProps } from 'next/app';
import PAGE_Head from '@/components/PAGE_Head';

function RenderComponent({ Component, pageProps }: AppProps) {
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
