import express from "express";
import { upload } from "../utils/upload.js";

const router = express.Router();

router.post(
  "/upload-documents",
  upload.fields([
    { name: "profilePic", maxCount: 1 },
    { name: "aadhaar", maxCount: 1 },
    { name: "panCard", maxCount: 1 },
    { name: "passbook", maxCount: 1 },
  ]),
  (req, res) => {
    try {
      const files = req.files;

      const response = {
        profilePic: files?.profilePic?.[0]?.filename
          ? `/uploads/${files.profilePic[0].filename}`
          : null,
        aadhaar: files?.aadhaar?.[0]?.filename
          ? `/uploads/${files.aadhaar[0].filename}`
          : null,
        panCard: files?.panCard?.[0]?.filename
          ? `/uploads/${files.panCard[0].filename}`
          : null,
        passbook: files?.passbook?.[0]?.filename
          ? `/uploads/${files.passbook[0].filename}`
          : null,
      };

      return res.json(response);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: "Upload failed" });
    }
  }
);

export default router;