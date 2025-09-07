import * as React from 'react';
import PAGE_Home from '@/components/PAGE_Home';
import { TrackEvent } from '@/config/MixPanel';

const Home: React.FC = () => {
  React.useEffect(() => {
    TrackEvent('quekia-visualizer', {
      Action: 'viewed',
    });
  });
  return <PAGE_Home />;
};

export default Home;
