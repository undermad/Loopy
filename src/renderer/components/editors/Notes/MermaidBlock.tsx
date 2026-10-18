import { useEffect, useRef, useState } from 'react';
import type MermaidApi from 'mermaid';
import { useTranslation } from '@renderer/lib/i18n';
import { useActiveTheme } from '@renderer/lib/theme';
import styles from './NoteMarkdown.module.scss';

type Mermaid = typeof MermaidApi;

let loading: Promise<Mermaid> | null = null;
let counter = 0;

function loadMermaid(): Promise<Mermaid> {
  loading ??= import('mermaid').then((module) => module.default);
  return loading;
}

export function MermaidBlock({ source }: { source: string }) {
  const { t } = useTranslation('notes');
  const base = useActiveTheme().base;
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    void loadMermaid()
      .then(async (mermaid) => {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: base === 'dark' ? 'dark' : 'default',
        });
        counter += 1;
        const { svg } = await mermaid.render(`loopy-mermaid-${String(counter)}`, source);
        if (!current || !host.current) return;
        host.current.innerHTML = svg;
        setFailed(null);
      })
      .catch((error: unknown) => {
        if (current) setFailed(error instanceof Error ? error.message : String(error));
      });
    return () => {
      current = false;
    };
  }, [source, base]);

  return (
    <figure className={styles['diagram']} aria-label={t('reading.diagram')}>
      <div ref={host} hidden={failed !== null} />
      {failed !== null ? (
        <>
          <p className={styles['muted']}>{t('reading.diagramError', { message: failed })}</p>
          <pre className={styles['pre']}>
            <code>{source}</code>
          </pre>
        </>
      ) : null}
    </figure>
  );
}
