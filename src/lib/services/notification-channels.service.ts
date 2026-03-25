/**
 * NotificationChannelsService — External notification channels (Slack, Email, WhatsApp).
 *
 * This service acts as a unified dispatcher for outbound notifications
 * beyond the in-app system. It routes messages to configured channels
 * based on notification type and tenant preferences.
 *
 * Current status:
 * - Slack: STUB — logs payload, ready for webhook integration
 * - Email: STUB — logs payload, ready for SMTP/Resend/SES integration
 * - WhatsApp: STUB — logs payload, ready for WhatsApp API integration
 */

export interface ChannelPayload {
  type: string;
  title: string;
  message?: string;
  entityType?: string;
  entityId?: string;
  taskId?: string;
  recipientEmail?: string;
  recipientPhone?: string;
  urgency?: "low" | "normal" | "high" | "critical";
}

// ── Slack ──────────────────────────────────────────────────────────────────

export class SlackNotificationChannel {
  private static webhookUrl = process.env.SLACK_WEBHOOK_URL;
  private static channel = process.env.SLACK_CHANNEL ?? "#horion-alerts";

  static async send(payload: ChannelPayload): Promise<void> {
    if (!this.webhookUrl) {
      // STUB: silently skip in production when Slack is not configured
      if (process.env.NODE_ENV !== "production") {
        console.log("[SlackChannel] STUB — would send:", {
          channel: this.channel,
          text: `*${payload.title}*${payload.message ? `\n${payload.message}` : ""}`,
          type: payload.type,
          urgency: payload.urgency,
        });
      }
      return;
    }

    try {
      const color =
        payload.urgency === "critical" ? "#ff0000" :
        payload.urgency === "high" ? "#ff9900" :
        payload.urgency === "normal" ? "#0066cc" :
        "#999999";

      const body = {
        channel: this.channel,
        attachments: [
          {
            color,
            title: payload.title,
            text: payload.message,
            footer: `Horion ERP | ${payload.entityType ? `${payload.entityType}:${payload.entityId}` : "system"}`,
            ts: Math.floor(Date.now() / 1000),
          },
        ],
      };

      await fetch(this.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      console.error("[SlackChannel] Failed to send notification:", err);
    }
  }

  static async sendSLAAlert(taskId: string, taskTitle: string, urgency: "high" | "critical"): Promise<void> {
    return this.send({
      type: "SLA_BREACH",
      title: urgency === "critical" ? `🚨 SLA DÉPASSÉ: ${taskTitle}` : `⚠️ SLA WARNING: ${taskTitle}`,
      message: `Action immédiate requise. Voir la tâche: /tasks/${taskId}`,
      entityType: "task",
      entityId: taskId,
      taskId,
      urgency,
    });
  }
}

// ── Email ──────────────────────────────────────────────────────────────────

export class EmailNotificationChannel {
  private static fromAddress = process.env.EMAIL_FROM ?? "noreply@horion.cd";
  private static provider =
    process.env.EMAIL_PROVIDER ??
    (process.env.RESEND_API_KEY ? "resend" : "stub"); // "resend" | "smtp" | "ses"

  static async send(payload: ChannelPayload & { to: string }): Promise<void> {
    if (!payload.to) return;

    if (this.provider === "stub") {
      // STUB: silently skip in production when no email provider is configured
      if (process.env.NODE_ENV !== "production") {
        console.log("[EmailChannel] STUB — would send:", {
          from: this.fromAddress,
          to: payload.to,
          subject: payload.title,
          body: payload.message,
          type: payload.type,
        });
      }
      return;
    }

    if (this.provider === "resend") {
      const apiKey = process.env.RESEND_API_KEY;
      if (!apiKey) {
        console.error("[EmailChannel] RESEND_API_KEY missing.");
        return;
      }

      try {
        const { renderEmailHtml } = await import("@/lib/email-templates");
        let ResendCtor: any = null;
        try {
          const mod = await import("resend");
          ResendCtor = mod.Resend;
        } catch (err) {
          console.error("[EmailChannel] Resend SDK not installed.", err);
          return;
        }

        const resend = new ResendCtor(apiKey);
        await resend.emails.send({
          from: this.fromAddress,
          to: payload.to,
          subject: payload.title,
          html: renderEmailHtml(payload),
          text: payload.message || undefined,
        });
      } catch (err) {
        console.error("[EmailChannel] Failed to send via Resend:", err);
      }
      return;
    }

    console.warn(`[EmailChannel] Provider "${this.provider}" not implemented.`);
  }

  static async sendTaskAssigned(
    recipientEmail: string,
    taskTitle: string,
    taskId: string,
    assignedByName: string
  ): Promise<void> {
    return this.send({
      to: recipientEmail,
      type: "TASK_ASSIGNED",
      title: `Tâche assignée: ${taskTitle}`,
      message: `${assignedByName} vous a assigné une nouvelle tâche. Consultez-la ici: /tasks/${taskId}`,
      entityType: "task",
      entityId: taskId,
      taskId,
      urgency: "normal",
    });
  }

  static async sendMentionNotification(
    recipientEmail: string,
    mentionedByName: string,
    taskTitle: string,
    taskId: string,
    commentExcerpt: string
  ): Promise<void> {
    return this.send({
      to: recipientEmail,
      type: "MENTION",
      title: `${mentionedByName} vous a mentionné dans: ${taskTitle}`,
      message: `"${commentExcerpt}"`,
      entityType: "task",
      entityId: taskId,
      taskId,
      urgency: "normal",
    });
  }
}

// ── WhatsApp ───────────────────────────────────────────────────────────────

export class WhatsAppNotificationChannel {
  private static apiUrl = process.env.WHATSAPP_API_URL;
  private static token = process.env.WHATSAPP_TOKEN;

  static async send(payload: ChannelPayload & { to: string }): Promise<void> {
    if (!this.apiUrl || !this.token) {
      // STUB: silently skip in production when WhatsApp API is not configured
      if (process.env.NODE_ENV !== "production") {
        console.log("[WhatsAppChannel] STUB — would send:", {
          to: payload.to,
          message: `*${payload.title}*${payload.message ? `\n${payload.message}` : ""}`,
          type: payload.type,
        });
      }
      return;
    }

    try {
      await fetch(`${this.apiUrl}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${this.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: payload.to,
          type: "text",
          text: {
            body: `*${payload.title}*${payload.message ? `\n${payload.message}` : ""}`,
          },
        }),
      });
    } catch (err) {
      console.error("[WhatsAppChannel] Failed to send notification:", err);
    }
  }
}

// ── Unified dispatcher ─────────────────────────────────────────────────────

export class NotificationChannelDispatcher {
  /**
   * Dispatch a notification to all configured external channels based on type.
   * Called after in-app notification is created.
   */
  static async dispatch(
    payload: ChannelPayload,
    options?: {
      slackEnabled?: boolean;
      emailTo?: string;
      whatsappTo?: string;
    }
  ): Promise<void> {
    const promises: Promise<void>[] = [];

    // Slack: always send for HIGH/CRITICAL urgency
    if (
      options?.slackEnabled !== false &&
      (payload.urgency === "high" || payload.urgency === "critical")
    ) {
      promises.push(SlackNotificationChannel.send(payload));
    }

    // Email: if recipient is provided
    if (options?.emailTo) {
      promises.push(
        EmailNotificationChannel.send({ ...payload, to: options.emailTo })
      );
    }

    // WhatsApp: if phone is provided and urgency is high/critical
    if (options?.whatsappTo && (payload.urgency === "high" || payload.urgency === "critical")) {
      promises.push(
        WhatsAppNotificationChannel.send({ ...payload, to: options.whatsappTo })
      );
    }

    await Promise.allSettled(promises);
  }
}
