import AppError from "../../utils/appError.js";
import { Project } from '../projects/project.model.js'
import { Note } from "./note.model.js";


// create a note service 
// ensures refered project (if provided) belongs to the authenticated user
export const createNoteService = async (userId, noteData) => {
    if (noteData.project) {
        const projectExists = await Project.findOne({ _id: noteData.project, user: userId });

        if (!projectExists) {
            throw new AppError('Referenced project not found or does not belong to you', 404)
        }
    }

    const note = await Note.create({
        ...noteData,
        user: userId
    })
    return note;
}

// Get all notes with Tag filtering, Pinned filter, Project filter, Search, Sort & Pagination
export const getAllNotesService = async (userId, query) => {
    const filter = { user: userId }

    if (query.project === 'none' || query.project === 'null') {
        filter.project = null;
    } else if (query.project) {
        filter.project = query.project;
    }

    if (query.isPinned !== undefined) {
        filter.isPinned = query.isPinned === 'true';
    }

    if (query.tag) {
        filter.tags = query.tag.toLowerCase();
    } else if (query.tags) {
        const tagsList = query.tags.split(',').map((t) => t.trim().toLowerCase());
        filter.tags = { $in: tagsList }

    }

    if (query.search) {
        filter.$or=[
            { title: { $regex: query.search, $options: 'i' } },
            { content: { $regex: query.search, $options: 'i' } }
        ]
    }

    const sortBy = query.sort ? query.sort.split(',').join(' ') : '-isPinned -updatedAt'

    // pagination
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(query.limit, 10) || 10));
    const skip = (page - 1) * limit;

    // execute query and count in parallel
    const [notes, totalNotes] = await Promise.all([
        Note.find(filter)
            .populate('project', 'title status')
            .sort(sortBy)
            .skip(skip)
            .limit(limit),
        Note.countDocuments(filter)
    ])

    const totalPages = Math.ceil(totalNotes / limit)

    return {
        notes,
        pagination: {
            totalNotes,
            totalPages,
            currentPage: page,
            limit,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
        }
    }
}

export const getNoteByIdService = async (userId, noteId) => {
    const note = await Note.findOne({ _id: noteId, user: userId })
        .populate('project', 'title status');

    if (!note) {
        throw new AppError('Note not found', 404);
    }

    return note;
}

export const updateNoteService = async (userId, noteId, updateData) => {
    if (updateData.project) {
        const projectExists = await Project.findOne({ _id: updateData.project, user: userId });
        if (!projectExists) {
            throw new AppError('Referenced project not found or does not belong to you', 404);
        }
    }

    const note = await Note.findOneAndUpdate({ _id: noteId, user: userId },
        updateData,
        {
            returnDocument: 'after',
            runValidators: true
        }
    ).populate('project', 'title status')

    if (!note) {
        throw new AppError('Note not found', 404);
    }
    return note;
}

export const deleteNoteService = async (userId, noteId) => {
    const note = await Note.findOneAndDelete({ _id: noteId, user: userId })
    if (!note) {
        throw new AppError('Note not found', 404);
    }
    return note;
}