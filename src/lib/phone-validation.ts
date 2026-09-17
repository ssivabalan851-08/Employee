export const applicantPhoneHelp = "Enter a mobile number with country code, for example +91 97912 41338.";

export function normalizeApplicantPhone(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");

  // LeaveWise currently serves an India-based organization. Accept familiar
  // local forms while storing one international E.164 value for SMS delivery.
  if (/^[6-9][0-9]{9}$/.test(digits)) return `+91${digits}`;
  if (/^0[6-9][0-9]{9}$/.test(digits)) return `+91${digits.slice(1)}`;
  if (/^91[6-9][0-9]{9}$/.test(digits)) return `+${digits}`;
  if (trimmed.startsWith("+") && /^[1-9][0-9]{7,14}$/.test(digits)) return `+${digits}`;

  throw new Error(applicantPhoneHelp);
}
