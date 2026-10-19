import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cx } from '../cx';
import styles from './PropertySection.module.scss';

export interface PropertySectionProps {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  more?: ReactNode;
  moreLabel?: string;
  lessLabel?: string;
  className?: string | undefined;
}

export function PropertySection({
  title,
  children,
  defaultOpen = true,
  open,
  onOpenChange,
  more,
  moreLabel = 'More',
  lessLabel = 'Less',
  className,
}: PropertySectionProps) {
  const id = useId();
  const [ownOpen, setOwnOpen] = useState(defaultOpen);
  const [showMore, setShowMore] = useState(false);
  const expanded = open ?? ownOpen;
  const toggle = () => {
    setOwnOpen(!expanded);
    onOpenChange?.(!expanded);
  };
  return (
    <section className={cx(styles['section'], className)}>
      <h3 className={styles['heading']}>
        <button
          type="button"
          className={styles['toggle']}
          aria-expanded={expanded}
          aria-controls={`${id}-body`}
          onClick={toggle}
        >
          {expanded ? <ChevronDown aria-hidden="true" /> : <ChevronRight aria-hidden="true" />}
          {title}
        </button>
      </h3>
      {expanded ? (
        <div id={`${id}-body`} className={styles['body']}>
          {children}
          {more ? (
            <>
              {showMore ? more : null}
              <button
                type="button"
                className={styles['more']}
                onClick={() => {
                  setShowMore(!showMore);
                }}
              >
                {showMore ? lessLabel : moreLabel}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
