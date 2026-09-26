import { GameScreen } from './game/GameScreen';
import { FactionSelect, LoreScreen, MainMenu } from './screens/MainMenu';
import { nav, useVersion, store } from './store';

export function App() {
  const n = nav.use();
  useVersion();
  if (n.screen === 'game' && store.state?.player) return <GameScreen />;
  if (n.screen === 'setup') return <FactionSelect />;
  if (n.screen === 'lore') return <LoreScreen />;
  return <MainMenu />;
}
