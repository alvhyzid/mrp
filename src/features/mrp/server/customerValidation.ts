export const customerTypes = ['company', 'individual'];

export interface CustomerInput {
  name: string;
  customer_type: string;
  contact_info: string | null;
}

export function parseCustomerInput(body: Record<string, unknown>): { input?: CustomerInput; error?: string } {
  const name = String(body.name ?? '').trim();
  const customerType = String(body.customer_type ?? 'company').trim();
  const contactInfo = String(body.contact_info ?? '').trim();

  if (!name) {
    return { error: 'Nama client wajib diisi.' };
  }

  if (!customerTypes.includes(customerType)) {
    return { error: 'Tipe client tidak valid.' };
  }

  return {
    input: {
      name,
      customer_type: customerType,
      contact_info: contactInfo || null
    }
  };
}
