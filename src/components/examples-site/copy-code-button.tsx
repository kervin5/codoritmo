'use client';

import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';

import motionStyles from './motion.module.css';

interface CopyCodeButtonProps {
  code: string;
  label: string;
  copiedLabel: string;
  failedLabel: string;
}

export default function CopyCodeButton({ code, label, copiedLabel, failedLabel }: CopyCodeButtonProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (status === 'idle') return;
    const timer = window.setTimeout(() => setStatus('idle'), 2000);
    return () => window.clearTimeout(timer);
  }, [status]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  };

  const shown = status === 'copied' ? copiedLabel : status === 'failed' ? failedLabel : label;

  return (
    <button
      className={`inline-flex items-center gap-1.5 rounded-md border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs text-white/70 ${motionStyles.press} hover:border-white/20 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#7FE0B8]`}
      onClick={copy}
      type="button"
    >
      {status === 'copied' ? <Check aria-hidden="true" size={13} /> : <Copy aria-hidden="true" size={13} />}
      <span aria-live="polite">{shown}</span>
    </button>
  );
}
