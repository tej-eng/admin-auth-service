import jwt from "jsonwebtoken";

// 🔐 ACCESS TOKEN
export const generateAccessToken = (staff) => {
  const payload = {
    id: staff.id,
    roleId: staff.roleId,
    type: "staff",
  };

  console.log("🔐 [SIGN] Payload:", payload);
  console.log("🔐 [SIGN] SECRET:", process.env.JWT_SECRET);

  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });

  console.log("🔐 [SIGN] TOKEN:", token);

  return token;
};

// 🔐 REFRESH TOKEN
export const generateRefreshToken = (staff) => {
  const payload = {
    id: staff.id,
    type: "staff",
  };

  console.log("🔁 [REFRESH SIGN] Payload:", payload);
  console.log("🔁 [REFRESH SIGN] SECRET:", process.env.JWT_REFRESH_SECRET);

  const token = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "7d",
  });

  console.log("🔁 [REFRESH TOKEN]:", token);

  return token;
};

// 🔍 VERIFY ACCESS TOKEN
export const verifyAccessToken = (token) => {
  try {
    console.log("🔍 [VERIFY] Incoming Token:", token);
    console.log("🔍 [VERIFY] SECRET:", process.env.JWT_SECRET);

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    console.log("✅ [VERIFY SUCCESS] Decoded:", decoded);

    return decoded;
  } catch (err) {
    console.log("❌ [VERIFY ERROR]:", err.message);

    if (err.name === "TokenExpiredError") {
      console.log("⚠️ Token expired at:", err.expiredAt);
    }

    if (err.name === "JsonWebTokenError") {
      console.log("⚠️ Invalid token (signature mismatch likely)");
    }

    throw new Error("Invalid or expired access token");
  }
};

// 🔍 VERIFY REFRESH TOKEN
export const verifyRefreshToken = (token) => {
  try {
    console.log("🔍 [REFRESH VERIFY] Token:", token);
    console.log("🔍 [REFRESH VERIFY] SECRET:", process.env.JWT_REFRESH_SECRET);

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

    console.log("✅ [REFRESH VERIFY SUCCESS]:", decoded);

    return decoded;
  } catch (err) {
    console.log("❌ [REFRESH VERIFY ERROR]:", err.message);
    throw new Error("Invalid or expired refresh token");
  }
};