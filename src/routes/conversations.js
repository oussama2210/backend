import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// GET /api/conversations — all conversations for current user (🔒)
router.get('/', authMiddleware, async (req, res, next) => {
    try {
        const conversations = await prisma.conversation.findMany({
            where: {
                OR: [
                    { buyerId: req.user.id },
                    { sellerId: req.user.id },
                ],
            },
            include: {
                listing: {
                    select: { id: true, title: true, price: true, priceType: true },
                },
                buyer: { select: { id: true, name: true, avatarUrl: true } },
                seller: { select: { id: true, name: true, avatarUrl: true } },
                messages: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                    select: { content: true, createdAt: true, senderId: true, isRead: true },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Format response — flatten last message and sort by most recent activity
        const formatted = conversations
            .map((conv) => ({
                ...conv,
                lastMessage: conv.messages[0] || null,
                messages: undefined,
            }))
            .sort((a, b) => {
                const aTime = a.lastMessage?.createdAt || a.createdAt;
                const bTime = b.lastMessage?.createdAt || b.createdAt;
                return new Date(bTime) - new Date(aTime);
            });

        res.json({ conversations: formatted });
    } catch (error) {
        next(error);
    }
});

// POST /api/conversations — start a conversation (🔒)
router.post('/', authMiddleware, async (req, res, next) => {
    try {
        const { listingId } = req.body;

        if (!listingId) {
            return res.status(400).json({ error: 'listingId is required' });
        }

        // Get the listing to find the seller
        const listing = await prisma.listing.findUnique({
            where: { id: listingId },
        });

        if (!listing) {
            return res.status(404).json({ error: 'Listing not found' });
        }

        // Prevent self-chat
        if (listing.userId === req.user.id) {
            return res.status(400).json({ error: 'Cannot start a conversation on your own listing' });
        }

        // Check for existing conversation
        const existing = await prisma.conversation.findUnique({
            where: {
                listingId_buyerId: {
                    listingId,
                    buyerId: req.user.id,
                },
            },
            include: {
                listing: { select: { id: true, title: true } },
                buyer: { select: { id: true, name: true, avatarUrl: true } },
                seller: { select: { id: true, name: true, avatarUrl: true } },
            },
        });

        if (existing) {
            return res.json({ conversation: existing, existing: true });
        }

        // Create new conversation
        const conversation = await prisma.conversation.create({
            data: {
                listingId,
                sellerId: listing.userId,
                buyerId: req.user.id,
            },
            include: {
                listing: { select: { id: true, title: true } },
                buyer: { select: { id: true, name: true, avatarUrl: true } },
                seller: { select: { id: true, name: true, avatarUrl: true } },
            },
        });

        res.status(201).json({ conversation });
    } catch (error) {
        next(error);
    }
});

export default router;
