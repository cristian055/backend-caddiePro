import { Router } from 'express';
import {
  getPublicQueue,
  getPublicWeekly,
  getPublicCaddiesByList,
  getPublicCaddies,
} from '../controllers/publicController.js';

const router = Router();

// GET /public/queue - Get current queue state for public monitor
router.get('/queue', getPublicQueue);

// GET /public/weekly - Get weekly schedule (read-only)
router.get('/weekly', getPublicWeekly);

// GET /public/lists - Get all caddies organized by list/category (public)
router.get('/lists', getPublicCaddies);

// GET /public/lists/:listNumber - Get caddies from a specific list (public)
router.get('/lists/:listNumber', getPublicCaddiesByList);

export default router;
