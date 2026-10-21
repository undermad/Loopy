import { useState, type ComponentProps } from 'react';
import { ArrowLeft, ArrowRight, Trash2, X } from 'lucide-react';
import { BOARD_LINK_KINDS, type BoardLink } from '@shared/board';
import {
  COLUMN_ID_PATTERN,
  TABLE_COLUMN_KINDS,
  tableColumnSchema,
  type DataTable,
  type DataTableSummary,
  type TableColumn,
  type TableColumnKind,
} from '@shared/tables';
import { useTranslation } from '@renderer/lib/i18n';
import {
  Button,
  Field,
  IconButton,
  Input,
  NumberInput,
  PropertySection,
  Select,
  Switch,
  TextArea,
} from '@renderer/ui';
import { KEY_COLUMN } from './TableGrid';
import styles from './ColumnSettings.module.scss';

type DraftInputProps = Omit<ComponentProps<typeof Input>, 'value' | 'onChange'> & {
  value: string;
  onCommit: (value: string) => void;
};

function DraftInput({ value, onCommit, ...rest }: DraftInputProps) {
  const [draft, setDraft] = useState(value);
  const [base, setBase] = useState(value);
  if (base !== value) {
    setBase(value);
    setDraft(value);
  }
  const commit = () => {
    if (draft !== value) onCommit(draft);
  };
  return (
    <Input
      size="sm"
      {...rest}
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') commit();
        if (event.key === 'Escape') setDraft(value);
      }}
    />
  );
}

function OptionsInput({
  column,
  onChange,
}: {
  column: Extract<TableColumn, { kind: 'choice' }>;
  onChange: (next: TableColumn) => void;
}) {
  const text = column.options.map((option) => option.value).join('\n');
  const [draft, setDraft] = useState(text);
  const [base, setBase] = useState(text);
  if (base !== text) {
    setBase(text);
    setDraft(text);
  }
  return (
    <TextArea
      rows={5}
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
      }}
      onBlur={() => {
        if (draft === text) return;
        const values = [
          ...new Set(
            draft
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean),
          ),
        ];
        const options = values.map(
          (value) => column.options.find((option) => option.value === value) ?? { value, colour: null },
        );
        onChange({ ...column, options });
      }}
    />
  );
}

export interface ColumnSettingsProps {
  table: DataTable;
  columnId: string;
  tables: readonly DataTableSummary[];
  onColumns: (columns: TableColumn[]) => void;
  onKeyName: (keyName: string) => void;
  onClose: () => void;
}

export function ColumnSettings({
  table,
  columnId,
  tables,
  onColumns,
  onKeyName,
  onClose,
}: ColumnSettingsProps) {
  const { t } = useTranslation('tables');
  const { t: te } = useTranslation('editors');
  const index = table.columns.findIndex((column) => column.id === columnId);
  const column = table.columns[index];
  const taken = new Set([table.keyName, ...table.columns.map((item) => item.id)]);

  const replace = (next: TableColumn) => {
    onColumns(table.columns.map((item, position) => (position === index ? next : item)));
  };

  const header = (title: string) => (
    <header className={styles['header']}>
      <h3 className={styles['title']}>{title}</h3>
      <IconButton label={t('column.close')} size="sm" tooltip={false} onClick={onClose}>
        <X aria-hidden="true" />
      </IconButton>
    </header>
  );

  if (columnId === KEY_COLUMN) {
    return (
      <aside className={styles['panel']} aria-label={t('column.title')}>
        {header(t('column.keyTitle'))}
        <p className={styles['hint']}>{t('editor.keyHint')}</p>
        <Field label={t('column.keyName')} hint={t('column.idHint')}>
          <DraftInput
            value={table.keyName}
            onCommit={(value) => {
              const next = value.trim();
              if (COLUMN_ID_PATTERN.test(next) && !table.columns.some((item) => item.id === next))
                onKeyName(next);
            }}
          />
        </Field>
      </aside>
    );
  }

  if (!column) return null;

  const changeKind = (kind: TableColumnKind) => {
    replace(
      tableColumnSchema.parse({
        id: column.id,
        label: column.label,
        width: column.width,
        required: column.required,
        unique: column.unique,
        description: column.description,
        kind,
      }),
    );
  };

  const move = (offset: number) => {
    const target = index + offset;
    if (target < 0 || target >= table.columns.length) return;
    const next = [...table.columns];
    const [moved] = next.splice(index, 1);
    if (moved) next.splice(target, 0, moved);
    onColumns(next);
  };

  return (
    <aside className={styles['panel']} aria-label={t('column.title')}>
      {header(t('column.title'))}
      <PropertySection title={t('column.basics')} defaultOpen>
        <Field label={t('column.label')}>
          <DraftInput
            value={column.label}
            onCommit={(label) => {
              replace({ ...column, label: label.trim().slice(0, 80) });
            }}
          />
        </Field>
        <Field label={t('column.id')} hint={t('column.idHint')}>
          <DraftInput
            value={column.id}
            onCommit={(id) => {
              const next = id.trim();
              if (COLUMN_ID_PATTERN.test(next) && !taken.has(next)) replace({ ...column, id: next });
            }}
          />
        </Field>
        <Field label={t('column.kind')}>
          <Select
            size="sm"
            value={column.kind}
            options={TABLE_COLUMN_KINDS.map((kind) => ({ value: kind, label: t(`kinds.${kind}`) }))}
            onValueChange={(kind) => {
              changeKind(kind as TableColumnKind);
            }}
          />
        </Field>
        <Field label={t('column.description')}>
          <DraftInput
            value={column.description}
            onCommit={(description) => {
              replace({ ...column, description: description.slice(0, 300) });
            }}
          />
        </Field>
      </PropertySection>
      <PropertySection title={t('column.value')} defaultOpen>
        {column.kind === 'text' ? (
          <>
            <Switch
              label={t('column.multiline')}
              checked={column.multiline}
              onCheckedChange={(multiline) => {
                replace({ ...column, multiline });
              }}
            />
            <Field label={t('column.maxLength')}>
              <NumberInput
                size="sm"
                nullable
                min={1}
                max={5000}
                value={column.maxLength}
                onValueChange={(maxLength) => {
                  replace({ ...column, maxLength: maxLength === null ? null : Math.round(maxLength) });
                }}
              />
            </Field>
          </>
        ) : null}
        {column.kind === 'number' ? (
          <>
            <Switch
              label={t('column.integer')}
              checked={column.integer}
              onCheckedChange={(integer) => {
                replace({ ...column, integer });
              }}
            />
            <Field label={t('column.min')}>
              <NumberInput
                size="sm"
                nullable
                value={column.min}
                onValueChange={(min) => {
                  replace({ ...column, min });
                }}
              />
            </Field>
            <Field label={t('column.max')}>
              <NumberInput
                size="sm"
                nullable
                value={column.max}
                onValueChange={(max) => {
                  replace({ ...column, max });
                }}
              />
            </Field>
          </>
        ) : null}
        {column.kind === 'choice' ? (
          <>
            <Field label={t('column.options')} hint={t('column.optionsHint')}>
              <OptionsInput column={column} onChange={replace} />
            </Field>
            <Switch
              label={t('column.multiple')}
              checked={column.multiple}
              onCheckedChange={(multiple) => {
                replace({ ...column, multiple });
              }}
            />
          </>
        ) : null}
        {column.kind === 'reference' ? (
          <>
            <Field label={t('column.table')}>
              <Select
                size="sm"
                value={column.tableId ?? ''}
                placeholder={t('editor.pick')}
                options={tables.map((item) => ({ value: item.id, label: item.name }))}
                onValueChange={(tableId) => {
                  replace({ ...column, tableId });
                }}
              />
            </Field>
            <Switch
              label={t('column.multiple')}
              checked={column.multiple}
              onCheckedChange={(multiple) => {
                replace({ ...column, multiple });
              }}
            />
          </>
        ) : null}
        {column.kind === 'link' ? (
          <>
            <fieldset className={styles['kinds']}>
              <legend>{t('column.linkKinds')}</legend>
              {BOARD_LINK_KINDS.map((kind: BoardLink['kind']) => (
                <Switch
                  key={kind}
                  size="sm"
                  label={te(`assetLink.kinds.${kind}`)}
                  checked={column.linkKinds.includes(kind)}
                  onCheckedChange={(on) => {
                    replace({
                      ...column,
                      linkKinds: on
                        ? [...column.linkKinds, kind]
                        : column.linkKinds.filter((item) => item !== kind),
                    });
                  }}
                />
              ))}
            </fieldset>
            <Switch
              label={t('column.multiple')}
              checked={column.multiple}
              onCheckedChange={(multiple) => {
                replace({ ...column, multiple });
              }}
            />
          </>
        ) : null}
        {column.kind === 'formula' ? (
          <>
            <Field label={t('column.expression')} hint={t('column.expressionHint')}>
              <DraftInput
                className={styles['mono']}
                value={column.expression}
                onCommit={(expression) => {
                  replace({ ...column, expression: expression.slice(0, 500) });
                }}
              />
            </Field>
            <Field label={t('column.decimals')}>
              <NumberInput
                size="sm"
                nullable
                min={0}
                max={6}
                value={column.decimals}
                onValueChange={(decimals) => {
                  replace({ ...column, decimals: decimals === null ? null : Math.round(decimals) });
                }}
              />
            </Field>
          </>
        ) : null}
      </PropertySection>
      {column.kind === 'formula' ? null : (
        <PropertySection title={t('column.rules')} defaultOpen>
          <Switch
            label={t('column.required')}
            checked={column.required}
            onCheckedChange={(required) => {
              replace({ ...column, required });
            }}
          />
          <Switch
            label={t('column.unique')}
            checked={column.unique}
            onCheckedChange={(unique) => {
              replace({ ...column, unique });
            }}
          />
        </PropertySection>
      )}
      <div className={styles['actions']}>
        <IconButton
          label={t('column.moveLeft')}
          size="sm"
          disabled={index === 0}
          onClick={() => {
            move(-1);
          }}
        >
          <ArrowLeft aria-hidden="true" />
        </IconButton>
        <IconButton
          label={t('column.moveRight')}
          size="sm"
          disabled={index === table.columns.length - 1}
          onClick={() => {
            move(1);
          }}
        >
          <ArrowRight aria-hidden="true" />
        </IconButton>
        <Button
          size="sm"
          variant="danger"
          icon={<Trash2 aria-hidden="true" />}
          onClick={() => {
            onColumns(table.columns.filter((item) => item.id !== column.id));
            onClose();
          }}
        >
          {t('column.delete')}
        </Button>
      </div>
    </aside>
  );
}
