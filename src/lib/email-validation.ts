export const accountEmailPattern = "[A-Za-z]+[0-9]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?\\.[A-Za-z]{2,}";

const accountEmailRegex = new RegExp(`^${accountEmailPattern}$`, "i");

export function isAllowedAccountEmail(email: string) {
  return accountEmailRegex.test(email.trim());
}

export const accountEmailHelp = "Use letters followed by numbers, then a standard domain, for example name123@company.com.";
