import { catchAsync } from '../../utils/catchAsync.js'
import { createNoteService, deleteNoteService, getAllNotesService, getNoteByIdService, updateNoteService } from './note.service.js';

export const createNote = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const note = await createNoteService(userId, req.body);

    res.status(201).json({
        status: 'success',
        message: 'Note created successfully',
        data: { note }
    })
})

export const getAllNotes = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const result = await getAllNotesService(userId, req.query);

    res.status(200).json({
        status: 'success',
        ...result
    })
})

export const getNoteById = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const noteId = req.params.id;

    const note = await getNoteByIdService(userId, noteId);
    res.status(200).json({
        status: 'success',
        data: { note }
    })
})

export const updateNote = catchAsync(async (req, res) => {
    const userId = req.user._id;
    const noteId = req.params.id;

    const note = await updateNoteService(userId, noteId, req.body);

    res.status(200).json({
        status: 'success',
        message: 'Note updated successfully',
        data: { note }
    })
})

export const deleteNote=catchAsync(async(req,res)=>{
    const userId=req.user._id;
    const noteId=req.params.id;

    await deleteNoteService(userId,noteId);

    res.status(200).json({
        status:'success',
        message:'Note deleted successfully'
    })
})


// Sending data: { note } wraps the note inside an object property, while sending direct (data: note) exposes the note object right away.
// 📊 Comparison of Response Structures
// Approach	                     JSON Output Structure                              	Pros & Cons

// Object Form ({ note })	     {"data": {"note": {"id": 1, "title": "Test"}}}      	Pros: Extensible for future metadata (e.g., pagination, counts).
//                                                                                      Cons: Extra nesting level in frontend code.
// Direct Form (note)	         {"data": {"id": 1, "title": "Test"}}	                Pros: Cleaner frontend access (response.data.title).
//                                                                                      Cons: Harder to add extra properties later without breaking changes.