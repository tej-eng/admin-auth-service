// src/middleware/auth.js
import jwt from "jsonwebtoken";
import cookie from "cookie";

const auth = (req) => {
  const cookies = req.headers.cookie ? cookie.parse(req.headers.cookie) : {};
  const token = cookies.token; // read token from cookie
  if (!token) return null;

  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
};

export default auth;
