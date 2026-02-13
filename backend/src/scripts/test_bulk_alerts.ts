
import dotenv from 'dotenv';
dotenv.config();
import { alertService } from '../services/AlertService';
import { prisma } from '../lib/prisma';

async function testBulkAlerts() {
    console.log('--- Testing Bulk Alert Actions ---');
    try {
        // 0. Check connectivity
        console.log('Checking connectivity...');
        const count = await prisma.alert.count();
        console.log(`Current alert count: ${count}`);

        // 1. Create some dummy alerts
        console.log('Creating dummy alerts...');
        await prisma.alert.create({
            data: {
                type: 'TEST_BULK',
                severity: 'LOW',
                title: 'Test Alert 1',
                message: 'Bulk read test 1',
                isRead: false,
                isDismissed: false
            }
        });
        await prisma.alert.create({
            data: {
                type: 'TEST_BULK',
                severity: 'LOW',
                title: 'Test Alert 2',
                message: 'Bulk read test 2',
                isRead: false,
                isDismissed: false
            }
        });

        const initialUnread = await prisma.alert.count({ where: { type: 'TEST_BULK', isRead: false } });
        console.log(`Initial unread TEST_BULK alerts: ${initialUnread}`);

        // 2. Mark all as read
        console.log('Marking all as read...');
        await alertService.markAllAsRead();
        const unreadAfter = await prisma.alert.count({ where: { type: 'TEST_BULK', isRead: false } });
        console.log(`Unread after bulk read: ${unreadAfter}`);

        if (unreadAfter === 0) {
            console.log('✅ Bulk Mark Read Successful.');
        } else {
            console.error('❌ Bulk Mark Read Failed.');
        }

        // 3. Dismiss all
        console.log('Dismissing all...');
        await alertService.dismissAll();
        const activeAfter = await prisma.alert.count({ where: { type: 'TEST_BULK', isDismissed: false } });
        console.log(`Active (not dismissed) after bulk dismiss: ${activeAfter}`);

        if (activeAfter === 0) {
            console.log('✅ Bulk Dismiss Successful.');
        } else {
            console.error('❌ Bulk Dismiss Failed.');
        }

        // Cleanup
        await prisma.alert.deleteMany({ where: { type: 'TEST_BULK' } });
        console.log('Cleanup done.');

    } catch (e) {
        console.error('❌ Bulk Alert Test Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

testBulkAlerts();
