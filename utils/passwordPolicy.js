const MIN_PASSWORD_LENGTH = 8;
const PASSWORD_REQUIREMENTS = {
  uppercase: 2,
  lowercase: 2,
  numbers: 2,
  special: 2,
};

const SPECIAL_CHARACTER_PATTERN = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/g;

const getPasswordStrengthCounts = (password = "") => {
  const normalizedPassword = String(password || "");
  return {
    length: normalizedPassword.length,
    uppercase: (normalizedPassword.match(/[A-Z]/g) || []).length,
    lowercase: (normalizedPassword.match(/[a-z]/g) || []).length,
    numbers: (normalizedPassword.match(/\d/g) || []).length,
    special: (normalizedPassword.match(SPECIAL_CHARACTER_PATTERN) || []).length,
  };
};

const passwordPolicyMessage =
  "Password must be at least 8 characters with minimum 2 uppercase, 2 lowercase, 2 numbers, and 2 special characters";

const validatePasswordStrength = (password = "") => {
  const counts = getPasswordStrengthCounts(password);
  const isValid =
    counts.length >= MIN_PASSWORD_LENGTH &&
    counts.uppercase >= PASSWORD_REQUIREMENTS.uppercase &&
    counts.lowercase >= PASSWORD_REQUIREMENTS.lowercase &&
    counts.numbers >= PASSWORD_REQUIREMENTS.numbers &&
    counts.special >= PASSWORD_REQUIREMENTS.special;

  return {
    isValid,
    counts,
    message: passwordPolicyMessage,
  };
};

module.exports = {
  MIN_PASSWORD_LENGTH,
  PASSWORD_REQUIREMENTS,
  getPasswordStrengthCounts,
  passwordPolicyMessage,
  validatePasswordStrength,
};
