import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';

// JWT Authentication middleware
export const authMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Access token required' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
        });

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        req.user = user;
        next();
    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        next(error);
    }
};

// Owner check middleware — verifies listing belongs to current user
export const ownerMiddleware = async (req, res, next) => {
    try {
        const listingId = req.params.id;

        const listing = await prisma.listing.findUnique({
            where: { id: listingId },
        });

        if (!listing) {
            return res.status(404).json({ error: 'Listing not found' });
        }

        if (listing.userId !== req.user.id) {
            return res.status(403).json({ error: 'You do not own this listing' });
        }

        req.listing = listing;
        next();
    } catch (error) {
        next(error);
    }
};
