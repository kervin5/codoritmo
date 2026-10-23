'use client';

import { Check, Share2 } from 'lucide-react';
import { useEffect, useState } from 'react';

import motionStyles from './motion.module.css';

interface ShareButtonProps {
  url: string;
  title: string;
  text: string;
  label: string;
  copiedLabel: string;
  failedLabel: string;
}

/** Opens the native share sheet when there is one, otherwise copies the link. */
export default function ShareButton({ url, title, text, label, copiedLabel, failedLabel }: ShareButtonProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (status === 'idle') return;
    const timer = window.setTimeout(() => setStatus('idle'), 2500);
    return () => window.clearTimeout(timer);
  }, [status]);

  const share = async () => {
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ url, title, text });
        return;
      } catch (error) {
        // The person closed the sheet: nothing to do.
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  };

  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full border border-white/[0.12] bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white/85 ${motionStyles.press} ${motionStyles.lift} hover:border-white/25 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7FE0B8]`}
      onClick={share}
      type="button"
    >
      {status === 'copied' ? <Check aria-hidden="true" size={15} /> : <Share2 aria-hidden="true" size={15} />}
      <span aria-live="polite">{status === 'copied' ? copiedLabel : status === 'failed' ? failedLabel : label}</span>
    </button>
  );
}
