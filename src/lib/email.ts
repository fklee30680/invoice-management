type NotificationInput = {
  invoiceId: string;
  departmentName: string;
  departmentEmail: string;
  subject: string;
  body: string;
  link: string;
};

type EmailInput = {
  invoiceId: string;
  subject: string;
  body: string;
  link: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  escalationLevel?: string;
  templateId?: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function bodyToHtml(body: string) {
  return escapeHtml(body)
    .split(/\r?\n/)
    .map((line) => (line ? `<p>${line}</p>` : "<br />"))
    .join("");
}

export async function sendDepartmentNotification(input: NotificationInput) {
  return sendEmail({
    invoiceId: input.invoiceId,
    subject: input.subject,
    body: input.body,
    link: input.link,
    to: [input.departmentEmail],
  }, `Email sent to ${input.departmentEmail}.`, `Mock notification recorded for ${input.departmentName}.`);
}

export async function sendEscalationNotification(input: EmailInput) {
  return sendEmail(
    input,
    `Escalation email sent to ${input.to.join(", ")}.`,
    `Mock escalation recorded for ${input.escalationLevel || "escalation"}.`,
  );
}

async function sendEmail(
  input: EmailInput,
  sentMessage: string,
  mockMessage: string,
) {
  const to = uniqueEmails(input.to);
  const cc = uniqueEmails(input.cc || []);
  const bcc = uniqueEmails(input.bcc || []);
  if (to.length === 0) {
    throw new Error("Email has no To recipients.");
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const smtpHost = process.env.SMTP_HOST;
  const from = process.env.EMAIL_FROM || "onboarding@resend.dev";

  if (resendApiKey) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        cc: cc.length ? cc : undefined,
        bcc: bcc.length ? bcc : undefined,
        subject: input.subject,
        text: input.body,
        html: bodyToHtml(input.body),
      }),
    });

    const payload = (await response.json().catch(() => null)) as
      | { id?: string; message?: string; error?: unknown }
      | null;

    if (!response.ok) {
      const message =
        payload?.message ||
        (typeof payload?.error === "string" ? payload.error : "") ||
        `Resend request failed with ${response.status}`;
      throw new Error(message);
    }

    return {
      mode: "resend",
      message: sentMessage,
      id: payload?.id || "",
    };
  }

  if (!smtpHost) {
    console.info("Notification queued", {
      from,
      to,
      cc,
      bcc,
      subject: input.subject,
      body: input.body,
      link: input.link,
      invoiceId: input.invoiceId,
      escalationLevel: input.escalationLevel,
      templateId: input.templateId,
    });
    return {
      mode: "mock",
      message: mockMessage,
    };
  }

  console.info("SMTP configuration detected. Add an SMTP sender implementation here.", {
    host: smtpHost,
    from,
    to,
    cc,
    bcc,
    subject: input.subject,
    body: input.body,
  });

  return {
    mode: "configured",
    message: sentMessage,
  };
}

function uniqueEmails(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim().toLowerCase())
        .filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)),
    ),
  );
}
