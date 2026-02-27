import { Suspense, lazy, useEffect, useState } from 'react';
import './App.css';

const ModaCenterMap = lazy(() => import('./components/Maps/ModaCenterMap'));

function App() {
  const [isSplashVisible, setIsSplashVisible] = useState(true);

  useEffect(() => {
    const desktopMapPreload = new Image();
    desktopMapPreload.src = '/maps/mapa-visual.jpg';

    const mobileMapPreload = new Image();
    mobileMapPreload.src = '/maps/mapa-visual-low.jpg';

    const splashTimer = window.setTimeout(() => {
      setIsSplashVisible(false);
    }, 1800);

    return () => {
      window.clearTimeout(splashTimer);
    };
  }, []);

  return (
    <div className="App">
      {isSplashVisible ? (
        <section className="brand-splash" aria-label="Abertura da marca GNOCENTER">
          <div className="brand-splash__chip">Navegação indoor</div>
          <h1 className="brand-splash__title">GNOCENTER</h1>
          <p className="brand-splash__subtitle">
            Encontre lojas, trace rotas e viva uma visita mais tranquila.
          </p>
        </section>
      ) : (
        <Suspense fallback={<div className="app-loading">Preparando sua experiência no mapa...</div>}>
          <ModaCenterMap />
        </Suspense>
      )}
    </div>
  );
}

export default App;
