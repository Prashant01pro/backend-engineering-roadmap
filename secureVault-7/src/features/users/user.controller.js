import { catchAsync } from "../../utils/catchAsync.js";
import { deleteAvatarService, getAvatarPathService, getMeService, uploadAvatarService } from "./user.service.js";

export const me = catchAsync(async (req, res) => {
    const userId = req.user._id

    const user = await getMeService(userId)

    res.status(200).json({
        id: user._id,
        name: user.name,
        email: user.email
    })


})

export const uploadAvatar = catchAsync(async (req, res) => {

    const avatar = await uploadAvatarService(req.user._id, req.file.buffer)

    res.status(200).json({
        message: 'Avatar uploaded successfully',
        avatar
    })
})
export const getAvatar = catchAsync(async (req, res) => {
    const { filePath, mimeType } = await getAvatarPathService(req.user._id)

    // Set correct Content-Type so browser renders it
    res.setHeader('Content-Type', mimeType)
    res.sendFile(filePath)
})
export const deleteAvatar = catchAsync(async (req, res) => {
    await deleteAvatarService(req.user._id)

    res.status(200).json({
        message: 'Avatar deleted successfully'
    })
})