import { Router } from 'express';
import multer from 'multer';
import supabase from '../lib/supabase.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    },
});

// POST /api/upload — upload image to Supabase Storage (🔒)
router.post('/', authMiddleware, upload.single('image'), async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Image file is required' });
        }

        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${req.file.originalname.split('.').pop()}`;
        const filePath = `listings/${req.user.id}/${fileName}`;

        const { data, error } = await supabase.storage
            .from('images')
            .upload(filePath, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: false,
            });

        if (error) {
            console.error('Supabase upload error:', error);
            return res.status(500).json({ error: 'Failed to upload image' });
        }

        // Get public URL
        const { data: urlData } = supabase.storage
            .from('images')
            .getPublicUrl(filePath);

        res.status(201).json({
            message: 'Image uploaded successfully',
            imageUrl: urlData.publicUrl,
            path: filePath,
        });
    } catch (error) {
        next(error);
    }
});

// DELETE /api/upload — delete image from Supabase Storage (🔒)
router.delete('/', authMiddleware, async (req, res, next) => {
    try {
        const { path } = req.body;

        if (!path) {
            return res.status(400).json({ error: 'Image path is required' });
        }

        // Verify the path belongs to the user (startsWith to prevent path traversal)
        if (!path.startsWith(`listings/${req.user.id}/`)) {
            return res.status(403).json({ error: 'You can only delete your own images' });
        }

        const { error } = await supabase.storage
            .from('images')
            .remove([path]);

        if (error) {
            console.error('Supabase delete error:', error);
            return res.status(500).json({ error: 'Failed to delete image' });
        }

        res.json({ message: 'Image deleted successfully' });
    } catch (error) {
        next(error);
    }
});

export default router;
