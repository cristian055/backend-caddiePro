import { Router } from 'express';
import { getPublicQueue, getPublicWeekly } from '../controllers/publicController.js';

const router = Router();

// GET /public/queue - Get current queue state for public monitor
router.get('/queue', getPublicQueue);

// GET /public/weekly - Get weekly schedule (read-only)
router.get('/weekly', getPublicWeekly);

export default router;
