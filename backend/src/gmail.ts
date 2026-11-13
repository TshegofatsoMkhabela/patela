import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import nodemailer from "nodemailer";
import type { MailMessage, MailTransport } from "./email.js";

/** The secret at SMTP_SECRET_ARN, stored by the user: `{"user":"x@gmail.com","appPassword":"..."}`. */
export type SmtpSecret = { user: string; appPassword: string };
type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  auth: { user: string; pass: string };
};
type Sender = { sendMail(mail: MailMessage & { from: string }): Promise<unknown> };

export function parseSmtpSecret(raw: string): SmtpSecret {
  let value: Record<string, unknown>;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("SMTP secret must be JSON with user and appPassword");
  }
  if (
    typeof value.user !== "string" ||
    !value.user.includes("@") ||
    typeof value.appPassword !== "string"
  ) {
    throw new Error("SMTP secret must be JSON with user and appPassword");
  }
  // Google shows app passwords in groups of four; SMTP wants them without spaces.
  return { user: value.user, appPassword: value.appPassword.replace(/\s+/g, "") };
}

export function secretsManagerLoader(secretArn: string): () => Promise<SmtpSecret> {
  return async () => {
    const result = await new SecretsManagerClient({}).send(
      new GetSecretValueCommand({ SecretId: secretArn }),
    );
    if (!result.SecretString) throw new Error("SMTP secret is empty");
    return parseSmtpSecret(result.SecretString);
  };
}

/** Gmail SMTP with an app password. The secret is read once per Lambda container, and again only after a failure. */
export class GmailTransport implements MailTransport {
  private sender?: Promise<{ sender: Sender; from: string }>;

  constructor(
    private readonly loadSecret: () => Promise<SmtpSecret>,
    private readonly createSender: (config: SmtpConfig) => Sender = (config) =>
      nodemailer.createTransport(config),
  ) {}

  async send(message: MailMessage): Promise<void> {
    this.sender ??= this.loadSecret().then((secret) => ({
      from: `Patela demo <${secret.user}>`,
      sender: this.createSender({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: { user: secret.user, pass: secret.appPassword },
      }),
    }));
    let ready;
    try {
      ready = await this.sender;
    } catch (error) {
      this.sender = undefined;
      throw error;
    }
    await ready.sender.sendMail({ ...message, from: ready.from });
  }
}
