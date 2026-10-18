import { useMemo, useState } from 'react';
import { History, Link2, ListTree, Plus, Tags, Trash2 } from 'lucide-react';
import { formatLink, setProperties, type NoteLink, type PropertyValue } from '@shared/markdown';
import type { EditorProps } from '@renderer/lib/editors';
import { useTranslation } from '@renderer/lib/i18n';
import {
  editNoteBody,
  findNote,
  unlinkedMentions,
  useActiveNoteId,
  useNote,
  useNoteIndex,
} from '@renderer/lib/notes';
import { EmptyState, IconButton, Input, ScrollArea, Tabs, cx } from '@renderer/ui';
import { NoteHistory } from './NoteHistory';
import { useNoteNavigation } from './useNoteNavigation';
import styles from './NoteDetails.module.scss';

function linkLabel(link: NoteLink): string {
  const prefix = link.kind === 'note' ? '' : `${link.kind}:`;
  return `${prefix}${link.target}${link.subpath ? `#${link.subpath}` : ''}`;
}

function valueText(value: PropertyValue): string {
  if (Array.isArray(value)) return value.join(', ');
  return value === null ? '' : String(value);
}

function parseValue(text: string, previous: PropertyValue): PropertyValue {
  const trimmed = text.trim();
  if (Array.isArray(previous) || trimmed.includes(',')) {
    return trimmed
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (trimmed === '') return null;
  if (trimmed === 'true' || trimmed === 'false') return trimmed === 'true';
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  return trimmed;
}

export function NoteDetails({ state, setState }: EditorProps) {
  const { t } = useTranslation('notes');
  const activeId = useActiveNoteId();
  const note = useNote(activeId);
  const index = useNoteIndex();
  const nav = useNoteNavigation();
  const tab = typeof state['tab'] === 'string' ? state['tab'] : 'links';
  const [newKey, setNewKey] = useState('');

  const backlinks = useMemo(() => (note ? (index.backlinks.get(note.id) ?? []) : []), [index, note]);
  const mentions = useMemo(() => (note ? unlinkedMentions(index, note.id) : []), [index, note]);
  const outgoing = useMemo(() => (note ? (index.outgoing.get(note.id) ?? []) : []), [index, note]);
  const parsed = note ? index.parsed.get(note.id) : undefined;

  if (!note || !parsed) {
    return (
      <div className={styles['panel']}>
        <EmptyState icon={<Link2 />} title={t('panel.noNote')} />
      </div>
    );
  }

  const grouped = new Map<string, typeof backlinks>();
  for (const ref of backlinks) grouped.set(ref.sourceId, [...(grouped.get(ref.sourceId) ?? []), ref]);
  const mentionGroups = new Map<string, typeof mentions>();
  for (const mention of mentions) {
    mentionGroups.set(mention.sourceId, [...(mentionGroups.get(mention.sourceId) ?? []), mention]);
  }

  function linkMention(sourceId: string, from: number, to: number) {
    const source = findNote(sourceId);
    if (!source || !note) return;
    const text = source.body.slice(from, to);
    const link = formatLink({
      kind: 'note',
      target: note.title,
      subpath: null,
      alias: text === note.title ? null : text,
    });
    editNoteBody(sourceId, source.body.slice(0, from) + link + source.body.slice(to));
  }

  function writeProperties(next: Record<string, PropertyValue>) {
    if (!note) return;
    editNoteBody(note.id, setProperties(note.body, next));
  }

  return (
    <div className={styles['panel']}>
      <Tabs.Root
        value={tab}
        onValueChange={(value) => {
          setState({ tab: value });
        }}
        className={styles['tabs']}
      >
        <Tabs.List aria-label={t('panel.label')}>
          <Tabs.Trigger value="links">
            <Link2 aria-hidden="true" />
            {t('panel.links')}
          </Tabs.Trigger>
          <Tabs.Trigger value="outline">
            <ListTree aria-hidden="true" />
            {t('panel.outline')}
          </Tabs.Trigger>
          <Tabs.Trigger value="properties">
            <Tags aria-hidden="true" />
            {t('panel.properties')}
          </Tabs.Trigger>
          <Tabs.Trigger value="history">
            <History aria-hidden="true" />
            {t('panel.history')}
          </Tabs.Trigger>
        </Tabs.List>
        <ScrollArea className={styles['scroll']}>
          <Tabs.Content value="links" className={styles['content']}>
            <section aria-label={t('panel.backlinks')}>
              <h3 className={styles['heading']}>
                {t('panel.backlinks')} <span className={styles['count']}>{backlinks.length}</span>
              </h3>
              {grouped.size === 0 ? <p className={styles['muted']}>{t('panel.noBacklinks')}</p> : null}
              {[...grouped.entries()].map(([sourceId, refs]) => (
                <div key={sourceId} className={styles['group']}>
                  <button
                    type="button"
                    className={styles['source']}
                    onClick={() => {
                      nav.openNote(sourceId);
                    }}
                  >
                    {index.byId.get(sourceId)?.title}
                  </button>
                  {refs.map((ref) => (
                    <p key={String(ref.link.from)} className={styles['context']}>
                      {ref.context}
                    </p>
                  ))}
                </div>
              ))}
            </section>
            <section aria-label={t('panel.mentions')}>
              <h3 className={styles['heading']}>
                {t('panel.mentions')} <span className={styles['count']}>{mentions.length}</span>
              </h3>
              {mentionGroups.size === 0 ? <p className={styles['muted']}>{t('panel.noMentions')}</p> : null}
              {[...mentionGroups.entries()].map(([sourceId, items]) => (
                <div key={sourceId} className={styles['group']}>
                  <button
                    type="button"
                    className={styles['source']}
                    onClick={() => {
                      nav.openNote(sourceId);
                    }}
                  >
                    {index.byId.get(sourceId)?.title}
                  </button>
                  {items.map((mention) => (
                    <div key={String(mention.from)} className={styles['mention']}>
                      <p className={styles['context']}>{mention.context}</p>
                      <IconButton
                        label={t('panel.linkMention')}
                        size="sm"
                        onClick={() => {
                          linkMention(sourceId, mention.from, mention.to);
                        }}
                      >
                        <Link2 aria-hidden="true" />
                      </IconButton>
                    </div>
                  ))}
                </div>
              ))}
            </section>
            <section aria-label={t('panel.outgoing')}>
              <h3 className={styles['heading']}>
                {t('panel.outgoing')} <span className={styles['count']}>{outgoing.length}</span>
              </h3>
              {outgoing.length === 0 ? <p className={styles['muted']}>{t('panel.noOutgoing')}</p> : null}
              <ul className={styles['list']}>
                {outgoing.map((ref) => {
                  const missing = ref.link.kind === 'note' && ref.targetId === null && ref.link.target !== '';
                  return (
                    <li key={String(ref.link.from)}>
                      <button
                        type="button"
                        className={cx(styles['outgoing'], missing && styles['missing'])}
                        title={missing ? t('panel.unresolved') : undefined}
                        onClick={() => void nav.openLink(ref.link, note.id)}
                      >
                        {linkLabel(ref.link)}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          </Tabs.Content>
          <Tabs.Content value="outline" className={styles['content']}>
            {parsed.headings.length === 0 ? <p className={styles['muted']}>{t('panel.noHeadings')}</p> : null}
            <ul className={styles['list']}>
              {parsed.headings.map((heading) => (
                <li key={`${String(heading.line)}-${heading.text}`}>
                  <button
                    type="button"
                    className={styles['outline']}
                    style={{ paddingLeft: `calc(${String(heading.level - 1)} * var(--space-3))` }}
                    onClick={() => {
                      nav.openNote(note.id, heading.text);
                    }}
                  >
                    {heading.text}
                  </button>
                </li>
              ))}
            </ul>
            {parsed.tags.length > 0 ? (
              <div className={styles['tags']}>
                {parsed.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={styles['tag']}
                    onClick={() => {
                      nav.openTag(tag);
                    }}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            ) : null}
          </Tabs.Content>
          <Tabs.Content value="properties" className={styles['content']}>
            {Object.keys(parsed.properties).length === 0 ? (
              <p className={styles['muted']}>{t('panel.noProperties')}</p>
            ) : null}
            <div className={styles['properties']}>
              {Object.entries(parsed.properties).map(([key, value]) => (
                <div key={key} className={styles['property']}>
                  <span className={styles['key']}>{key}</span>
                  <Input
                    key={`${note.id}:${valueText(value)}`}
                    size="sm"
                    defaultValue={valueText(value)}
                    aria-label={key}
                    onBlur={(event) => {
                      const next = parseValue(event.target.value, value);
                      if (valueText(next) === valueText(value)) return;
                      writeProperties({ ...parsed.properties, [key]: next });
                    }}
                  />
                  <IconButton
                    label={t('panel.removeProperty', { name: key })}
                    size="sm"
                    onClick={() => {
                      const { [key]: _removed, ...rest } = parsed.properties;
                      writeProperties(rest);
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                  </IconButton>
                </div>
              ))}
            </div>
            <form
              className={styles['add']}
              onSubmit={(event) => {
                event.preventDefault();
                const key = newKey.trim().replace(/[:\s]+/g, '-');
                if (!key || key in parsed.properties) return;
                writeProperties({ ...parsed.properties, [key]: null });
                setNewKey('');
              }}
            >
              <Input
                size="sm"
                value={newKey}
                placeholder={t('panel.propertyName')}
                aria-label={t('panel.propertyName')}
                onChange={(event) => {
                  setNewKey(event.target.value);
                }}
              />
              <IconButton label={t('panel.addProperty')} size="sm" type="submit">
                <Plus aria-hidden="true" />
              </IconButton>
            </form>
          </Tabs.Content>
          <Tabs.Content value="history" className={styles['content']}>
            <NoteHistory note={note} />
          </Tabs.Content>
        </ScrollArea>
      </Tabs.Root>
    </div>
  );
}
