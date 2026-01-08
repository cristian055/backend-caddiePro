import prisma from '../config/database.js';

export const getAllMessages = async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      orderBy: { createdAt: 'desc' },
    });

    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createMessage = async (req, res) => {
  try {
    const { content, targetCategory } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // Validate targetCategory if provided
    const validCategories = ['Primera', 'Segunda', 'Tercera'];
    if (targetCategory && !validCategories.includes(targetCategory)) {
      return res.status(400).json({ error: 'Invalid target category' });
    }

    const message = await prisma.message.create({
      data: {
        content,
        targetCategory: targetCategory || null,
      },
    });

    res.status(201).json(message);
  } catch (error) {
    console.error('Create message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteMessage = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.message.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markMessageAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const message = await prisma.message.update({
      where: { id },
      data: { read: true },
    });

    res.json(message);
  } catch (error) {
    console.error('Mark message as read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getWhatsAppMessageUrl = async (req, res) => {
  try {
    const { id } = req.params;

    const message = await prisma.message.findUnique({
      where: { id },
    });

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const encodedContent = encodeURIComponent(message.content);
    const whatsappUrl = `https://wa.me/?text=${encodedContent}`;

    res.json({ whatsappUrl });
  } catch (error) {
    console.error('Get WhatsApp message URL error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
