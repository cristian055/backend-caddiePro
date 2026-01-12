import { listService } from '../services/listService.js';
import { emitListUpdated, emitQueueUpdated } from '../utils/websocketEmitter.js';

export const getAllLists = async (req, res) => {
  try {
    const lists = await listService.getAllLists();
    res.json({ success: true, data: { lists } });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
};

export const getListByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const list = await listService.getListByCategory(category);
    res.json({ success: true, data: { list } });
  } catch (error) {
    const statusCode = error.message.includes('must be') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      error: {
        code: statusCode === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR',
        message: error.message
      }
    });
  }
};

export const updateList = async (req, res) => {
  try {
    const { id } = req.params;
    const { updates } = req.body;
    const updatedList = await listService.updateList(id, updates);

    emitListUpdated(updatedList.id, updatedList);
    emitQueueUpdated(updatedList.category);

    res.json({ success: true, data: updatedList });
  } catch (error) {
    const statusCode = error.message.includes('not found') ? 404 :
                     error.message.includes('must be') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      error: {
        code: statusCode === 404 ? 'NOT_FOUND' : statusCode === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR',
        message: error.message
      }
    });
  }
};

export const randomizeList = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await listService.randomizeList(id);
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: error.message }
    });
  }
};

export const createList = async (req, res) => {
  try {
    const list = await listService.createList(req.body);
    res.status(201).json({ success: true, data: list });
  } catch (error) {
    const statusCode = error.message.includes('must be') ? 400 : 500;
    res.status(statusCode).json({
      success: false,
      error: {
        code: statusCode === 400 ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR',
        message: error.message
      }
    });
  }
};

// Legacy support
export const getAllListSettings = getAllLists;
export const getListSettings = async (req, res) => {
  req.params.category = { '1': 'Primera', '2': 'Segunda', '3': 'Tercera' }[req.params.listNumber] || req.params.listNumber;
  return getListByCategory(req, res);
};
export const updateListSettings = updateList;
