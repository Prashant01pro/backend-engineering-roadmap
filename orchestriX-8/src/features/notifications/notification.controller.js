import { getUserNotifications, getUnreadNotificationCount, markNotificationAsRead, markAllNotificationsAsRead, deleteNotificationById } from './notification.service.js';
import { catchAsync } from '../../utils/catchAsync.js';
import { eventBus, CHANNELS } from '../../services/eventBus.service.js';

export const getNotifications = catchAsync(async (req, res) => {
    const { page, limit, unreadOnly } = req.query;
    const result = await getUserNotifications(req.user._id, {
        page,
        limit,
        unreadOnly: unreadOnly === 'true',
    });

    res.status(200).json({
        status: 'success',
        ...result,
    });
});

export const getUnreadCount = catchAsync(async (req, res) => {
    const unreadCount = await getUnreadNotificationCount(req.user._id);
    res.status(200).json({
        status: 'success',
        unreadCount,
    });
});

export const markRead = catchAsync(async (req, res) => {
    const { id } = req.params;
    const notification = await markNotificationAsRead(id, req.user._id);

    res.status(200).json({
        status: 'success',
        message: 'Notification marked as read',
        data: notification,
    });
});

export const markAllRead = catchAsync(async (req, res) => {
    const result = await markAllNotificationsAsRead(req.user._id);
    res.status(200).json({
        status: 'success',
        message: 'All notifications marked as read',
        ...result,
    });
});

export const removeNotification = catchAsync(async (req, res) => {
    const { id } = req.params;
    await deleteNotificationById(id, req.user._id);

    res.status(200).json({
        status: 'success',
        message: 'Notification deleted successfully',
    });
});

// Server-Sent Events (SSE) endpoint for real-time notifications
// GET /api/v1/notifications/stream

export const streamNotification = (req, res) => {
    const userId = req.user._id.toString();

    // set required SSE streaming headers
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disables Nginx buffering in production
    });

     // Safe writer that prevents writing to destroyed/closed streams
    const safeWrite = (data) => {
        if (!res.writableEnded && !res.destroyed) {
            try {
                res.write(data);
            } catch (err) {
                // Socket was closed; ignore
            }
        }
    };

    // Send initial connection confirmation event
    safeWrite(`data: ${JSON.stringify({ type: 'CONNECTED', message: 'Real-time notification stream active' })}\n\n`);

    // define event handler for redis pub/sub events
    const onNotification = ({ userId: targetUserId, notification }) => {
        // filter: only push if event belongs to this authenticated user
        if (targetUserId === userId) {
            safeWrite(`data: ${JSON.stringify({ type: 'NOTIFICATION', data: notification })}\n\n`);
        }
    }

    // subscribe to the central eventBus
    // eventBus.subscribe(CHANNELS.USER_NOTIFICATIONS, onNotification)

    // // Keep-alive heartbeat every 25 seconds (prevents firewalls/proxies from dropping idle connections)
    // const keepAliveInterval = setInterval(() => {
    //     res.write(': keep-alive\n\n');
    // }, 25000);

    // Add listener for job progress events:
    const onJobEvent = ({ userId: targetUserId, jobId, progress, stage }) => {
        if (targetUserId === userId) {
            safeWrite(`data: ${JSON.stringify({ type: 'JOB_PROGRESS', jobId, progress, stage })}\n\n`);
        }
    };

    //Subscribe to EventBus
    eventBus.subscribe(CHANNELS.USER_NOTIFICATIONS, onNotification);
    eventBus.subscribe(CHANNELS.JOB_EVENTS, onJobEvent);

    // Keep-alive heartbeat every 25 seconds (prevents firewalls/proxies from dropping idle connections)
    const keepAliveInterval = setInterval(() => {
        res.write(': keep-alive\n\n');
    }, 25000);

    // clean up resources when the client disconnects (tab closed , network lost)
    // In the req.on('close') cleanup handler, make sure to unsubscribe both
    res.on('close', () => {
        clearInterval(keepAliveInterval);

        // in node , listeners on eventBus handlers array can be filtered or garbage collected
        const notifHandlers = eventBus.handlers.get(CHANNELS.USER_NOTIFICATIONS);
        if (notifHandlers) {
            const index = notifHandlers.indexOf(onNotification);
            if (index !== -1) notifHandlers.splice(index, 1)
        }

        // Unsubscribe job event handler
        const jobHandlers = eventBus.handlers.get(CHANNELS.JOB_EVENTS);
        if (jobHandlers) {
            const idx = jobHandlers.indexOf(onJobEvent);
            if (idx !== -1) jobHandlers.splice(idx, 1);
        }
        // res.end(); // Do NOT call res.end() here; socket is already closed by client
    })
}