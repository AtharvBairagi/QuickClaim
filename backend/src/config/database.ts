import mongoose from 'mongoose';
import { config } from './env';
import { logger } from '../utilities/logger';

export const connectDatabase = async (): Promise<void> => {
  try {
    mongoose.connection.on('connected', () => {
      logger.info('MongoDB connection established successfully');
    });

    mongoose.connection.on('error', (err) => {
      logger.error(`MongoDB connection runtime error: ${err.message}`);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
    });

    logger.info(`Connecting to MongoDB...`);
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Failed to connect to MongoDB: ${errorMessage}`);
    throw error;
  }
};

export const disconnectDatabase = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB connection closed');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Error disconnecting from MongoDB: ${errorMessage}`);
  }
};
