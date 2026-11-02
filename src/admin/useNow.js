import { useEffect, useState } from "react";

// Current time, refreshed every `intervalMs`, so "5 min ago" and bin status stay current.
export default function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
