import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authMiddleware, ownerMiddleware } from '../middleware/auth.js';

const router = Router();

// GET /api/listings — all listings (with optional filters: type, city)
router.get('/', async (req, res, next) => {
    try {
        const { type, city, page = 1, limit = 20 } = req.query;

        const where = { isActive: true };
        if (type) where.type = type;
        if (city) where.city = { contains: city, mode: 'insensitive' };

        const skip = (Number(page) - 1) * Number(limit);

        const [listings, total] = await Promise.all([
            prisma.listing.findMany({
                where,
                include: {
                    images: { orderBy: { order: 'asc' } },
                    user: { select: { id: true, name: true, phone: true, avatarUrl: true } },
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: Number(limit),
            }),
            prisma.listing.count({ where }),
        ]);

        res.json({
            listings,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / Number(limit)),
            },
        });
    } catch (error) {
        next(error);
    }
});

// GET /api/listings/my — current user's listings (🔒)
router.get('/my', authMiddleware, async (req, res, next) => {
    try {
        const listings = await prisma.listing.findMany({
            where: { userId: req.user.id },
            include: {
                images: { orderBy: { order: 'asc' } },
            },
            orderBy: { createdAt: 'desc' },
        });

        res.json({ listings });
    } catch (error) {
        next(error);
    }
});

// GET /api/listings/:id — listing detail
router.get('/:id', async (req, res, next) => {
    try {
        const listing = await prisma.listing.findUnique({
            where: { id: req.params.id },
            include: {
                images: { orderBy: { order: 'asc' } },
                user: { select: { id: true, name: true, phone: true, avatarUrl: true } },
            },
        });

        if (!listing) {
            return res.status(404).json({ error: 'Listing not found' });
        }

        res.json({ listing });
    } catch (error) {
        next(error);
    }
});

// POST /api/listings — create listing (🔒)
router.post('/', authMiddleware, async (req, res, next) => {
    try {
        const { type, title, description, details, price, priceDescription, priceType, city, location, locationLat, locationLng, phoneNumber, images } = req.body;

        if (!type || !title || !price || !priceType || !city) {
            return res.status(400).json({ error: 'type, title, price, priceType, and city are required' });
        }

        const listing = await prisma.listing.create({
            data: {
                userId: req.user.id,
                type,
                title,
                description,
                details,
                price: Number(price),
                priceDescription,
                priceType,
                city,
                location,
                locationLat: locationLat ? Number(locationLat) : null,
                locationLng: locationLng ? Number(locationLng) : null,
                phoneNumber,
                images: images?.length
                    ? {
                        create: images.map((url, index) => ({
                            imageUrl: url,
                            order: index,
                        })),
                    }
                    : undefined,
            },
            include: {
                images: { orderBy: { order: 'asc' } },
            },
        });

        res.status(201).json({ listing });
    } catch (error) {
        next(error);
    }
});

// PUT /api/listings/:id — update listing (🔒 + owner)
router.put('/:id', authMiddleware, ownerMiddleware, async (req, res, next) => {
    try {
        const { type, title, description, details, price, priceDescription, priceType, city, location, locationLat, locationLng, phoneNumber, isActive } = req.body;

        const data = {};
        if (type !== undefined) data.type = type;
        if (title !== undefined) data.title = title;
        if (description !== undefined) data.description = description;
        if (details !== undefined) data.details = details;
        if (price !== undefined) data.price = Number(price);
        if (priceDescription !== undefined) data.priceDescription = priceDescription;
        if (priceType !== undefined) data.priceType = priceType;
        if (city !== undefined) data.city = city;
        if (location !== undefined) data.location = location;
        if (locationLat !== undefined) data.locationLat = Number(locationLat);
        if (locationLng !== undefined) data.locationLng = Number(locationLng);
        if (phoneNumber !== undefined) data.phoneNumber = phoneNumber;
        if (isActive !== undefined) data.isActive = isActive;

        const listing = await prisma.listing.update({
            where: { id: req.params.id },
            data,
            include: {
                images: { orderBy: { order: 'asc' } },
            },
        });

        res.json({ listing });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/listings/:id — delete listing (🔒 + owner)
router.delete('/:id', authMiddleware, ownerMiddleware, async (req, res, next) => {
    try {
        await prisma.listing.delete({
            where: { id: req.params.id },
        });

        res.json({ message: 'Listing deleted successfully' });
    } catch (error) {
        next(error);
    }
});

export default router;
