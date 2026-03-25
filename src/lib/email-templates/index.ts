import { renderApprovalRequiredEmail } from "./approval-required";
import { renderCrmEmail } from "./crm-email";
import { renderInvoiceDueEmail } from "./invoice-due";
import { renderOrderConfirmedEmail } from "./order-confirmed";
import { renderSlaBreachEmail } from "./sla-breach";
import { renderTaskAssignedEmail } from "./task-assigned";
import { renderTeamInviteEmail } from "./team-invite";
export {
  renderNurturingWelcomeEmail,
  renderNurturingFollowUpEmail,
  renderNurturingReminderEmail,
} from "./nurturing-templates";

export type EmailTemplatePayload = {
  type: string;
  title: string;
  message?: string;
  entityType?: string;
  entityId?: string;
  taskId?: string;
};

function resolveEntityUrl(payload: EmailTemplatePayload) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "";
  if (!appUrl) return undefined;

  if (payload.taskId) return `${appUrl}/tasks/${payload.taskId}`;
  if (payload.entityType && payload.entityId) return `${appUrl}/${payload.entityType}/${payload.entityId}`;
  return undefined;
}

export function renderEmailHtml(payload: EmailTemplatePayload) {
  const entityUrl = resolveEntityUrl(payload);

  switch (payload.type) {
    case "TASK_ASSIGNED":
      return renderTaskAssignedEmail({
        title: payload.title,
        message: payload.message,
        taskUrl: entityUrl,
      });
    case "SLA_BREACH":
      return renderSlaBreachEmail({
        title: payload.title,
        message: payload.message,
        taskUrl: entityUrl,
      });
    case "APPROVAL_REQUIRED":
      return renderApprovalRequiredEmail({
        title: payload.title,
        message: payload.message,
        taskUrl: entityUrl,
      });
    case "ORDER_CONFIRMED":
      return renderOrderConfirmedEmail({
        title: payload.title,
        message: payload.message,
        orderUrl: entityUrl,
      });
    case "INVOICE_DUE":
      return renderInvoiceDueEmail({
        title: payload.title,
        message: payload.message,
        invoiceUrl: entityUrl,
      });
    case "TEAM_INVITE":
      return renderTeamInviteEmail({
        title: payload.title,
        message: payload.message,
        loginUrl: entityUrl,
      });
    case "CRM_EMAIL":
      return renderCrmEmail({
        title: payload.title,
        message: payload.message,
      });
    default:
      return renderTaskAssignedEmail({
        title: payload.title,
        message: payload.message,
        taskUrl: entityUrl,
      });
  }
}
