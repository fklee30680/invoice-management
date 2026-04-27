type NotificationInput = {
  invoiceId: string;
  departmentName: string;
  departmentEmail: string;
  subject: string;
  body: string;
  link: string;
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
        to: [input.departmentEmail],
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
      message: `Email sent to ${input.departmentEmail}.`,
      id: payload?.id || "",
    };
  }

  if (!smtpHost) {
    console.info("Notification queued", {
      from,
      to: input.departmentEmail,
      subject: input.subject,
      body: input.body,
      link: input.link,
      invoiceId: input.invoiceId,
      departmentName: input.departmentName,
    });
    return {
      mode: "mock",
      message: `Mock notification recorded for ${input.departmentName}.`,
    };
  }

  console.info("SMTP configuration detected. Add an SMTP sender implementation here.", {
    host: smtpHost,
    from,
    to: input.departmentEmail,
    subject: input.subject,
    body: input.body,
  });

  return {
    mode: "configured",
    message: `Notification prepared for ${input.departmentName}.`,
  };
}
