import jwt from "jsonwebtoken";

// 🔐 ACCESS TOKEN
export const generateAccessToken = (staff) => {
  const payload = {
    id: staff.id,
    roleId: staff.roleId,
    type: "staff",
  };



  const token = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });



  return token;
};

// 🔐 REFRESH TOKEN
export const generateRefreshToken = (staff) => {
  const payload = {
    id: staff.id,
    type: "staff",
  };

  

  const token = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "7d",
  });



  return token;
};

// 🔍 VERIFY ACCESS TOKEN
export const verifyAccessToken = (token) => {
  try {


    const decoded = jwt.verify(token, process.env.JWT_SECRET);


    return decoded;
  } catch (err) {

    if (err.name === "TokenExpiredError") {
    }

    if (err.name === "JsonWebTokenError") {
    }

    throw new Error("Invalid or expired access token");
  }
};

// 🔍 VERIFY REFRESH TOKEN
export const verifyRefreshToken = (token) => {
  try {

    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);


    return decoded;
  } catch (err) {
    throw new Error("Invalid or expired refresh token");
  }
};