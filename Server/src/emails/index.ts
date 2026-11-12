// Every email the platform sends, grouped by who receives it.

// Customers and owners (anyone who signs up)
export { verifyEmail } from "./verify-email.email";
export { passwordChangedEmail } from "./password-changed.email";
export { resetPasswordEmail } from "./reset-password.email";

// Restaurant team members
export { staffInviteEmail } from "./staff-invite.email";
export { staffAddedEmail } from "./staff-added.email";

// Customers, about their orders
export { orderUpdateEmail } from "./order-update.email";

export type { EmailContent } from "./layout";
