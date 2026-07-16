import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type TodayContact = {
  purchase_id: string;
  customer_id: string;
  customer_name: string;
  phone: string;
  product: string;
  purchase_date: string;
  reorder_date: string;
  status: 'active' | 'in_followup';
  attempts_count: number;
  next_attempt_number: number | null;
  next_contact_date: string;
  user_id: string;
};

type SummaryError = {
  userId?: string;
  email?: string;
  message: string;
};

type UserSettings = {
  default_message_template: string | null;
};

const fallbackMessageTemplate = `Olá, {{cliente}}! Tudo bem? 😊

Já faz um tempo desde sua compra de {{produto}}.
Gostaria de repor seu estoque?

Se quiser, posso te ajudar por aqui mesmo.`;

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const resendApiKey = Deno.env.get('RESEND_API_KEY');
const fromEmail = Deno.env.get('DAILY_SUMMARY_FROM_EMAIL');
const summaryEnabled = Deno.env.get('DAILY_SUMMARY_ENABLED') ?? 'true';

const jsonHeaders = {
  'Content-Type': 'application/json',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDate(value: string) {
  const [year, month, day] = value.split('-');

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function getTodayDateLabel() {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date());
}

function normalizePhone(phone: string) {
  let digits = phone.replace(/\D/g, '');

  while (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  if (digits.length === 10 || digits.length === 11) {
    return `55${digits}`;
  }

  return digits;
}

function buildWhatsAppMessage(template: string, contact: TodayContact) {
  return template
    .split('{{cliente}}').join(contact.customer_name)
    .split('{{produto}}').join(contact.product);
}

function buildWhatsAppLink(contact: TodayContact, template: string) {
  const phone = normalizePhone(contact.phone);
  const message = buildWhatsAppMessage(template, contact);

  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function getMessageTemplate(settings: UserSettings | null) {
  const template = settings?.default_message_template?.trim();

  return template || fallbackMessageTemplate;
}

function buildTextEmail(contacts: TodayContact[], messageTemplate: string) {
  const lines = contacts.map((contact) => [
    `* ${contact.customer_name}`,
    `  Telefone: ${contact.phone}`,
    `  Produto: ${contact.product}`,
    `  Data da compra: ${formatDate(contact.purchase_date)}`,
    `  Data prevista de recompra: ${formatDate(contact.reorder_date)}`,
    `  Tentativa atual: ${contact.next_attempt_number ?? '-'}`,
    `  WhatsApp: ${buildWhatsAppLink(contact, messageTemplate)}`,
  ].join('\n'));

  return [
    'Olá!',
    '',
    `Hoje você tem ${contacts.length} cliente(s) para chamar pelo WhatsApp.`,
    '',
    'Lista:',
    '',
    lines.join('\n\n'),
    '',
    'Acesse o sistema para abrir o WhatsApp com a mensagem pronta e marcar os contatos como enviados.',
  ].join('\n');
}

function buildHtmlEmail(contacts: TodayContact[], messageTemplate: string) {
  const cards = contacts.map((contact) => {
    const whatsappLink = buildWhatsAppLink(contact, messageTemplate);

    return `
      <article style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 0 0 16px; background: #ffffff;">
        <h2 style="font-size: 18px; margin: 0 0 8px; color: #111827;">${escapeHtml(contact.customer_name)}</h2>
        <dl style="margin: 0 0 16px;">
          <div style="margin: 0 0 6px;"><dt style="display: inline; font-weight: 700;">Telefone: </dt><dd style="display: inline; margin: 0;">${escapeHtml(contact.phone)}</dd></div>
          <div style="margin: 0 0 6px;"><dt style="display: inline; font-weight: 700;">Produto: </dt><dd style="display: inline; margin: 0;">${escapeHtml(contact.product)}</dd></div>
          <div style="margin: 0 0 6px;"><dt style="display: inline; font-weight: 700;">Data da compra: </dt><dd style="display: inline; margin: 0;">${escapeHtml(formatDate(contact.purchase_date))}</dd></div>
          <div style="margin: 0 0 6px;"><dt style="display: inline; font-weight: 700;">Recompra prevista: </dt><dd style="display: inline; margin: 0;">${escapeHtml(formatDate(contact.reorder_date))}</dd></div>
          <div><dt style="display: inline; font-weight: 700;">Tentativa atual: </dt><dd style="display: inline; margin: 0;">${escapeHtml(String(contact.next_attempt_number ?? '-'))}</dd></div>
        </dl>
        <a href="${escapeHtml(whatsappLink)}" target="_blank" rel="noopener noreferrer" style="display: inline-block; padding: 10px 14px; border-radius: 6px; background: #15803d; color: #ffffff; font-weight: 700; text-decoration: none;">
          Abrir WhatsApp
        </a>
      </article>
    `;
  }).join('');

  return `
    <!doctype html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Resumo diário de recompras</title>
      </head>
      <body style="margin: 0; padding: 24px; background: #f3f4f6; font-family: Arial, sans-serif; color: #111827; line-height: 1.5;">
        <main style="max-width: 720px; margin: 0 auto;">
          <section style="background: #ffffff; border-radius: 8px; padding: 20px; margin-bottom: 16px;">
            <p style="margin-top: 0;">Olá!</p>
            <p>Hoje você tem <strong>${contacts.length}</strong> cliente(s) para chamar pelo WhatsApp.</p>
            <p style="margin-bottom: 0;">Use os botões abaixo para abrir o WhatsApp com a mensagem pronta. O envio continua manual.</p>
          </section>
          ${cards}
          <p style="color: #4b5563;">Acesse o sistema para marcar os contatos como enviados depois de concluir o envio manual pelo WhatsApp.</p>
        </main>
      </body>
    </html>
  `;
}

async function sendEmail(params: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: fromEmail,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
    }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(responseText || `Resend retornou HTTP ${response.status}`);
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return jsonResponse({ success: false, message: 'Método não permitido.' }, 405);
  }

  if (summaryEnabled.toLowerCase() === 'false') {
    console.log('Resumo diário desativado por DAILY_SUMMARY_ENABLED=false.');

    return jsonResponse({
      success: true,
      usersProcessed: 0,
      emailsSent: 0,
      errors: [],
    });
  }

  const missingVariables = [
    ['SUPABASE_URL', supabaseUrl],
    ['SUPABASE_SERVICE_ROLE_KEY', serviceRoleKey],
    ['RESEND_API_KEY', resendApiKey],
    ['DAILY_SUMMARY_FROM_EMAIL', fromEmail],
  ].filter(([, value]) => !value).map(([name]) => name);

  if (missingVariables.length > 0) {
    return jsonResponse({
      success: false,
      usersProcessed: 0,
      emailsSent: 0,
      errors: [{ message: `Variáveis ausentes: ${missingVariables.join(', ')}` }],
    }, 500);
  }

  const supabase = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const errors: SummaryError[] = [];
  let usersProcessed = 0;
  let emailsSent = 0;
  let page = 1;
  const perPage = 1000;
  const dateLabel = getTodayDateLabel();
  const subject = `Resumo diário de recompras — ${dateLabel}`;

  try {
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({
        page,
        perPage,
      });

      if (error) {
        throw error;
      }

      const users = data.users ?? [];

      if (users.length === 0) {
        break;
      }

      for (const user of users) {
        usersProcessed += 1;

        if (!user.email) {
          errors.push({ userId: user.id, message: 'Usuário sem e-mail cadastrado.' });
          continue;
        }

        const { data: contacts, error: contactsError } = await supabase
          .from('today_contacts')
          .select('*')
          .eq('user_id', user.id)
          .order('next_contact_date', { ascending: true });

        if (contactsError) {
          errors.push({
            userId: user.id,
            email: user.email,
            message: contactsError.message,
          });
          continue;
        }

        const todayContacts = (contacts ?? []) as TodayContact[];

        if (todayContacts.length === 0) {
          continue;
        }

        const { data: settings, error: settingsError } = await supabase
          .from('settings')
          .select('default_message_template')
          .eq('user_id', user.id)
          .maybeSingle();

        if (settingsError) {
          console.error(`Erro ao carregar configurações do usuário ${user.id}:`, settingsError);
        }

        const messageTemplate = getMessageTemplate((settings ?? null) as UserSettings | null);

        try {
          await sendEmail({
            to: user.email,
            subject,
            html: buildHtmlEmail(todayContacts, messageTemplate),
            text: buildTextEmail(todayContacts, messageTemplate),
          });

          emailsSent += 1;
        } catch (sendError) {
          errors.push({
            userId: user.id,
            email: user.email,
            message: sendError instanceof Error ? sendError.message : 'Erro desconhecido ao enviar e-mail.',
          });
        }
      }

      if (users.length < perPage) {
        break;
      }

      page += 1;
    }

    console.log(`Usuários processados: ${usersProcessed}`);
    console.log(`E-mails enviados: ${emailsSent}`);

    if (errors.length > 0) {
      console.error('Erros no resumo diário:', errors);
    }

    return jsonResponse({
      success: errors.length === 0,
      usersProcessed,
      emailsSent,
      errors,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido.';
    errors.push({ message });
    console.error('Erro ao gerar resumo diário:', error);

    return jsonResponse({
      success: false,
      usersProcessed,
      emailsSent,
      errors,
    }, 500);
  }
});
