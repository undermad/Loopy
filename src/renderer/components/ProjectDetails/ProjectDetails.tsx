import { useTranslation } from '@renderer/lib/i18n';
import { Field, Input } from '@renderer/ui';
import { projectNameSchema } from '@shared/project';

export interface ProjectDetailsValue {
  name: string;
}

export interface ProjectDetailsProps {
  value: ProjectDetailsValue;
  onChange: (value: ProjectDetailsValue) => void;
  autoFocus?: boolean;
}

export function validProjectDetails(value: ProjectDetailsValue): boolean {
  return projectNameSchema.safeParse(value.name).success;
}

export function ProjectDetails({ value, onChange, autoFocus = false }: ProjectDetailsProps) {
  const { t } = useTranslation('welcome');
  return (
    <Field label={t('projectName')} hint={t('projectNameHint')} required>
      <Input
        value={value.name}
        onChange={(event) => {
          onChange({ ...value, name: event.target.value });
        }}
        onFocus={(event) => {
          event.currentTarget.select();
        }}
        autoFocus={autoFocus}
        maxLength={200}
      />
    </Field>
  );
}
