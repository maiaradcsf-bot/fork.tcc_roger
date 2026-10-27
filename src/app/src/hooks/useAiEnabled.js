import { useEffect, useState } from 'react';

import { api } from '../services/index.js';

const cache = {};

export function useAiEnabled(role) {
  const [enabled, setEnabled] = useState(cache[role] ?? false);

  useEffect(() => {
    let active = true;
    if (cache[role] !== undefined) return undefined;
    api.ai
      .getStatus(role)
      .then((status) => {
        cache[role] = Boolean(status?.enabled);
        if (active) setEnabled(cache[role]);
      })
      .catch(() => {
        if (active) setEnabled(false);
      });
    return () => {
      active = false;
    };
  }, [role]);

  return enabled;
}

