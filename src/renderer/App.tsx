import { AppVersion } from './components/AppVersion/AppVersion';
import styles from './App.module.scss';

export function App() {
  return (
    <main className={styles['app']}>
      <h1 className={styles['title']}>Loopy</h1>
      <p className={styles['subtitle']}>Game design and project management, on your desktop.</p>
      <AppVersion />
    </main>
  );
}
