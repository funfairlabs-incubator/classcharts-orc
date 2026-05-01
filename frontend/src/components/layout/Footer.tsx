'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BUILD_INFO } from '@/lib/buildInfo';

type TrafficLight = 'green' | 'amber' | 'red' | 'unknown';

function usePollerStatus(): TrafficLight {
  const [light, setLight] = useState<TrafficLight>('unknown');

  useEffect(() => {
    fetch('/api/status')
      .then(r => r.json())
      .then(d => {
        const hb = d?.heartbeat;
        if (!hb) { setLight('unknown'); return; }

        const errors = Object.values(hb.dependencies ?? {}).some(v => v === 'error');
        const mins = Math.floor((Date.now() - new Date(hb.polledAt).getTime()) / 60000);

        if (errors || mins > 15) setLight('red');
        else if (mins > 7)       setLight('amber');
        else                     setLight('green');
      })
      .catch(() => setLight('unknown'));
  }, []);

  return light;
}

const LIGHT_COLOR: Record<TrafficLight, string> = {
  green:   '#22c55e',
  amber:   '#f59e0b',
  red:     '#ef4444',
  unknown: '#94a3b8',
};

const LIGHT_TITLE: Record<TrafficLight, string> = {
  green:   'All systems operational',
  amber:   'Poller delayed — check status',
  red:     'System error — check status',
  unknown: 'Status unknown',
};

export function Footer() {
  const commitSha  = BUILD_INFO.commitSha;
  const deployedAt = BUILD_INFO.deployedAt;
  const light = usePollerStatus();

  return (
    <footer style={styles.footer}>
      <span style={styles.brand}>
        <span style={{ color: '#f97316', fontWeight: 700 }}>FunFairLabs</span>
        <span style={{ color: '#6366f1', fontWeight: 700 }}> + Claude</span>
        <span style={{ color: 'var(--border-strong)' }}> | </span>
        <span style={{ color: 'var(--text-3)' }}>ClassCharts</span>
      </span>

      <span style={styles.right}>
        <code style={styles.code}>{commitSha}</code>
        {' · '}
        <code style={styles.code}>{deployedAt}</code>
        {' · '}
        <Link href="/status" title={LIGHT_TITLE[light]} style={styles.trafficLight}>
          <span style={{
            display: 'inline-block',
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: LIGHT_COLOR[light],
            boxShadow: light !== 'unknown' ? `0 0 4px ${LIGHT_COLOR[light]}` : 'none',
            verticalAlign: 'middle',
          }} />
        </Link>
      </span>
    </footer>
  );
}

const styles: Record<string, React.CSSProperties> = {
  footer: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    borderTop: '1px solid var(--border)',
    padding: '10px 16px',
    background: 'var(--bg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: 12,
    zIndex: 10,
  },
  brand: { color: 'var(--text-3)' },
  right: { display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-3)', opacity: 0.6, whiteSpace: 'nowrap', overflow: 'hidden' },
  code: { fontFamily: 'var(--font-mono)', fontSize: 11, background: 'var(--surface-2)', padding: '1px 4px', borderRadius: 3 },
  trafficLight: { display: 'inline-flex', alignItems: 'center', textDecoration: 'none', padding: '0 2px' },
};
