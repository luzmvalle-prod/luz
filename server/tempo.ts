// Data e hora local do sistema (fuso de Pernambuco por padrão).

const TZ = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.TZ_SINISTROS ?? 'America/Recife';

/** Data e hora local no formato YYYY-MM-DDTHH:mm. */
export function agora(d = new Date()): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export const hoje = () => agora().slice(0, 10);
