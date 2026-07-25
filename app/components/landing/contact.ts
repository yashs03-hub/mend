export const LANDING_CONTACT_EMAIL = "hello@mend.health";

export function talkToUsHref(): string {
  const subject = encodeURIComponent("Mend briefing");
  return `mailto:${LANDING_CONTACT_EMAIL}?subject=${subject}`;
}
