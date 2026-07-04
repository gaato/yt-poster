import type { Config } from "../config.ts";
import type { XAccount, XAuthorizationCompletion } from "../domain.ts";
import type { XPublisherPort } from "../ports.ts";

export class AccountService {
  constructor(
    private readonly config: Config,
    private readonly x: XPublisherPort,
  ) {}

  getDefaultAccount(): XAccount | undefined {
    return this.x.getAccount(this.config.defaultXAccountId);
  }

  disconnectDefaultAccount(): void {
    this.x.disconnectAccount(this.config.defaultXAccountId);
  }

  createAuthorizationUrl(returnTo?: string | undefined): Promise<string> {
    return this.x.createAuthorizationUrl(this.config.defaultXAccountId, returnTo);
  }

  completeAuthorization(code: string, state: string): Promise<XAuthorizationCompletion> {
    return this.x.completeAuthorization(code, state);
  }
}
