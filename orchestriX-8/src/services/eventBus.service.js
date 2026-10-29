import { redisPublisher, redisSubscriber } from '../config/redis.js';
import { logger } from '../config/logger.js';

export const CHANNELS = {
    USER_NOTIFICATIONS: 'channel:notifications:user',
    JOB_EVENTS: 'channel:jobs:events',
};

//Central Event Bus powered by Redis Pub/Sub

class EventBus {
    constructor() {
        this.handlers = new Map();
        this.isInitialized = false;
    }

    // Publish an event to a Redis channel
    //   @param {string} channel - Channel name
    //   @param {object} payload - Data payload to broadcast

    async publish(channel, payload) {
        try {
            const message = JSON.stringify(payload);
            await redisPublisher.publish(channel, message);
            logger.debug({ channel, payload }, 'EventBus: published event')
        } catch (error) {
            logger.error({ err: error, channel }, 'EventBus: publish failed')
        }
    }

    // Subscribe to a channel with a local callback handler
    //   @param {string} channel 
    //   @param {Function} handler 
    subscribe(channel, handler) {
        if (!this.handlers.has(channel)) {
            this.handlers.set(channel, [])
            // Tell Redis subscriber client to listen to this channel
            redisSubscriber.subscribe(channel, (err) => {
                if (err) {
                    logger.error({ err, channel }, 'EventBus: Redis subscription error');
                } else {
                    logger.info({ channel }, 'EventBus: Subscribed to Redis channel');
                }
            })
        }
        this.handlers.get(channel).push(handler);
    }

    //Start listening for incoming Redis Pub/Sub messages
    initialize() {
        if (this.isInitialized) return;

        redisSubscriber.on('message', (channel, message) => {
            try {
                const parsed = JSON.parse(message);
                const channelHandlers = this.handlers.get(channel) || [];

                for (const handler of channelHandlers) {
                    handler(parsed);
                }
            } catch (error) {
                logger.error({ err: error, channel, rawMessage: message }, 'EventBus: Failed to parse incoming message');
            }
        });

        this.isInitialized=true;
        logger.info('EventBus initialized and ready for messaging')
    }

}

export const eventBus=new EventBus();