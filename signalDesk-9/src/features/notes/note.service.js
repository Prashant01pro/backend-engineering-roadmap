//Even though text editing happens through WebSockets, clients need REST endpoints

import Note from './note.model.js';
import Incident from '../incidents/incident.model.js';
import Team from '../teams/team.model.js';
import AppError from '../../utils/appError.js';
import { env } from '../../config/env.js';

export const getOrCreateNoteService = async (incidentId, userId) => {
    const incident = await Incident.findById(incidentId);
    if (!incident) throw new AppError('Incident not found', 404);

    const team = await Team.findById(incident.assignedTeam);

    const isMember = team?.members.some((m) => m.user.toString() === userId.toString());
    if (!isMember) {
        throw new AppError('You do not belong to the incident team', 403);
    }

    let note = await Note.findOne({ incident: incidentId })
        .populate('createdBy', 'name email avatar')
        .populate('lastUpdatedBy', 'name email avatar')

    if (!note) {
        const dummyId = new Note()._id;
        const documentName = `incident:${incidentId}:notes:${dummyId}`;

        note = await Note.create({
            _id: dummyId,
            incident: incidentId,
            title: `Investigation Document: ${incident.title}`,
            documentName,
            createdBy: userId,
            lastUpdatedBy: userId
        })

        await note.populate('createdBy', 'name email avatar');
        await note.populate('lastUpdatedBy', 'name email avatar');
    }

    return {
        note,
        collaboration: {
            serverUrl: `ws://localhost:${env.HOCUSPOCUS_PORT}`,
            documentName: note.documentName
        }
    };
}

export const updateNoteMetadataService = async (noteId, { title }, userId) => {
    const note = await Note.findById(noteId);
    if (!note) throw new AppError('Note not found', 404);

    const incident = await Incident.findById(note.incident);
    const team = await Team.findById(incident?.assignedTeam);

    const isMember = team?.members.some((m) => m.user.toString() === userId.toString());
    if (!isMember) {
        throw new AppError('Access denied: You do not belong to the incident team', 403);
    }

    if (title) note.title = title;
    note.lastUpdatedBy = userId;

    await note.save({ validateBeforeSave: false });

    return note.populate('lastUpdatedBy', 'name email avatar');
};

