import {  z  } from "zod"
import { MAX_FILE_SIZE, ACCEPTED_PDF_TYPES, ACCEPTED_IMAGE_TYPES, MAX_IMAGE_SIZE } from "./constants"

export const UploadSchema = z.object({
    title: z.string().min(1, "Judul dibutuhkan").max(100, "Judul terlalu panjang"),
    author: z.string().min(1, "Nama Author").max(100, "Nama Author terlalu panjang"),
    persona: z.string().min(1, "Pilihlah voice "),
    pdfFile: z.instanceof(File, { message: "File PDF dibutuhkan "})
    .refine((file) => file.size <= MAX_FILE_SIZE, "File harus dibawah 50MB")
    .refine((file) => ACCEPTED_PDF_TYPES.includes(file.type), "Hanya file PDF yang diterima"),
    coverImage: z.instanceof(File).optional()
    .refine((file) => !file || file.size <= MAX_IMAGE_SIZE, "Gambar harus dibawah 10MB")
    .refine((file) => !file || ACCEPTED_IMAGE_TYPES.includes(file.type), "Hanya .jpg, .jpeg, .png dan .webp format yang diterima")
})