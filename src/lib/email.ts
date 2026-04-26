type NotificationInput = {
  invoiceId: string;
  departmentName: string;
  departmentEmail: string;
  subject: string;
  link: string;
};

export async function sendDepartmentNotification(input: NotificationInput) {
  const smtpHost = process.env.SMTP_HOST;
  const from = process.env.EMAIL_FROM || "ap@example.com";

  if (!smtpHost) {
    console.info("Notification queued", {
      from,
      to: input.departmentEmail,
      subject: input.subject,
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
  });

  return {
    mode: "configured",
    message: `Notification prepared for ${input.departmentName}.`,
  };
}

