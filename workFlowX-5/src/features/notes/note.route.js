import express from 'express'
import { authenticate } from '../auth/auth.middleware.js'
import { validateBody, validateParams } from './note.middleware.js'
import { createNote, deleteNote, getAllNotes, getNoteById, updateNote } from './note.controller.js';
import { createNoteSchema, updateNoteSchema, noteIdParamsSchema } from './note.validation.js'

const router = express.Router()

router.use(authenticate);

router.route('/')
    .get(getAllNotes)
    .post(validateBody(createNoteSchema), createNote)

router.route('/:id')
    .all(validateParams(noteIdParamsSchema)) // Validates :id for GET, PATCH, DELETE
    .get(getNoteById)
    .patch(validateBody(updateNoteSchema), updateNote)
    .delete(deleteNote);

export default router;