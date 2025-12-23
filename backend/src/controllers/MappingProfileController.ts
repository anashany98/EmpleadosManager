import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class MappingProfileController {
    // Get all profiles
    async getProfiles(req: Request, res: Response) {
        try {
            const profiles = await prisma.mappingProfile.findMany({
                orderBy: { createdAt: 'desc' }
            });
            // Parse rules string back to JSON
            const parsedProfiles = profiles.map(p => ({
                ...p,
                rules: JSON.parse(p.rules)
            }));
            res.json(parsedProfiles);
        } catch (error) {
            res.status(500).json({ error: 'Error fetching profiles' });
        }
    }

    // Create new profile
    async createProfile(req: Request, res: Response) {
        try {
            const { name, rules } = req.body;
            if (!name || !rules) {
                return res.status(400).json({ error: 'Name and rules are required' });
            }

            const profile = await prisma.mappingProfile.create({
                data: {
                    name,
                    rules: JSON.stringify(rules) // Store as string for SQLite
                }
            });

            res.status(201).json({ ...profile, rules: JSON.parse(profile.rules) });
        } catch (error) {
            console.error(error);
            res.status(500).json({ error: 'Error creating profile' });
        }
    }

    // Delete profile
    async deleteProfile(req: Request, res: Response) {
        try {
            const { id } = req.params;
            await prisma.mappingProfile.delete({ where: { id } });
            res.json({ message: 'Profile deleted' });
        } catch (error) {
            res.status(500).json({ error: 'Error deleting profile' });
        }
    }
}
