import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// GET /api/conversations/:id/messages — get messages (🔒 + participant check)
router.get('/:id/messages', authMiddleware, async (req, res, next) => {
    try {
        const conversationId = req.params.id;

        // Verify user is a participant
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
        });

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        if (conversation.buyerId !== req.user.id && conversation.sellerId !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const { page = 1, limit = 50 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        // Mark unread messages as read FIRST (messages not sent by current user)
        await prisma.message.updateMany({
            where: {
                conversationId,
                senderId: { not: req.user.id },
                isRead: false,
            },
            data: { isRead: true },
        });

        // Then fetch messages — they now have correct isRead status
        const messages = await prisma.message.findMany({
            where: { conversationId },
            include: {
                sender: { select: { id: true, name: true, avatarUrl: true } },
            },
            orderBy: { createdAt: 'asc' },
            skip,
            take: Number(limit),
        });

        res.json({ messages });
    } catch (error) {
        next(error);
    }
});

// POST /api/conversations/:id/messages — send message (🔒 + participant check)
router.post('/:id/messages', authMiddleware, async (req, res, next) => {
    try {
        const conversationId = req.params.id;
        const { content } = req.body;

        if (!content || !content.trim()) {
            return res.status(400).json({ error: 'Message content is required' });
        }

        // Verify user is a participant
        const conversation = await prisma.conversation.findUnique({
            where: { id: conversationId },
        });

        if (!conversation) {
            return res.status(404).json({ error: 'Conversation not found' });
        }

        if (conversation.buyerId !== req.user.id && conversation.sellerId !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const message = await prisma.message.create({
            data: {
                conversationId,
                senderId: req.user.id,
                content: content.trim(),
            },
            include: {
                sender: { select: { id: true, name: true, avatarUrl: true } },
            },
        });

        res.status(201).json({ message });
    } catch (error) {
        next(error);
    }
});

export default router;
