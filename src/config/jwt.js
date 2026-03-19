
import jwt from "jsonwebtoken";


export const generateAccessToken = (staff) => {
  return jwt.sign(
    {
      id: staff.id,         
      roleId: staff.roleId,  
      type: "staff",        
    },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );
};


export const generateRefreshToken = (staff) => {
  return jwt.sign(
    {
      id: staff.id,
      type: "staff",
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );
};


export const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    throw new Error("Invalid or expired access token");
  }
};


export const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
  } catch (err) {
    throw new Error("Invalid or expired refresh token");
  }
};