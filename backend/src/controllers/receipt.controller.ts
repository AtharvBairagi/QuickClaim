import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import * as receiptService from '../services/receipt.service';
import { AppError } from '../middleware/errorHandler';

export const uploadReceipt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      throw new AppError(400, 'No receipt file provided');
    }

    const productId = req.params.productId as string;
    const userId = req.userId!;

    const receipt = await receiptService.createReceipt(userId, {
      productId,
      fileName: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      storagePath: req.file.path,
    });

    res.status(201).json({ receipt });
  } catch (error) {
    next(error);
  }
};

export const getReceipt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const productId = req.params.productId as string;
    const userId = req.userId!;

    const receipt = await receiptService.getReceipt(userId, productId);

    res.json({ receipt });
  } catch (error) {
    next(error);
  }
};

export const downloadReceipt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const productId = req.params.productId as string;
    const userId = req.userId!;

    const receipt = await receiptService.getReceiptFileInfo(userId, productId);

    if (!fs.existsSync(receipt.storagePath)) {
      throw new AppError(404, 'Physical receipt file not found on server');
    }

    res.setHeader('Content-Type', receipt.mimeType);
    
    // Express res.download handles Content-Disposition encoding safely, protecting against header injection
    res.download(receipt.storagePath, receipt.originalName, (err) => {
      if (err) {
        next(err);
      }
    });
  } catch (error) {
    next(error);
  }
};

export const deleteReceipt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const productId = req.params.productId as string;
    const userId = req.userId!;

    await receiptService.deleteReceipt(userId, productId);

    res.json({ message: 'Receipt deleted successfully' });
  } catch (error) {
    next(error);
  }
};
