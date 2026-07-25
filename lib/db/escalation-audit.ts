/**
 * Decides how to finish the caregiver-SMS escalation audit after a
 * check-in write attempt. Early SMS rows are inserted with checkin_id
 * null for durability; once insertCheckin succeeds we link them back.
 */

export type EscalationAfterCheckinPlan =
  | { kind: "link"; escalationId: string; checkinId: string }
  | { kind: "insert_fallback" }
  | { kind: "noop" };

export function planEscalationAfterCheckin(args: {
  level: string;
  earlyEscalationId: string | undefined;
  checkinId: string | undefined;
}): EscalationAfterCheckinPlan {
  if (args.level === "green") {
    return { kind: "noop" };
  }

  if (args.earlyEscalationId) {
    if (args.checkinId) {
      return {
        kind: "link",
        escalationId: args.earlyEscalationId,
        checkinId: args.checkinId,
      };
    }
    // Early audit already durable; check-in write failed — leave checkin_id null.
    return { kind: "noop" };
  }

  return { kind: "insert_fallback" };
}
