import { prisma } from '../lib/prisma';

/**
 * Generates the next UHID atomically.
 *
 * Format:
 *   1st–9999th patient   → UHID-0001 ... UHID-9999   (4-digit)
 *   10000th patient on   → UHID-000001, UHID-000002  (6-digit, restarts at 1)
 *
 * Safety: relies on MySQL's AUTO_INCREMENT on UhidSequence, which is
 * handled internally by the database engine and is safe under concurrent
 * writes. Two doctors registering patients at the same instant will
 * always receive two different sequence numbers — this cannot produce
 * a duplicate UHID, unlike a doctor manually typing one in.
 */
export async function generateNextUhid(): Promise<string> {
  const { id: n } = await prisma.uhidSequence.create({ data: {} });

  if (n <= 9999) {
    return `UHID-${String(n).padStart(4, '0')}`;
  }

  const adjusted = n - 9999;
  return `UHID-${String(adjusted).padStart(6, '0')}`;
}
