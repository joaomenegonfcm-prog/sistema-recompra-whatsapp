import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { RotateCcw, Save } from 'lucide-react';
import { Button } from '../../components/UI/Button';
import { Card } from '../../components/UI/Card';
import { Input } from '../../components/UI/Input';
import { Loading } from '../../components/UI/Loading';
import { buildWhatsAppMessage } from '../../lib/whatsapp';
import {
  getSettings,
  updateSettings,
  type AppSettings,
  type UpdateSettingsInput,
} from './settingsService';

const DEFAULT_MESSAGE_TEMPLATE = `Olá, {{cliente}}! Tudo bem? 😊

Já faz um tempo desde sua compra de {{produto}}.
Gostaria de repor seu estoque?

Se quiser, posso te ajudar por aqui mesmo.`;

type SettingsFormState = {
  defaultReorderDays: string;
  secondAttemptAfterDays: string;
  thirdAttemptAfterDays: string;
  maxAttempts: string;
  defaultMessageTemplate: string;
};

const emptyForm: SettingsFormState = {
  defaultReorderDays: '',
  secondAttemptAfterDays: '',
  thirdAttemptAfterDays: '',
  maxAttempts: '',
  defaultMessageTemplate: '',
};

function settingsToForm(settings: AppSettings): SettingsFormState {
  return {
    defaultReorderDays: String(settings.default_reorder_days),
    secondAttemptAfterDays: String(settings.second_attempt_after_days),
    thirdAttemptAfterDays: String(settings.third_attempt_after_days),
    maxAttempts: String(settings.max_attempts),
    defaultMessageTemplate: settings.default_message_template,
  };
}

function validatePositiveInteger(value: string, label: string): string | null {
  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    return `${label} deve ser um número inteiro maior que zero.`;
  }

  return null;
}

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [form, setForm] = useState<SettingsFormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);

    getSettings()
      .then((data) => {
        if (!active) return;
        setSettings(data);
        setForm(settingsToForm(data));
      })
      .catch((caughtError) => {
        if (!active) return;

        if (import.meta.env.DEV) {
          console.error('Erro ao carregar configurações:', caughtError);
        }

        setError('Não foi possível carregar as configurações. Tente novamente.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const messagePreview = useMemo(() => buildWhatsAppMessage({
    template: form.defaultMessageTemplate,
    customerName: 'Maria',
    product: 'Café Especial',
  }), [form.defaultMessageTemplate]);

  function updateField(field: keyof SettingsFormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setSuccessMessage(null);
  }

  function validateForm(): UpdateSettingsInput | null {
    const errors: Record<string, string> = {};
    const defaultReorderError = validatePositiveInteger(
      form.defaultReorderDays,
      'Dias padrão para recompra',
    );
    const secondAttemptError = validatePositiveInteger(
      form.secondAttemptAfterDays,
      'Dias para segunda tentativa',
    );
    const thirdAttemptError = validatePositiveInteger(
      form.thirdAttemptAfterDays,
      'Dias para terceira tentativa',
    );
    const maxAttempts = Number(form.maxAttempts);

    if (defaultReorderError) errors.defaultReorderDays = defaultReorderError;
    if (secondAttemptError) errors.secondAttemptAfterDays = secondAttemptError;
    if (thirdAttemptError) errors.thirdAttemptAfterDays = thirdAttemptError;

    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 3) {
      errors.maxAttempts = 'Máximo de tentativas deve ser um número entre 1 e 3.';
    }

    const template = form.defaultMessageTemplate.trim();
    if (!template) {
      errors.defaultMessageTemplate = 'Informe o template da mensagem.';
    } else if (!template.includes('{{cliente}}') || !template.includes('{{produto}}')) {
      errors.defaultMessageTemplate = 'O template precisa conter {{cliente}} e {{produto}}.';
    }

    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) return null;

    return {
      default_reorder_days: Number(form.defaultReorderDays),
      second_attempt_after_days: Number(form.secondAttemptAfterDays),
      third_attempt_after_days: Number(form.thirdAttemptAfterDays),
      max_attempts: maxAttempts,
      default_message_template: template,
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const payload = validateForm();
    if (!payload || !settings) return;

    setSaving(true);

    try {
      const updatedSettings = await updateSettings(settings.id, payload);
      setSettings(updatedSettings);
      setForm(settingsToForm(updatedSettings));
      setSuccessMessage('Configurações salvas com sucesso.');
    } catch (caughtError) {
      if (import.meta.env.DEV) {
        console.error('Erro ao salvar configurações:', caughtError);
      }

      setError('Não foi possível salvar as configurações. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  function restoreDefaultTemplate() {
    updateField('defaultMessageTemplate', DEFAULT_MESSAGE_TEMPLATE);
  }

  return (
    <section className="page-section">
      <div className="page-title">
        <p className="eyebrow">Preferências</p>
        <h1>Configurações</h1>
        <p>Defina a régua de recompra e a mensagem padrão do WhatsApp.</p>
      </div>

      {loading ? (
        <div className="table-state"><Loading /></div>
      ) : error && !settings ? (
        <div className="error-message" role="alert">
          <span>{error}</span>
          <Button type="button" variant="secondary" onClick={() => setReloadKey((key) => key + 1)}>
            Tentar novamente
          </Button>
        </div>
      ) : settings ? (
        <div className="settings-layout">
          <Card className="settings-form-card">
            <form className="settings-form" onSubmit={handleSubmit} noValidate>
              <section className="settings-section">
                <div>
                  <h2>Régua de recompra</h2>
                  <p>Defina os prazos usados nos novos ciclos e nas tentativas de contato.</p>
                </div>

                <div className="settings-grid">
                  <div className="form-field">
                    <Input
                      id="default-reorder-days"
                      label="Dias padrão para recompra"
                      type="number"
                      min="1"
                      step="1"
                      value={form.defaultReorderDays}
                      onChange={(event) => updateField('defaultReorderDays', event.target.value)}
                      aria-invalid={Boolean(fieldErrors.defaultReorderDays)}
                    />
                    {fieldErrors.defaultReorderDays && <span className="field-error">{fieldErrors.defaultReorderDays}</span>}
                  </div>

                  <div className="form-field">
                    <Input
                      id="second-attempt-days"
                      label="Dias para segunda tentativa"
                      type="number"
                      min="1"
                      step="1"
                      value={form.secondAttemptAfterDays}
                      onChange={(event) => updateField('secondAttemptAfterDays', event.target.value)}
                      aria-invalid={Boolean(fieldErrors.secondAttemptAfterDays)}
                    />
                    {fieldErrors.secondAttemptAfterDays && <span className="field-error">{fieldErrors.secondAttemptAfterDays}</span>}
                  </div>

                  <div className="form-field">
                    <Input
                      id="third-attempt-days"
                      label="Dias para terceira tentativa"
                      type="number"
                      min="1"
                      step="1"
                      value={form.thirdAttemptAfterDays}
                      onChange={(event) => updateField('thirdAttemptAfterDays', event.target.value)}
                      aria-invalid={Boolean(fieldErrors.thirdAttemptAfterDays)}
                    />
                    {fieldErrors.thirdAttemptAfterDays && <span className="field-error">{fieldErrors.thirdAttemptAfterDays}</span>}
                  </div>

                  <div className="form-field">
                    <Input
                      id="max-attempts"
                      label="Máximo de tentativas"
                      type="number"
                      min="1"
                      max="3"
                      step="1"
                      value={form.maxAttempts}
                      onChange={(event) => updateField('maxAttempts', event.target.value)}
                      aria-invalid={Boolean(fieldErrors.maxAttempts)}
                    />
                    <span className="form-help">Nesta versão, o limite máximo é de 3 tentativas.</span>
                    {fieldErrors.maxAttempts && <span className="field-error">{fieldErrors.maxAttempts}</span>}
                  </div>
                </div>
              </section>

              <section className="settings-section">
                <div className="settings-section-header">
                  <div>
                    <h2>Mensagem padrão</h2>
                    <p>Use os campos <code>{'{{cliente}}'}</code> e <code>{'{{produto}}'}</code> no texto.</p>
                  </div>
                  <Button type="button" variant="secondary" onClick={restoreDefaultTemplate} disabled={saving}>
                    <RotateCcw size={17} aria-hidden="true" />
                    Restaurar template padrão
                  </Button>
                </div>

                <label className="field" htmlFor="default-message-template">
                  <span>Template da mensagem</span>
                  <textarea
                    id="default-message-template"
                    className="textarea settings-template"
                    rows={9}
                    value={form.defaultMessageTemplate}
                    onChange={(event) => updateField('defaultMessageTemplate', event.target.value)}
                    aria-invalid={Boolean(fieldErrors.defaultMessageTemplate)}
                  />
                </label>
                {fieldErrors.defaultMessageTemplate && <span className="field-error">{fieldErrors.defaultMessageTemplate}</span>}
              </section>

              {successMessage && <div className="success-message" role="status">{successMessage}</div>}
              {error && <div className="error-message" role="alert">{error}</div>}

              <div className="settings-form-actions">
                <Button type="submit" disabled={saving}>
                  <Save size={18} aria-hidden="true" />
                  {saving ? 'Salvando...' : 'Salvar configurações'}
                </Button>
              </div>
            </form>
          </Card>

          <Card className="preview-card">
            <div>
              <p className="eyebrow">Preview</p>
              <h2>Mensagem para Maria</h2>
              <p>Produto: Café Especial</p>
            </div>
            <div className="settings-message-preview">{messagePreview || 'O preview aparecerá aqui.'}</div>
          </Card>
        </div>
      ) : null}
    </section>
  );
}
