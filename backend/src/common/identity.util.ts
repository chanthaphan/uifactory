import * as jwt from 'jsonwebtoken';
import { AuthUser } from '../auth/auth.types';
import { RequestIdentity } from '../execution/execution.types';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-uifactory-secret';
const ASSERTION_TTL = '5m';

/**
 * Build the server-trusted identity for outbound calls:
 *  - `context`: {{user_*}} template values (merged into REST/SQL params with precedence over client input)
 *  - `assertion`: a short-lived JWT (signed with JWT_SECRET) a downstream can verify to authenticate the user.
 */
export function buildIdentity(user?: AuthUser): RequestIdentity | undefined {
  if (!user) return undefined;
  const context: Record<string, string> = {
    user_id: user.id,
    user_email: user.email,
    user_name: user.name,
    user_role: user.role,
  };
  const assertion = jwt.sign(
    { email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { subject: user.id, issuer: 'uifactory', audience: 'uifactory-downstream', expiresIn: ASSERTION_TTL },
  );
  return { context, assertion };
}
