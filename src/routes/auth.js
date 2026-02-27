import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { sendSMS } from '../lib/twilio.js';

const router = Router();

// In-memory OTP store (use Redis in production)
const otpStore = {};

// OTP attempt tracking (use Redis in production)
const otpAttempts = {};
const MAX_OTP_ATTEMPTS = 5;
const OTP_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

// Helper: generate JWT
const generateToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '30d',
    });
};

// POST /api/auth/send-otp
router.post('/send-otp', async (req, res, next) => {
    try {
        const { phone } = req.body;

        if (!phone) {
            return res.status(400).json({ error: 'Phone number is required' });
        }

        // In development, use DEV_OTP from env
        const isDev = process.env.NODE_ENV === 'development';
        const otp = isDev
            ? process.env.DEV_OTP || '1234'
            : String(Math.floor(100000 + Math.random() * 900000));

        // Store OTP with 5 minute expiry
        otpStore[phone] = {
            otp,
            expiresAt: Date.now() + 5 * 60 * 1000,
        };

        // Send SMS via Twilio (safe — logs in dev if no credentials)
        await sendSMS(phone, `Your RealEats verification code is: ${otp}`);

        console.log(`[OTP] ${isDev ? '(DEV) ' : ''}OTP for ${phone}: ${otp}`);

        res.json({ message: 'OTP sent successfully' });
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req, res, next) => {
    try {
        const { phone, otp } = req.body;

        if (!phone || !otp) {
            return res.status(400).json({ error: 'Phone and OTP are required' });
        }

        const stored = otpStore[phone];

        if (!stored) {
            return res.status(400).json({ error: 'No OTP found. Request a new one.' });
        }

        if (Date.now() > stored.expiresAt) {
            delete otpStore[phone];
            delete otpAttempts[phone];
            return res.status(400).json({ error: 'OTP expired. Request a new one.' });
        }

        // Check attempt limiting
        const attempts = otpAttempts[phone] || { count: 0, lockedUntil: 0 };
        if (Date.now() < attempts.lockedUntil) {
            return res.status(429).json({ error: 'Too many attempts. Try again later.' });
        }

        if (stored.otp !== otp) {
            attempts.count += 1;
            if (attempts.count >= MAX_OTP_ATTEMPTS) {
                attempts.lockedUntil = Date.now() + OTP_LOCKOUT_MS;
                attempts.count = 0;
            }
            otpAttempts[phone] = attempts;
            return res.status(400).json({ error: 'Invalid OTP' });
        }

        // OTP verified — clean up
        delete otpStore[phone];
        delete otpAttempts[phone];

        // Check if user exists
        const existingUser = await prisma.user.findUnique({
            where: { phone },
        });

        let token = null;
        let userData = null;

        if (existingUser) {
            token = generateToken(existingUser.id);
            userData = {
                id: existingUser.id,
                name: existingUser.name,
                phone: existingUser.phone,
                avatarUrl: existingUser.avatarUrl,
            };
        }

        res.json({
            message: 'OTP verified',
            isNewUser: !existingUser,
            phone,
            accessToken: token, // Send token if user exists
            user: userData,
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
    try {
        const { phone, name, password } = req.body;

        if (!phone || !name || !password) {
            return res.status(400).json({ error: 'Phone, name, and password are required' });
        }

        // Check if user already exists
        const existing = await prisma.user.findUnique({ where: { phone } });
        if (existing) {
            return res.status(409).json({ error: 'User already exists' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Create user
        const user = await prisma.user.create({
            data: {
                phone,
                name,
                password: hashedPassword,
            },
        });

        const token = generateToken(user.id);

        res.status(201).json({
            message: 'Registration successful',
            accessToken: token,
            user: {
                id: user.id,
                name: user.name,
                phone: user.phone,
                avatarUrl: user.avatarUrl,
            },
        });
    } catch (error) {
        next(error);
    }
});

// POST /api/auth/login
router.post('/login', async (req, res, next) => {
    try {
        const { phone, password } = req.body;

        if (!phone || !password) {
            return res.status(400).json({ error: 'Phone and password are required' });
        }

        const user = await prisma.user.findUnique({ where: { phone } });

        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = generateToken(user.id);

        res.json({
            message: 'Login successful',
            accessToken: token,
            user: {
                id: user.id,
                name: user.name,
                phone: user.phone,
                avatarUrl: user.avatarUrl,
            },
        });
    } catch (error) {
        next(error);
    }
});

export default router;
