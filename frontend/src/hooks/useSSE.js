import { useState, useEffect, useRef } from 'react';

export function useSSE(url = '/api/events/stream', maxEvents = 100) {
  const [events, setEvents] = useState([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef(null);

  useEffect(() => {
    const es = new EventSource(url);
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data);
        setEvents(prev => {
          const next = [event, ...prev];
          return next.slice(0, maxEvents);
        });
      } catch {}
    };
    es.onerror = () => setConnected(false);

    return () => es.close();
  }, [url, maxEvents]);

  return { events, connected };
}
