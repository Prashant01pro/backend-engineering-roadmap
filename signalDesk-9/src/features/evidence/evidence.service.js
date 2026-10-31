import sharp from 'sharp';
import streamifier from 'streamifier';
import {cloudinary }from '../../config/cloudinary.storage.js';
import Evidence from './evidence.model.js';
import Incident from '../incidents/incident.model.js';
import Team from '../teams/team.model.js';
import AppError from '../../utils/appError.js';
import { resolve } from 'nodemailer/lib/shared/url.js';

// helper: upload a buffer to cloudinary using streams
const uploadBufferToCloudinary = (buffer, options = {}) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: 'signaldesk/evidence',
                resource_type: 'image',
                ...options
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result)
            }
        );
        streamifier.createReadStream(buffer).pipe(uploadStream)
    })
}

// process image with sharp and store evidence
export const uploadEvidenceService = async ({ incidentId, fileBuffer, originalName, caption }, userId) => {
    const incident = await Incident.findById(incidentId);
    if (!incident) {
        throw new AppError('Incident not found', 404);
    }

    // Verify user belongs to the incident's assigned team
    const team = await Team.findById(incident.assignedTeam);

    const userMember = team?.members.find((m) => m.user.toString() === userId.toString());
    if (!userMember) {
        throw new AppError('You do not belong to the team investigating this incident', 403);
    }

    // sharp processing pipeline
    // extract metadata of the raw upload
    const sharpInstance = sharp(fileBuffer);
    const metadata = await sharpInstance.metadata();

    // pipeline A: Optimized Display Variant (Max 1600x1600, WebP, 80% quality, metadata stripped)
    const displayBuffer = await sharp(fileBuffer)
        .rotate() // auto-orient based on EXIF before stripping
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();

    // Pipeline B: Thumbnail Variant (200x200 cover crop, WebP, 80% quality)
    const thumbnailBuffer = await sharp(fileBuffer)
        .rotate()
        .resize({ width: 200, height: 200, fit: 'cover' })
        .webp({ quality: 80 })
        .toBuffer();

    // Upload both variants to Cloudinary concurrently
    const [displayUpload, thumbnailUpload] = await Promise.all([
        uploadBufferToCloudinary(displayBuffer, {
            public_id: `inc_${incidentId}_${Date.now()}_display`,
            format: 'webp'
        }),
        uploadBufferToCloudinary(thumbnailBuffer, {
            public_id: `inc_${incidentId}_${Date.now()}_thumb`,
            format: 'webp'
        })

    ])

    // Save evidence document in MongoDB
    const evidence = await Evidence.create({
        incident: incidentId,
        uploadedBy: userId,
        originalName,
        mimeType: 'image/webp',
        sizeBytes: displayUpload.bytes,
        displayUrl: displayUpload.secure_url,
        thumbnailUrl: thumbnailUpload.secure_url,
        displayPublicId: displayUpload.public_id,
        thumbnailPublicId: thumbnailUpload.public_id,
        width: displayUpload.width || metadata.width,
        height: displayUpload.height || metadata.height,
        caption: caption || ''
    });

    // Record evidence upload in the Incident timeline
    incident.timeline.push({
        action: 'COMMENT_ADDED',
        performedBy: userId,
        details: { action: 'EVIDENCE_UPLOADED', evidenceId: evidence._id, originalName }
    });

    await incident.save({ validateBeforeSave: false });
    return evidence;
}

// Get all evidence files for an incident
export const getIncidentEvidenceService = async (incidentId, userId) => {
    const incident = await Incident.findById(incidentId);
    if (!incident) throw new AppError('Incident not found', 404);

    const team = await Team.findById(incident.assignedTeam);
    const isMember = team?.members.some((m) => m.user.toString() === userId.toString());
    if (!isMember) {
        throw new AppError('Access denied: You do not belong to the incident team', 403);
    }

    const evidenceList = await Evidence.find({ incident: incidentId })
        .populate('uploadedBy', 'name email avatar')
        .sort({ createdAt: -1 });

    return evidenceList;
};


// Delete evidence
export const deleteEvidenceService = async (evidenceId, userId) => {
    const evidence = await Evidence.findById(evidenceId);
    if (!evidence) throw new AppError('Evidence not found', 404);

    const incident = await Incident.findById(evidence.incident);
    const team = await Team.findById(incident?.assignedTeam);
    const userMember = team?.members.find((m) => m.user.toString() === userId.toString());

    // Only the uploader or team lead can delete evidence
    const isUploader = evidence.uploadedBy.toString() === userId.toString();
    const isLead = userMember?.role === 'lead';
    if (!isUploader && !isLead) {
        throw new AppError('You do not have permission to delete this evidence', 403);
    }

    // Delete both assets from Cloudinary
    await Promise.all([
        cloudinary.uploader.destroy(evidence.displayPublicId),
        cloudinary.uploader.destroy(evidence.thumbnailPublicId)
    ]);

    await Evidence.findByIdAndDelete(evidenceId);
    return { success: true };
};