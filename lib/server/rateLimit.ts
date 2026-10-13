import { currentSession, accountRateLimited } from './auth';

/** Limits belong to the verified account, so shared Wi-Fi does not share a quota. */
export async function rateLimited(
  _req: Request,
  bucket: string,
  limit: number,
  windowMs = 60_000,
): Promise<boolean> {
  const session = await currentSession();
  // Authentication is enforced by the route; public safety replies need no quota.
  if (!session) return false;
  return accountRateLimited(session.customerId, bucket, limit, Math.ceil(windowMs / 1000));
}
