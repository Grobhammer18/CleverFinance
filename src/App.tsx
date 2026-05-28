import { useCallback, useState } from 'react';
import AllWin from './components/AllWin';
import LaunchSplash from './components/LaunchSplash';

const LAUNCH_KEY = 'allwin.launchSplashSeen';

export default function App() {
  const [showLaunch, setShowLaunch] = useState(() => typeof localStorage !== 'undefined' && localStorage.getItem(LAUNCH_KEY) !== '1');

  const finishLaunch = useCallback(() => {
    try {
      localStorage.setItem(LAUNCH_KEY, '1');
    } catch {
      /* private mode */
    }
    setShowLaunch(false);
  }, []);

  if (showLaunch) {
    return <LaunchSplash onDone={finishLaunch} />;
  }

  return <AllWin />;
}
