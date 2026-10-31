// This initializes Hocuspocus with authentication, loading from MongoDB, and persisting binary state back to MongoDB

import { Server } from '@hocuspocus/server';
import * as Y from 'yjs';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { authenticateHocuspocusConnection } from './hocuspocus.auth.js';
import CollaborativeDocument from '../features/notes/collaborativeDocument.model.js';
import Note from '../features/notes/note.model.js';

let hocuspocusServer = null;

export const initHocuspocusServer = () => {
    hocuspocusServer = new Server({
        port: env.HOCUSPOCUS_PORT,
        debounce: 3000, // Debounce saves: waits 3s of inactivity before persisting to MongoDB
        maxDebounce: 10000, // Maximum wait 10s under continuous typing

        // auth and authorization hook
        async onAuthenticate(data) {
            return await authenticateHocuspocusConnection(data)
        },

        // load document state from mongodb
        async onLoadDocument(data) {
            const { documentName, context } = data;

            // search for existing persisted binary state 
            const existingDoc = await CollaborativeDocument.findOne({ documentName })

            if (existingDoc && existingDoc.state) {
                // apply stored binary update to the newly spawned Y.Doc instance
                Y.applyUpdate(data.document, new Uint8Array(existingDoc.state));
                logger.debug({ documentName }, "Loaded persisted Yjs document state from MongoDB")
            } else {

                // Document newly opened for the first time:initialize default sections
                const ytext = data.document.getText('content');
                if (ytext.length === 0) {
                    ytext.insert(0, '# Incident Investigation Document\n\n### 1. Root Cause Analysis\n\n### 2. Immediate Actions Taken\n\n### 3. Verification & Resolution\n');
                }
                logger.info({ documentName }, 'Initialized brand new collaborative Yjs document');
            }
            return data.document;
        },

        //PERSIST DOCUMENT STATE TO MONGODB
        async onStoreDocument(data) {
            const { documentName, document, context } = data;

            // Encode entire Yjs document into a binary update buffer
            const stateUpdate = Buffer.from(Y.encodeStateAsUpdate(document));
            const parts = documentName.split(':');
            const incidentId = parts[1];
            const noteId = parts[3];

            // Upsert into collaborativeDocuments collection
            await CollaborativeDocument.findOneAndUpdate(
                { documentName },
                {
                    $set: {
                        noteId,
                        incidentId,
                        state: stateUpdate,
                        lastPersistedAt: new Date()
                    },
                    $inc: { snapshotVersion: 1 }
                },
                { upsert: true, new: true }
            );

            // Update parent note metadata
            if (context?.user?._id) {
                await Note.findByIdAndUpdate(noteId, {
                    lastUpdatedBy: context.user._id,
                    $inc: { snapshotVersion: 1 }
                });
            }
            logger.info({ documentName, sizeBytes: stateUpdate.length }, 'Persisted collaborative Yjs state to MongoDB');
        },

        //CONNECTION LOGGING
        async onConnect({ documentName, context }) {
            logger.info({ documentName, user: context?.user?.name }, 'Collaborator connected to document');
        },

        async onDisconnect({ documentName, context }) {
            logger.info({ documentName, user: context?.user?.name }, 'Collaborator disconnected from document');
        }


    });

    hocuspocusServer.listen().then(() => {
        logger.info({ port: env.HOCUSPOCUS_PORT }, `Hocuspocus Collaboration Server listening on port ${env.HOCUSPOCUS_PORT}`);
    });

    return hocuspocusServer;
}

export const getHocuspocusServer=()=> hocuspocusServer;