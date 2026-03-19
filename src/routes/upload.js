import express from "express";
import { upload } from "../utils/upload.js";

const router = express.Router();

router.post(
  "/upload-documents",
  upload.fields([
    { name: "aadhaar", maxCount: 1 },
    { name: "panCard", maxCount: 1 },
    { name: "passbook", maxCount: 1 },
    { name: "profilePic", maxCount: 1 },
  ]),
  (req, res) => {
    const files = req.files;

    res.json({
      aadhaar: files?.aadhaar?.[0]?.path || null,
      panCard: files?.panCard?.[0]?.path || null,
      passbook: files?.passbook?.[0]?.path || null,
      profilePic: files?.profilePic?.[0]?.path || null,
    });
  }
);

export default router;