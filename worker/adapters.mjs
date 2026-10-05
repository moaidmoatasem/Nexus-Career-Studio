// Field adapters. Each maps safe, routine profile values onto labelled form inputs.
// They NEVER answer legal, visa, salary, diversity or free-text screening questions,
// and NEVER click a submit button.
export const STOP_PATTERNS = [
  { re: /captcha|recaptcha|hcaptcha|are you a robot/i, reason: "Security check (CAPTCHA) — please complete it yourself" },
  { re: /verification code|one-time code|two-factor|2fa/i, reason: "Sign-in code requested — please continue yourself" },
];
export const SENSITIVE = /visa|sponsor|right to work|authori[sz]ed|salary|compensation|gender|ethnic|race|disab|veteran|sexual|religion|criminal|convict|declare|certify|consent/i;

export const ADAPTERS = {
  lever: { fields: { "name": "full_name", "full name": "full_name", "email": "email", "current company": "current_company", "linkedin": "linkedin" } },
  greenhouse: { fields: { "first name": "first_name", "last name": "last_name", "email": "email", "linkedin": "linkedin" } },
  workday: { fields: {}, note: "Workday requires an employer-specific account. Sign in yourself; the helper only opened the page." },
  generic: { fields: { "first name": "first_name", "last name": "last_name", "full name": "full_name", "email": "email" } },
};
for (const k of ["ashby", "workable", "smartrecruiters"]) ADAPTERS[k] = ADAPTERS.generic;
