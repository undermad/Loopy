import { useState } from 'react';
import { MessageSquare, Pencil, Trash2 } from 'lucide-react';
import type { Comment } from '@shared/tickets';
import { useFormat, useTranslation } from '@renderer/lib/i18n';
import { commentActions } from '@renderer/lib/tickets';
import { Button, ConfirmDialog, IconButton, RichContent, RichText, isEmptyRichText } from '@renderer/ui';
import { useRichTextLabels } from './useRichTextLabels';
import styles from './Comments.module.scss';

function CommentItem({ comment }: { comment: Comment }) {
  const { t } = useTranslation('editors');
  const { t: tc } = useTranslation('common');
  const format = useFormat();
  const labels = useRichTextLabels();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.body);
  const [confirm, setConfirm] = useState(false);

  async function save() {
    if (!isEmptyRichText(draft) && draft !== comment.body) await commentActions.update(comment.id, draft);
    setEditing(false);
  }

  return (
    <li className={styles['comment']}>
      <div className={styles['meta']}>
        <span>{format.relative(comment.createdAt)}</span>
        {comment.updatedAt !== comment.createdAt ? <span>({t('ticket.edited')})</span> : null}
        <span className={styles['actions']}>
          <IconButton
            label={t('ticket.editComment')}
            size="sm"
            onClick={() => {
              setDraft(comment.body);
              setEditing(true);
            }}
          >
            <Pencil aria-hidden="true" />
          </IconButton>
          <IconButton
            label={t('ticket.deleteComment')}
            size="sm"
            onClick={() => {
              setConfirm(true);
            }}
          >
            <Trash2 aria-hidden="true" />
          </IconButton>
        </span>
      </div>
      {editing ? (
        <div className={styles['compose']}>
          <RichText
            value={draft}
            labels={labels}
            compact
            autoFocus
            onChange={setDraft}
            onSubmit={() => void save()}
          />
          <div className={styles['buttons']}>
            <Button size="sm" variant="primary" disabled={isEmptyRichText(draft)} onClick={() => void save()}>
              {tc('actions.save')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
              }}
            >
              {tc('actions.cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <RichContent html={comment.body} />
      )}
      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={t('ticket.deleteComment')}
        description={t('ticket.deleteCommentConfirm')}
        confirmLabel={tc('actions.delete')}
        cancelLabel={tc('actions.cancel')}
        closeLabel={tc('actions.close')}
        destructive
        onConfirm={() => commentActions.remove(comment.id).then(() => undefined)}
      />
    </li>
  );
}

export function Comments({ ticketId, comments }: { ticketId: string; comments: Comment[] }) {
  const { t } = useTranslation('editors');
  const labels = useRichTextLabels();
  const [draft, setDraft] = useState('');
  const [version, setVersion] = useState(0);

  async function submit() {
    if (isEmptyRichText(draft)) return;
    await commentActions.create(ticketId, draft);
    setDraft('');
    setVersion((current) => current + 1);
  }

  return (
    <section className={styles['section']} aria-label={t('ticket.comments')}>
      <h3 className={styles['heading']}>
        <MessageSquare aria-hidden="true" />
        {t('ticket.comments')}
        <span className={styles['count']}>{comments.length}</span>
      </h3>
      {comments.length === 0 ? <p className={styles['empty']}>{t('ticket.noComments')}</p> : null}
      <ul className={styles['list']}>
        {comments.map((comment) => (
          <CommentItem key={comment.id} comment={comment} />
        ))}
      </ul>
      <div className={styles['compose']}>
        <RichText
          key={version}
          value={draft}
          labels={labels}
          compact
          placeholder={t('ticket.commentPlaceholder')}
          onChange={setDraft}
          onSubmit={() => void submit()}
        />
        <div className={styles['buttons']}>
          <Button size="sm" variant="primary" disabled={isEmptyRichText(draft)} onClick={() => void submit()}>
            {t('ticket.addComment')}
          </Button>
        </div>
      </div>
    </section>
  );
}
