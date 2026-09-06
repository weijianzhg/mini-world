/* eslint-disable jsx-a11y/no-noninteractive-tabindex -- The application is a keyboard-operated 3D game surface. */
'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Globe2,
  Sun,
  Volume2,
  VolumeX,
  CircleHelp,
  Maximize,
  Minimize,
  Plus,
  Minus,
  LocateFixed,
  Trees,
  Waves,
  MountainSnow,
  Sprout,
  Star,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Footprints,
  Hand,
  Mouse,
  Sparkles,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { REGIONS, type Region } from '@/lib/game/world';
import { registerGameTools } from '@/lib/game/webmcp';
import type { Game, GameState } from '@/lib/game/scene';
const regionIcons = {
  forest: Trees,
  desert: Sprout,
  ocean: Waves,
  snow: MountainSnow,
};
const initial: GameState = {
  region: 'forest',
  swimming: false,
  stars: 0,
  visited: ['forest'],
  moving: false,
  zoom: 35,
  ready: false,
};
export default function Home() {
  const host = useRef<HTMLDivElement>(null),
    label = useRef<HTMLDivElement>(null),
    game = useRef<Game | null>(null),
    toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState(initial),
    [help, setHelp] = useState(false),
    [sound, setSound] = useState(false),
    [full, setFull] = useState(false),
    [toast, setToast] = useState(''),
    [error, setError] = useState(false);
  function message(text: string) {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3800);
  }
  useEffect(() => {
    let cancelled = false;
    let unregister: undefined | (() => void);
    import('@/lib/game/scene')
      .then(({ createGame }) => {
        if (cancelled || !host.current || !label.current) return;
        try {
          game.current = createGame(
            host.current,
            label.current,
            setState,
            message,
          );
          unregister = registerGameTools(game.current);
          (window as unknown as { __miniWorld?: Game }).__miniWorld =
            game.current;
        } catch (e) {
          console.error('Mini World could not start', e);
          setError(true);
        }
      })
      .catch(() => setError(true));
    const fullChange = () => setFull(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', fullChange);
    return () => {
      cancelled = true;
      unregister?.();
      game.current?.dispose();
      delete (window as unknown as { __miniWorld?: Game }).__miniWorld;
      document.removeEventListener('fullscreenchange', fullChange);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);
  useEffect(() => {
    game.current?.setPaused(help);
  }, [help]);
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      message('Try the full-screen button in your browser.');
    }
  }
  function toggleSound() {
    const next = !sound;
    setSound(next);
    game.current?.setSound(next);
  }
  const region = REGIONS[state.region];
  return (
    <main
      className={`game-shell ${state.zoom > 65 ? 'is-close' : ''}`}
      aria-label="Mini World exploration game"
    >
      <div
        ref={host}
        className="world-canvas"
        data-testid="world-canvas"
        role="application"
        tabIndex={0}
        aria-label="Explore the planet. Arrow keys or W A S D to move. Space to hop. Tap to walk, drag to turn, scroll to zoom."
      />
      <div ref={label} className="player-label">
        You!
      </div>
      <header className="game-header">
        <div className="brand">
          <div className="brand-mark">
            <Globe2 />
          </div>
          <div>
            <h1>
              mini world<span style={{ color: '#8daf69' }}>.</span>
            </h1>
            <p>LITTLE PLANET. BIG ADVENTURES.</p>
          </div>
        </div>
        <div className="top-actions">
          <button
            className="round-button"
            aria-label={sound ? 'Turn sound off' : 'Turn sound on'}
            aria-pressed={sound}
            onClick={toggleSound}
          >
            {sound ? <Volume2 /> : <VolumeX />}
          </button>
          <button
            className="round-button"
            aria-label="How to play"
            onClick={() => setHelp(true)}
          >
            <CircleHelp />
          </button>
          <button
            className="round-button fullscreen-button"
            aria-label={full ? 'Exit full screen' : 'Enter full screen'}
            onClick={fullscreen}
          >
            {full ? <Minimize /> : <Maximize />}
          </button>
        </div>
      </header>
      <div className="day-pill">
        <Sun /> A lovely day for an adventure
      </div>
      <aside className="discovery">
        <span className="eyebrow">
          {state.swimming ? 'SPLISH, SPLASH!' : 'LET’S GO EXPLORING'}
        </span>
        <h2>
          {region.name.split(' ').map((w, i) => (
            <span key={w}>
              {i > 0 && <br />}
              {w}
            </span>
          ))}
        </h2>
        <p>
          {region.note}
          <br />
          {state.swimming
            ? 'You’re a natural little swimmer.'
            : 'I wonder what you’ll find.'}
        </p>
        <div className="region-indicator">
          <span className="status-dot" style={{ background: region.color }} />
          {state.swimming ? 'Swimming time' : 'Happy wandering'}
        </div>
      </aside>
      <div
        className="collection"
        aria-label={`${state.stars} of 12 stars found`}
      >
        <Star />
        <div>
          <strong>
            {state.stars}{' '}
            <span style={{ fontSize: '14px', fontWeight: 500 }}> / 12</span>
          </strong>
          <span>little stars found</span>
        </div>
      </div>
      <div className="zoom-stack">
        <div className="zoom-control">
          <button
            aria-label="Zoom in"
            disabled={state.zoom >= 100}
            onClick={() => game.current?.zoomBy(12)}
          >
            <Plus size={21} />
          </button>
          <div className="zoom-divider" />
          <button
            aria-label="Zoom out"
            disabled={state.zoom <= 0}
            onClick={() => game.current?.zoomBy(-12)}
          >
            <Minus size={21} />
          </button>
        </div>
        <span>ZOOM</span>
        <button
          className="round-button home-button"
          aria-label="Find my explorer"
          onClick={() => game.current?.home()}
        >
          <LocateFixed />
        </button>
      </div>
      <div className="dock-caption">WHERE SHALL WE GO?</div>
      <nav className="region-dock" aria-label="Choose a place to explore">
        {(Object.keys(REGIONS) as Region[]).map((r) => {
          const Icon = regionIcons[r];
          return (
            <button
              key={r}
              className={`region-button ${r} ${state.region === r ? 'active' : ''}`}
              aria-label={`Explore ${REGIONS[r].short}`}
              aria-pressed={state.region === r}
              onClick={() => game.current?.goTo(r)}
            >
              <div className="region-icon">
                <Icon />
                {state.visited.includes(r) && <i className="visit-dot" />}
              </div>
              <span>{REGIONS[r].short}</span>
            </button>
          );
        })}
      </nav>
      <div className="control-hint">
        <div className="key-row">
          <kbd>↑</kbd>
          <kbd>←</kbd>
          <kbd>↓</kbd>
          <kbd>→</kbd>
          <span>to wander</span>
        </div>
        <p>Click to walk · Drag to look around</p>
        <p>Scroll to see a little more</p>
      </div>
      <div className="touch-pad" aria-label="Movement controls">
        {[
          ['ArrowUp', ArrowUp, 'Move forward'],
          ['ArrowLeft', ArrowLeft, 'Move left'],
          ['ArrowDown', ArrowDown, 'Move backward'],
          ['ArrowRight', ArrowRight, 'Move right'],
        ].map(([key, Icon, name]) => {
          const I = Icon as typeof ArrowUp;
          return (
            <button
              key={key as string}
              aria-label={name as string}
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                game.current?.setDirection(key as string, true);
              }}
              onPointerUp={() =>
                game.current?.setDirection(key as string, false)
              }
              onPointerCancel={() =>
                game.current?.setDirection(key as string, false)
              }
              onLostPointerCapture={() =>
                game.current?.setDirection(key as string, false)
              }
              onContextMenu={(e) => e.preventDefault()}
            >
              <I size={20} />
            </button>
          );
        })}
      </div>
      <button
        className="jump-button"
        aria-label={state.swimming ? 'Splash' : 'Hop'}
        onClick={() => game.current?.jump()}
      >
        <Sparkles size={20} />
        <span>{state.swimming ? 'Splash!' : 'A little hop'}</span>
        <kbd>SPACE</kbd>
      </button>
      {toast && (
        <output className="toast" aria-live="polite">
          {toast}
        </output>
      )}
      {!state.ready && (
        <div className="loading-world">
          {error ? (
            <div className="error-message">
              <Globe2 />
              <h2>Let’s wake up your world</h2>
              <p>
                This game needs a browser with 3D graphics enabled. Try
                reloading, or open it in a recent Chrome or Safari browser.
              </p>
              <button
                className="play-button"
                onClick={() => window.location.reload()}
              >
                Try again
              </button>
            </div>
          ) : (
            <>
              <Globe2 />
              <p>A little world is waking up…</p>
            </>
          )}
        </div>
      )}
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent className="help-dialog">
          <DialogTitle>Hello, little explorer!</DialogTitle>
          <DialogDescription>
            Your very own planet to wander, splash, and play.
          </DialogDescription>
          <div className="help-items">
            <div>
              <Footprints />
              <span>
                <strong>Let’s go for a walk</strong>Use the arrow keys, W A S D,
                or the touch arrows.
              </span>
            </div>
            <div>
              <Mouse />
              <span>
                <strong>Point to a new adventure</strong>Tap a spot on the
                planet to walk there.
              </span>
            </div>
            <div>
              <Hand />
              <span>
                <strong>Take a closer look</strong>Drag to turn. Scroll or pinch
                to zoom.
              </span>
            </div>
            <div>
              <Waves />
              <span>
                <strong>Jump right in</strong>You’ll swim automatically. Space
                makes a hop or splash!
              </span>
            </div>
            <div>
              <Star />
              <span>
                <strong>A little treasure hunt</strong>Walk near a golden star
                to collect it.
              </span>
            </div>
          </div>
          <button className="play-button" onClick={() => setHelp(false)}>
            Let’s explore!
          </button>
          <p className="help-note">No rush. No losing. Just a little wonder.</p>
        </DialogContent>
      </Dialog>
    </main>
  );
}
