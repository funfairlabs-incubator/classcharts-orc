'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { CCStudent } from '@classcharts/shared';

interface PupilContextValue {
  pupils: CCStudent[];
  activePupil: CCStudent | null;
  setActivePupilId: (id: number) => void;
  loading: boolean;
}

const PupilContext = createContext<PupilContextValue>({
  pupils: [],
  activePupil: null,
  setActivePupilId: () => {},
  loading: true,
});

export function PupilProvider({ children }: { children: ReactNode }) {
  const [pupils, setPupils] = useState<CCStudent[]>([]);
  const [activePupilId, setActivePupilId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/pupils')
      .then(r => r.json())
      .then((data: CCStudent[]) => {
        setPupils(data);
        if (data.length > 0) setActivePupilId(data[0].id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const activePupil = pupils.find(p => p.id === activePupilId) ?? null;

  return (
    <PupilContext.Provider value={{ pupils, activePupil, setActivePupilId, loading }}>
      {children}
    </PupilContext.Provider>
  );
}

export function usePupil() {
  return useContext(PupilContext);
}

// ── Generic data fetcher hook ─────────────────────────────────

export function useClassChartsData<T>(
  endpoint: string,
  params: Record<string, string> = {},
  deps: unknown[] = [],
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const allParams = Object.entries(params)
      .filter(([, v]) => v)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join('&');

    setLoading(true);
    setError(null);

    fetch(`/api/${endpoint}${allParams ? `?${allParams}` : ''}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error);
        setData(d);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
}
