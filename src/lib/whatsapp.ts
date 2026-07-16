export type MessageParams = {
  template: string;
  customerName: string;
  product: string;
};

export function buildWhatsAppMessage({
  template,
  customerName,
  product,
}: MessageParams): string {
  return template
    .split('{{cliente}}').join(customerName)
    .split('{{produto}}').join(product);
}

export type WhatsAppLinkParams = {
  phone: string;
  message: string;
};

function normalizeWhatsAppPhone(phone: string): string {
  let cleanPhone = phone.replace(/\D/g, '');

  while (cleanPhone.startsWith('0')) {
    cleanPhone = cleanPhone.slice(1);
  }

  if (cleanPhone.length === 10 || cleanPhone.length === 11) {
    return `55${cleanPhone}`;
  }

  return cleanPhone;
}

export function buildWhatsAppLink({ phone, message }: WhatsAppLinkParams): string {
  const cleanPhone = normalizeWhatsAppPhone(phone);
  const encodedMessage = encodeURIComponent(message);

  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}
