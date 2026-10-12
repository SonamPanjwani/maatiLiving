export const cloudinaryConfig = {
  cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || "",
  apiKey: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY || "",
};

export const isCloudinaryConfigured = Boolean(cloudinaryConfig.cloudName);

// Admin uploads also need the API key here and CLOUDINARY_API_SECRET on the server (see /api/cloudinary/sign).
export const isCloudinaryUploadConfigured = Boolean(cloudinaryConfig.cloudName && cloudinaryConfig.apiKey);
