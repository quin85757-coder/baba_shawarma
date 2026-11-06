const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const preset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export const cloudinaryEnabled = Boolean(cloud && preset);

export async function uploadToCloudinary(file: File, folder = "avatars") {
    if (!cloud || !preset) throw new Error("Image upload is not configured.");

    const form = new FormData();
    form.append("file", file);
    form.append("upload_preset", preset);
    form.append("folder", folder);

    const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
        method: "POST",
        body: form,
    });
    if (!res.ok) throw new Error("Image upload failed. Check your Cloudinary preset.");
    return (await res.json()) as { secure_url: string; public_id: string };
}