// OTP Settings
const OTP_EXPIRY = 300; // 5 minutes
const OTP_RATE_LIMIT = 3; // Max 3 OTP requests
const OTP_RATE_WINDOW = 600; // 10 minutes window

// Login Attempt Settings
const LOGIN_ATTEMPT_LIMIT = 5; // Max 5 failed attempts
const LOGIN_ATTEMPT_WINDOW = 900; // 15 minutes lock window

module.exports = {
  OTP_EXPIRY,
  OTP_RATE_LIMIT,
  OTP_RATE_WINDOW,
  LOGIN_ATTEMPT_LIMIT,
  LOGIN_ATTEMPT_WINDOW,
};

