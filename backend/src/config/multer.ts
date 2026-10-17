import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { config } from './env';
import { AppError } from '../middleware/errorHandler';

// Ensure upload directory exists
const receiptsDir = path.join(process.cwd(), config.uploadDir, 'receipts');
if (!fs.existsSync(receiptsDir)) {
  fs.mkdirSync(receiptsDir, { recursive: true });
}

// Map allowed MIME types to extensions for safe generated filenames
const ALLOWED_MIME_TYPES: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, receiptsDir);
  },
  filename: (_req, file, cb) => {
    const ext = ALLOWED_MIME_TYPES[file.mimetype] || '.bin';
    const safeFilename = `${uuidv4()}${ext}`;
    cb(null, safeFilename);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (ALLOWED_MIME_TYPES[file.mimetype]) {
    cb(null, true);
  } else {
    // We pass an error, which will be caught by the route handler
    cb(new AppError(400, 'Unsupported file type. Allowed types: PDF, JPEG, PNG, WEBP.'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB limit
  },
});
