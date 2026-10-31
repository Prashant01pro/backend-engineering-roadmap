import mongoose from 'mongoose';
import { env } from '../../../config/env.js';
import Incident, { INCIDENT_SEVERITY, INCIDENT_STATUS } from '../../incidents/incident.model.js';
import Team from '../../teams/team.model.js';
import User from '../../auth/auth.model.js';

const SEED_COUNT = parseInt(process.env.SEED_COUNT || '1000', 10);
const BATCH_SIZE = 1000;

const TITLES = [
    'Production API returning HTTP 500 errors',
    'PostgreSQL connection pool exhausted',
    'Redis latency spike above 200ms',
    'Kafka consumer group lag increasing',
    'Kubernetes pod crashlooping in auth service',
    'Cloudinary upload timeout on evidence images',
    'Elasticsearch cluster red status',
    'Memory leak detected in worker container',
    'SSL certificate expiry alert',
    'Payment gateway webhook 504 gateway timeout'
];

const SEVERITIES = Object.values(INCIDENT_SEVERITY);
const STATUSES = Object.values(INCIDENT_STATUS);

const seedDatabase = async () => {
    console.log(`\n--- Seeding ${SEED_COUNT} realistic incidents into SignalDesk ---`);
    await mongoose.connect(env.MONGO_URI);

    const team = await Team.findOne();
    const user = await User.findOne();

    if (!team || !user) {
        console.error('❌ Error: You must have at least 1 Team and 1 User created in the database first!');
        process.exit(1);
    }

    const teamId = team._id;
    const userId = user._id;

    console.log(`Using Team: ${team.name} (${teamId}) and User: ${user.name} (${userId})`);

    const totalBatches = Math.ceil(SEED_COUNT / BATCH_SIZE);
    const startDate = new Date('2026-01-01T00:00:00Z').getTime();
    const endDate = new Date().getTime();

    let createdTotal = 0;

    for (let batch = 1; batch <= totalBatches; batch++) {
        const batchRecords = [];
        const currentBatchSize = Math.min(BATCH_SIZE, SEED_COUNT - createdTotal);

        for (let i = 0; i < currentBatchSize; i++) {
            const randomTime = new Date(startDate + Math.random() * (endDate - startDate));
            const severity = SEVERITIES[Math.floor(Math.random() * SEVERITIES.length)];
            const status = STATUSES[Math.floor(Math.random() * STATUSES.length)];
            const title = `${TITLES[Math.floor(Math.random() * TITLES.length)]} #${createdTotal + i + 1}`;

            const resolvedAt = [INCIDENT_STATUS.RESOLVED, INCIDENT_STATUS.CLOSED].includes(status)
                ? new Date(randomTime.getTime() + Math.random() * 86400000 * 2) // Resolved 0-48h later
                : null;

            batchRecords.push({
                incidentNumber: `INC-SEED-${Date.now().toString().slice(-6)}-${createdTotal + i + 1}`,
                title,
                description: `Detailed incident report for: ${title}. High-volume synthetic data for search benchmarking.`,
                severity,
                status,
                assignedTeam: teamId,
                assignedTo: userId,
                createdBy: userId,
                createdAt: randomTime,
                updatedAt: randomTime,
                resolvedAt,
                timeline: [
                    {
                        action: 'CREATED',
                        performedBy: userId,
                        details: { seeded: true },
                        timestamp: randomTime
                    }
                ]
            });
        }

        await Incident.insertMany(batchRecords);
        createdTotal += currentBatchSize;
        console.log(`  -> Inserted batch ${batch}/${totalBatches} (${createdTotal}/${SEED_COUNT} total)`);
    }

    console.log(`Successfully seeded ${createdTotal} incidents!\n`);
    await mongoose.disconnect();
    process.exit(0);
};

seedDatabase().catch((err) => {
    console.error('Seeding failed:', err);
    process.exit(1);
});