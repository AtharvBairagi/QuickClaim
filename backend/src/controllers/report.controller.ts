import { Request, Response, NextFunction } from 'express';
import { getReportsSummary as getReportsSummaryService } from '../services/report.service';
import { AppError } from '../middleware/errorHandler';

export const getReportsSummary = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      throw new AppError(401, 'Authentication required');
    }

    const result = await getReportsSummaryService(userId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
