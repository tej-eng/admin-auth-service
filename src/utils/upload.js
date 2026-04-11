import multer from "multer";
import path from "path";
import fs from "fs";


const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let uploadPath = "uploads/";

    if (req.originalUrl.includes("upload-banner")) {
      uploadPath = "uploads/banners/";
    } else if (req.originalUrl.includes("upload-documents")) {
      uploadPath = "uploads/documents/";
    } else if (req.originalUrl.includes("upload-profile")) {
      uploadPath = "uploads/profile/";
    }


    fs.mkdirSync(uploadPath, { recursive: true });

    cb(null, uploadPath);
  },

  filename: function (req, file, cb) {
    const uniqueName =
      Date.now() + "-" + file.originalname.replace(/\s/g, "_");
    cb(null, uniqueName);
  },
});


const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpg|jpeg|png|pdf/;
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedTypes.test(ext)) {
    cb(null, true);
  } else {
    cb(new Error("Only jpg, png, pdf allowed ❌"));
  }
};


const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
});

export { upload };