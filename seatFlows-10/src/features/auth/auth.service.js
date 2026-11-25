import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import * as authRepo from './auth.repository.js';
import AppError from '../../utils/appError.js';
import { withTransaction } from '../../config/db.js';
import { env } from '../../config/env.js';

const signToken = (id, role) => {
    return jwt.sign(
        { id, role },
        env.jwt.secret,
        { expiresIn: env.jwt.expiresIn }
    )
}

export const registerUser = async (userData) => {
    const { email, password, fullName, phoneNumber, role, organizationName, bio } = userData;
    if (!email || !password || !fullName) {
        throw new AppError('Please provide email, password, and full name', 400);
    }

    const existingUser = await authRepo.findUserByEmail(email)

    if (existingUser) {
        throw new AppError('Email is already registered', 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    let organizerProfile = null;
    let newUser;

    // handle registeration by role
    if (role === 'ORGANIZER') {
        if (!organizationName) {
            throw new AppError('Organization name is required for organizer registration', 400);
        }

        // atomic transaction : create user and organization profile
        await withTransaction(async (client) => {
            newUser = await authRepo.createUser({ email, passwordHash, fullName, phoneNumber, role: 'ORGANIZER' }, client);

            organizerProfile = await authRepo.createOrganizer({ userId: newUser.id, organizationName, bio,contactEmail: userData.contactEmail || email}, client);

        })
    } else {
        //normal customer registration
        newUser = await authRepo.createUser(
            { email, passwordHash, fullName, phoneNumber, role: 'CUSTOMER' }
        );
    }

    // generate jwt token
    const token = signToken(newUser.id, newUser.role);

    return {
        user: newUser,
        organizer: organizerProfile,
        token,
    };
};

export const loginUser = async ({ email, password }) => {
    if (!email || !password) {
        throw new AppError('Please provide email and password', 400);
    }

    const user = await authRepo.findUserByEmail(email);
    if (!user) {
        throw new AppError('Invalid email or password', 401);
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
        throw new AppError('Invalid email or password', 401);
    }

    const token=signToken(user.id, user.role)

    delete user.password_hash

    return {
        user,
        token
    }

}